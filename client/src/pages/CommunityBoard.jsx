import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import VoteButtons from '../components/VoteButtons';
import { FaBolt, FaQuestion, FaCommentDots, FaEye, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import { FiZap } from 'react-icons/fi';

const CATEGORIES = ['all', 'about', 'timing', 'noc', 'selection', 'work', 'conduct', 'certificate', 'interviews', 'general'];

export default function CommunityBoard() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('open');
  const [sort, setSort] = useState('most_voted');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, status, sort });
      if (category !== 'all') params.append('category', category);

      const res = await api.get(`/questions?${params}`);
      setQuestions(res.data.data);
      setTotalPages(res.data.pages);
      setTotal(res.data.total);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [category, status, sort, page]);

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="page">
      <div className="container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 800,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Community Board
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>{total} questions</p>
          </div>
          <Link to="/faq" className="btn btn-primary btn-sm"><FaBolt style={{ marginRight: '0.4rem' }} /> Ask Yaksha First</Link>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${category === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setCategory(cat); setPage(1); }}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['open', 'answered', 'all'].map((s) => (
            <button
              key={s}
              className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatus(s); setPage(1); }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          <span style={{ borderLeft: '1px solid var(--border-color)', margin: '0 0.25rem' }} />
          {[['most_voted', 'Most Voted'], ['newest', 'Newest']].map(([val, label]) => (
            <button
              key={val}
              className={`btn btn-sm ${sort === val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setSort(val); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Questions list */}
        {loading ? (
          <div className="loading-center"><div className="spinner spinner-lg" /></div>
        ) : questions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FaQuestion /></div>
            <div className="empty-state-text">No questions found</div>
            <p style={{ color: 'var(--text-muted)' }}>Try a different filter or ask Yaksha first!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {questions.map((q) => (
              <Link
                key={q._id}
                to={`/faq/community/${q._id}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="card" style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div onClick={(e) => e.preventDefault()} style={{ flexShrink: 0 }}>
                      <VoteButtons
                        questionId={q._id}
                        initialScore={q.net_score || 0}
                        isOwn={q.posted_by?._id === user?._id}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                        {q.rephrased_query}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        {q.is_spotlighted && (
                          <span className="badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <FiZap size={12} /> Spotlight
                          </span>
                        )}
                        <span className="badge badge-primary">{q.category}</span>
                        <span className={`badge ${q.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                          {q.status}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <FaCommentDots style={{ marginRight: '0.2rem' }} /> {q.answer_count} answers
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          <FaEye style={{ marginRight: '0.2rem' }} /> {q.view_count} views
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {timeAgo(q.created_at)}
                        </span>
                      </div>
                    </div>
                    {q.posted_by && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        by {q.posted_by.name}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <FaArrowLeft style={{ marginRight: '0.3rem' }} /> Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`pagination-btn ${page === p ? 'active' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="pagination-btn"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next <FaArrowRight style={{ marginLeft: '0.3rem' }} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
