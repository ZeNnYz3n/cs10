import '../dns-setup.js'; // DNS setup
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Question from '../models/Question.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'YOUR_OTHER_DATABASE_URI_HERE';

async function deleteQuestions() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`Connected to MongoDB`);

    // We saw only 1 question, which was the malformed test question. 
    // We'll delete it now.
    const res = await Question.deleteMany({});
    console.log(`Deleted ${res.deletedCount} questions.`);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

deleteQuestions();
