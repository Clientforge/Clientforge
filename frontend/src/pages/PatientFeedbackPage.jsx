import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDateTime(iso, timeZone) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone || 'America/New_York',
  });
}

function starsDisplay(n) {
  const s = Math.min(3, Math.max(1, Number(n) || 1));
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}

export default function PatientFeedbackPage() {
  const { tenant } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await api.get(`/patient-feedback?page=${page}&limit=50`);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load feedback');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page]);

  const items = data?.feedback || [];
  const pagination = data?.pagination;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Patient Feedback</h1>
          <p className="page-subtitle">
            Private feedback from your review flow (1–3 star ratings). New submissions appear here automatically.
          </p>
        </div>
      </div>

      {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card">
        {loading && <div className="page-loader">Loading…</div>}
        {!loading && items.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>No feedback submitted yet.</p>
        )}
        {!loading && items.length > 0 && (
          <div className="link-clicks-table-wrap">
            <table className="link-clicks-table">
              <thead>
                <tr>
                  <th>Submitted</th>
                  <th>Rating</th>
                  <th>Areas</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(row.submittedAt, tenant?.timezone)}
                    </td>
                    <td>
                      <span title={`${row.stars} of 3 stars`} aria-label={`${row.stars} of 3 stars`}>
                        {starsDisplay(row.stars)}
                      </span>
                      <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                        ({row.stars}/3)
                      </span>
                    </td>
                    <td>
                      {(row.categories || []).map((cat) => (
                        <span
                          key={cat}
                          className="status-badge"
                          style={{
                            display: 'inline-block',
                            margin: '2px 4px 2px 0',
                            background: '#f3f4f6',
                            color: '#374151',
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {cat}
                        </span>
                      ))}
                    </td>
                    <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{row.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="pagination" style={{ marginTop: 16 }}>
            {Array.from({ length: pagination.totalPages }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
