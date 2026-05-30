import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import Vote from '../models/Vote.js';
import User from '../models/User.js';
import FAQ from '../models/FAQ.js';
import { rephraseQuery } from './groq.js';
import { getEmbedding } from './embeddingService.js';
import AppError from '../utils/appError.js';

// Spotlight threshold: 2 minutes in milliseconds
const SPOTLIGHT_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * Check if a question should be spotlighted.
 * A question is spotlighted if:
 * - Status is 'open'
 * - Has 0 answers
 * - Has been unanswered for more than 2 minutes
 * 
 * @param {Object} question - Question document
 * @returns {boolean}
 */
export const isSpotlighted = (question) => {
  if (question.status !== 'open' || question.answer_count > 0) {
    return false;
  }
  const createdAt = new Date(question.created_at).getTime();
  const now = Date.now();
  return (now - createdAt) > SPOTLIGHT_THRESHOLD_MS;
};

/**
 * Service managing community questions, duplicate checking, and votes.
 */
class QuestionService {
  /**
   * Rephrase and categorize a raw query for posting.
   *
   * @param {string} query - Raw user query
   * @returns {Promise<{rephrased: string, category: string}>}
   */
  async prepare(query) {
    if (!query || typeof query !== 'string' || query.trim().length < 8) {
      throw new AppError('Please provide a valid query (at least 8 characters).', 400);
    }

    return rephraseQuery(query.trim());
  }

  /**
   * Submit a new question to the Q&A community board.
   * Performs semantic duplicate checks on FAQ and MongoDB.
   *
   * @param {Object} data - Submission payload
   * @param {string} data.original_query - Raw user query
   * @param {string} data.rephrased_query - Cleaned standalone question
   * @param {string} data.category - Section code
   * @param {string} data.userId - Creator database ID
   * @returns {Promise<{success: boolean, duplicate?: boolean, existing_question?: string, question_id?: string, message: string}>}
   */
  async submit({ original_query, rephrased_query, category, userId }) {
    if (!original_query || !rephrased_query || !category) {
      throw new AppError('original_query, rephrased_query, and category are required.', 400);
    }

    const rephrasedClean = rephrased_query.trim();

    // 1. Duplicate detection: check if a similar question exists in FAQ vector store
    try {
      const embedding = await getEmbedding(rephrasedClean);

      const dupCheck = await FAQ.aggregate([
        {
          $vectorSearch: {
            index: 'faq_vector_index',
            path: 'embedding',
            queryVector: embedding,
            numCandidates: 10,
            limit: 1
          }
        },
        {
          $project: {
            question: 1,
            similarity: { $meta: 'searchScore' }
          }
        }
      ]);

      if (dupCheck.length > 0 && dupCheck[0].similarity > 0.90) {
        return {
          success: false,
          duplicate: true,
          existing_question: dupCheck[0].question,
          message: 'A very similar question already exists in our FAQ database.',
        };
      }
    } catch (dupError) {
      console.error('⚠️ Duplicate check vector search failed:', dupError.message);
    }

    // 2. Check MongoDB for duplicate community questions
    const existingQuestion = await Question.findOne({
      rephrased_query: { $regex: new RegExp(`^${rephrasedClean.substring(0, 50)}`, 'i') },
      status: { $ne: 'closed' },
    });

    if (existingQuestion) {
      return {
        success: false,
        duplicate: true,
        question_id: existingQuestion._id,
        message: 'A similar question has already been posted to the community.',
      };
    }

    // 3. Create the question
    const question = await Question.create({
      original_query: original_query.trim(),
      rephrased_query: rephrasedClean,
      category: category.toLowerCase().trim(),
      posted_by: userId,
    });

    // 4. Increment user's question count
    await User.findByIdAndUpdate(userId, { $inc: { questions_count: 1 } });

    return {
      success: true,
      question_id: question._id,
      message: "Your question has been posted! You'll be notified when someone answers.",
    };
  }

