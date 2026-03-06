import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function TenantListPage() {
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20, sortBy: 'created_at', sortOrder: 'DESC' });
      if (search) params.set('search', search);
      const data = await api.get(`/admin/tenants?${params}`);
      setTenants(data.tenants);
      setPagination(data.pagination);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="tenant-list-page">
      <div className="page-header">
        <h1>Businesses</h1>
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text" placeholder="Search by name or industry..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </form>
      </div>

      {loading ? <div className="page-loader">Loading businesses...</div> : (
        <div className="card">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Business</th>
                <th>Industry</th>
                <th>Plan</th>
                <th>Leads</th>
                <th>Status</th>
                <th>Signed Up</th>
                <th>Last Lead</th>
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 ? (
                <tr><td colSpan="7" style={{textAlign:'center',padding:'32px',color:'#9ca3af'}}>No businesses found</td></tr>
              ) : tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/admin/tenants/${t.id}`} className="lead-link">{t.name}</Link>
                  </td>
                  <td>{t.industry || '—'}</td>
                  <td><span className={`plan-badge plan-${t.plan}`}>{t.plan}</span></td>
                  <td><strong>{t.leadCount}</strong></td>
                  <td>
                    <span className={`status-dot ${t.active ? 'dot-active' : 'dot-inactive'}`}></span>
                    {t.active ? 'Active' : 'Inactive'}
                  </td>
                  <td className="muted">{formatDate(t.createdAt)}</td>
                  <td className="muted">{formatDate(t.lastLeadAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button key={i} className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`} onClick={() => load(i + 1)}>
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
