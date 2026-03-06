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

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [speedToLead, setSpeedToLead] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [s, f, r, stl] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/funnel'),
        api.get('/dashboard/recent-leads'),
        api.get('/dashboard/speed-to-lead'),
      ]);
      setStats(s);
      setFunnel(f);
      setRecentLeads(r.leads);
      setSpeedToLead(stl);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="page-loader">Loading dashboard...</div>;

  const formatMs = (ms) => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="dashboard">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="live-badge"><span className="live-dot"></span> Live</span>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">TOTAL LEADS</span>
            <span className="stat-icon icon-leads">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats?.total_leads ?? 0}</div>
          <div className="stat-change positive">{stats?.new_today ?? 0} new today</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">QUALIFIED</span>
            <span className="stat-icon icon-qualified">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats?.qualified ?? 0}</div>
          <div className="stat-change neutral">{stats?.booking_links_sent ?? 0} booking links sent</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">BOOKED</span>
            <span className="stat-icon icon-booked">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats?.booked ?? 0}</div>
          <div className="stat-change positive">{stats?.conversionRate ?? 0}% conversion</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">IN FOLLOW-UP</span>
            <span className="stat-icon icon-followup">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats?.in_followup ?? 0}</div>
          <div className="stat-change neutral">Active sequences</div>
        </div>
      </div>

      {speedToLead?.avg_ms && (
        <div className="speed-bar">
          <span className="speed-label">Avg Speed-to-Lead:</span>
          <span className="speed-value">{formatMs(speedToLead.avg_ms)}</span>
          <span className="speed-detail">Median: {formatMs(speedToLead.median_ms)} &middot; Best: {formatMs(speedToLead.min_ms)}</span>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="card recent-leads-card">
          <h3>Recent Leads</h3>
          {recentLeads.length === 0 ? (
            <div className="empty-state">
              <svg width="40" height="40" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="#d1d5db" strokeWidth="2"/></svg>
              <p>No leads yet</p>
              <span>New inbound leads will appear here</span>
            </div>
          ) : (
            <div className="leads-list">
              {recentLeads.map((lead) => (
                <Link to={`/leads/${lead.id}`} key={lead.id} className="lead-row">
                  <div className="lead-avatar">{(lead.firstName?.[0] || '?')}{(lead.lastName?.[0] || '')}</div>
                  <div className="lead-info">
                    <span className="lead-name">{lead.firstName || 'Unknown'} {lead.lastName || ''}</span>
                    <span className="lead-source">{lead.source || 'Direct'}</span>
                  </div>
                  <span className="status-badge" style={{ background: STATUS_COLORS[lead.status]?.bg, color: STATUS_COLORS[lead.status]?.color }}>
                    {lead.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card funnel-card">
          <h3>Conversion Funnel</h3>
          {funnel?.funnel?.length > 0 ? (
            <div className="funnel-list">
              {funnel.funnel.map((item) => (
                <div key={item.status} className="funnel-item">
                  <div className="funnel-header">
                    <span className="funnel-label">{item.status}</span>
                    <span className="funnel-count">{item.count} <span className="funnel-pct">{item.percentage}%</span></span>
                  </div>
                  <div className="funnel-bar">
                    <div
                      className="funnel-fill"
                      style={{
                        width: `${item.percentage}%`,
                        background: STATUS_COLORS[item.status]?.color || '#6b7280',
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