  /**
   * Fetch paginated list of community questions.
   * Spotlighted questions (0 answers, >2 mins old) appear first regardless of sort.
   *
   * @param {Object} queryOptions - Filters and paging values
   * @returns {Promise<{data: Array, total: number, page: number, pages: number, spotlightCount: number}>}
   */
  async list({ category, status = 'open', page = 1, sort = 'newest', limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (category) filter.category = category.toLowerCase();
    if (status && status !== 'all') filter.status = status;

    const sortOptions = {};
    switch (sort) {
      case 'oldest': sortOptions.created_at = 1; break;
      case 'most_answers': sortOptions.answer_count = -1; break;
      case 'most_viewed': sortOptions.view_count = -1; break;
      case 'most_voted': sortOptions.net_score = -1; break;
      default: sortOptions.created_at = -1; // newest
    }

    const [questions, total] = await Promise.all([
      Question.find(filter)
        .populate('posted_by', 'name')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Question.countDocuments(filter),
    ]);

    // Add spotlight status to each question
    const questionsWithSpotlight = questions.map(q => ({
      ...q,
      is_spotlighted: isSpotlighted(q),
    }));

    // Split into spotlighted and non-spotlighted
    const spotlighted = questionsWithSpotlight.filter(q => q.is_spotlighted);
    const nonSpotlighted = questionsWithSpotlight.filter(q => !q.is_spotlighted);

    // Sort each group by the requested sort (spotlighted by newest first, then non-spotlighted by the requested sort)
    spotlighted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Combine: spotlighted first, then non-spotlighted
    const sortedQuestions = [...spotlighted, ...nonSpotlighted];

    return {
      data: sortedQuestions,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      spotlightCount: spotlighted.length,
    };
  }

  /**
   * Get all spotlighted questions (for admin view).
   * Spotlighted = open questions with 0 answers that are older than 2 minutes.
   *
   * @returns {Promise<{data: Array, total: number}>}
   */
  async getSpotlighted() {
    const threshold = new Date(Date.now() - SPOTLIGHT_THRESHOLD_MS);

    const spotlightedQuestions = await Question.find({
      status: 'open',
      answer_count: 0,
      created_at: { $lt: threshold },
    })
      .populate('posted_by', 'name email')
      .select('rephrased_query original_query category status answer_count net_score created_at posted_by')
      .sort({ created_at: 1 }) // Oldest first (most urgent)
      .lean();

    return {
      data: spotlightedQuestions,
      total: spotlightedQuestions.length,
    };
  }

  /**
   * Get detail information for a single question (includes incrementing view counter).
   *
   * @param {string} id - Question ID
   * @returns {Promise<{question: Object, answers: Array, hidden_count: number}>}
   */
  async get(id) {
    const question = await Question.findById(id).populate('posted_by', 'name');
    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    // Increment view count
    await Question.findByIdAndUpdate(id, { $inc: { view_count: 1 } });

    const answers = await Answer.find({
      question_id: id,
      status: { $in: ['live', 'flagged'] },
    })
      .populate('answered_by', 'name xp')
      .sort({ net_score: -1, created_at: -1, status: 1 })
      .lean();

    const hiddenCount = await Answer.countDocuments({
      question_id: id,
      status: 'hidden',
    });

    return {
      question,
      answers,
      hidden_count: hiddenCount,
    };
  }

  /**
   * Vote on a community question.
   *
   * @param {Object} data - Voting details
   * @param {string} data.id - Question database ID
   * @param {string} data.type - Vote type ('up' or 'down')
   * @param {string} data.userId - Database ID of voter user
   * @returns {Promise<{success: boolean, net_score: number, message: string}>}
   */
  async vote({ id, type, userId }) {
    if (!type || !['up', 'down'].includes(type)) {
      throw new AppError('Vote type must be "up" or "down".', 400);
    }

    const question = await Question.findById(id);
    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    // Cannot vote on own question
    if (question.posted_by.toString() === userId.toString()) {
      throw new AppError('You cannot vote on your own question.', 403);
    }

    try {
      await Vote.create({
        user_id: userId,
        question_id: question._id,
        type,
      });
    } catch (dupError) {
      if (dupError.code === 11000) {
        throw new AppError('You have already voted on this question.', 409);
      }
      throw dupError;
    }

    const update = type === 'up'
      ? { $inc: { upvotes: 1, net_score: 1 } }
      : { $inc: { downvotes: 1, net_score: -1 } };

    const updatedQuestion = await Question.findByIdAndUpdate(
      question._id,
      update,
      { new: true }
    );

    return {
      success: true,
      net_score: updatedQuestion.net_score,
      message: 'Vote recorded',
    };
  }
}

export default new QuestionService();
