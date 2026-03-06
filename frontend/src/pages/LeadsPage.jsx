import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUS_COLORS = {
  NEW: { bg: '#f3f4f6', color: '#6b7280' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb' },
  QUALIFYING: { bg: '#ede9fe', color: '#7c3aed' },
  QUALIFIED: { bg: '#fef3c7', color: '#d97706' },
  BOOKED: { bg: '#d1fae5', color: '#059669' },
  UNRESPONSIVE: { bg: '#fee2e2', color: '#dc2626' },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const loadLeads = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filter) params.set('status', filter);
      const data = await api.get(`/leads?${params}`);
      setLeads(data.leads);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLeads(); }, [filter]);

  const formatDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="leads-page">
      <div className="page-header">
        <h1>Leads</h1>
        <div className="filter-bar">
          {['', 'NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED', 'UNRESPONSIVE'].map((s) => (
            <button key={s} className={`filter-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="page-loader">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No leads found</p></div></div>
      ) : (
        <div className="card">
          <table className="leads-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Source</th>
                <th>Status</th>
                <th>Speed-to-Lead</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link to={`/leads/${lead.id}`} className="lead-link">
                      {lead.firstName || 'Unknown'} {lead.lastName || ''}
                    </Link>
                  </td>
                  <td className="mono">{lead.phone}</td>
                  <td>{lead.source || '—'}</td>
                  <td>
                    <span className="status-badge" style={{ background: STATUS_COLORS[lead.status]?.bg, color: STATUS_COLORS[lead.status]?.color }}>
                      {lead.status}
                    </span>
                  </td>
                  <td>{lead.speedToLeadMs ? `${(lead.speedToLeadMs/1000).toFixed(1)}s` : '—'}</td>
                  <td className="muted">{formatDate(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              {Array.from({ length: pagination.totalPages }, (_, i) => (
                <button key={i} className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`} onClick={() => loadLeads(i + 1)}>
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
