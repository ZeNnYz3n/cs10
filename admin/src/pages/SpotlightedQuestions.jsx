import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminSpotlight, adminSpotlight as getSpotlighted } from '../services/api';
import { FiZap, FiClock, FiMessageCircle, FiExternalLink, FiAlertCircle } from 'react-icons/fi';

export default function SpotlightedQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const load = () => {
    setLoading(true);
    getSpotlighted()
      .then(res => {
        setQuestions(res.data.data || []);
        setTotal(res.data.total || 0);
      })
      .catch(err => console.error('Failed to load spotlighted questions:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const timeWaiting = (date) => {
    const ms = Date.now() - new Date(date).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 2) return 'Just posted';
    return `${mins} minutes waiting`;
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FiZap size={24} style={{ color: '#f59e0b' }} />
            Spotlighted Questions
          </h1>
          <p style={{ color: 'var(--text-2)', marginTop: '0.25rem' }}>
            Questions that need community attention (unanswered for more than 2 mins)
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.1))',
        borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FiZap size={18} style={{ color: '#f59e0b' }} />
          <span style={{ fontWeight: 600, color: '#f59e0b' }}>{total}</span>
          <span style={{ color: 'var(--text-2)' }}>questions need attention</span>
        </div>
        {total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', color: 'var(--text-2)' }}>
            <FiAlertCircle size={14} />
            <span>These questions are displayed at the top of the community board</span>
          </div>
        )}
      </div>

      {/* Questions List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 100 }} />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ color: '#16a34a' }}>
            <FiZap size={32} />
          </div>
          <h3>No Spotlighted Questions</h3>
          <p style={{ color: 'var(--text-2)' }}>
            All community questions are being answered! Great job community. 🎉
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {questions.map((q) => (
            <div
              key={q._id}
              className="card fade-in"
              style={{
                borderLeft: '4px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.05)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <span className="badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>
                      <FiZap size={10} style={{ marginRight: '0.25rem' }} />
                      Needs Answer
                    </span>
                    <span className="badge badge-primary">{q.category}</span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-1)' }}>
                    {q.rephrased_query}
                  </h3>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-2)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FiClock size={12} />
                      {timeWaiting(q.created_at)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FiMessageCircle size={12} />
                      {q.answer_count} answers
                    </span>
                    {q.posted_by && (
                      <span>by {q.posted_by.name}</span>
                    )}
                    <span>{timeAgo(q.created_at)}</span>
                  </div>
                </div>

                <Link
                  to={`/faq/community/${q._id}`}
                  className="btn btn-sm"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap',
                  }}
                  target="_blank"
                >
                  View Question
                  <FiExternalLink size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}