import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function PasswordRequestsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/password-help-requests?status=pending')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async (id) => {
    setActionId(id);
    try {
      await api.patch(`/admin/password-help-requests/${id}`, { status: 'dismissed' });
      load();
    } catch (err) {
      alert(err.message || 'Could not dismiss');
    } finally {
      setActionId(null);
    }
  };

  const resetAndEmail = async (userId, requestId) => {
    if (!userId) {
      alert('No matching user account — dismiss or follow up manually.');
      return;
    }
    if (!window.confirm('Generate a new temporary password and email it to this user?')) return;
    setActionId(requestId);
    try {
      const result = await api.post(`/admin/users/${userId}/reset-password`, { sendEmail: true });
      if (result.temporaryPassword) {
        alert(`Email may have failed. Temporary password (copy now):\n\n${result.temporaryPassword}`);
      } else {
        alert(`Password reset. Email sent to ${result.email}.`);
      }
      load();
    } catch (err) {
      alert(err.message || 'Reset failed');
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';

  if (loading && !data) return <div className="page-loader">Loading requests...</div>;

  const requests = data?.requests || [];

  return (
    <div className="admin-page">
      <h1>Password help requests</h1>
      <p className="page-sub" style={{ marginBottom: 20 }}>
        Tenants who use Forgot password appear here. Reset their password from the request or from the business
        detail page.
      </p>

      {requests.length === 0 ? (
        <div className="card empty-state">
          <p>No pending requests.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>When</th>
                <th>Email</th>
                <th>Account</th>
                <th>Message</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>{r.email}</td>
                  <td>
                    {r.userId ? (
                      <>
                        <strong>{r.tenantName || 'Tenant'}</strong>
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          {r.userFirstName} {r.userLastName} ({r.userEmail})
                        </span>
                        {r.tenantId && (
                          <>
                            <br />
                            <Link to={`/admin/tenants/${r.tenantId}`}>Open business →</Link>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="muted">No matching active account</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 220, fontSize: 13 }}>{r.message || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!r.userId || actionId === r.id}
                        onClick={() => resetAndEmail(r.userId, r.id)}
                      >
                        Reset &amp; email
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={actionId === r.id}
                        onClick={() => dismiss(r.id)}
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
