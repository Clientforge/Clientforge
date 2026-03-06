import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function PlatformDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loader">Loading platform data...</div>;
  if (!stats) return <div className="page-loader">Failed to load</div>;

  const formatMs = (ms) => {
    if (!ms) return '—';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="admin-dashboard">
      <div className="page-header">
        <h1>Platform Overview</h1>
        <span className="admin-badge">Super Admin</span>
      </div>

      <div className="stat-cards five-col">
        <div className="stat-card admin-card">
          <div className="stat-top">
            <span className="stat-label">BUSINESSES</span>
            <span className="stat-icon icon-admin-biz">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats.tenants.total}</div>
          <div className="stat-change positive">{stats.tenants.active} active</div>
        </div>

        <div className="stat-card admin-card">
          <div className="stat-top">
            <span className="stat-label">NEW THIS WEEK</span>
            <span className="stat-icon icon-admin-new">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats.tenants.newThisWeek}</div>
          <div className="stat-change neutral">{stats.tenants.newThisMonth} this month</div>
        </div>

        <div className="stat-card admin-card">
          <div className="stat-top">
            <span className="stat-label">TOTAL LEADS</span>
            <span className="stat-icon icon-leads">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats.leads.total}</div>
          <div className="stat-change positive">{stats.leads.today} today</div>
        </div>

        <div className="stat-card admin-card">
          <div className="stat-top">
            <span className="stat-label">SMS SENT</span>
            <span className="stat-icon icon-admin-sms">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2"/></svg>
            </span>
          </div>
          <div className="stat-value">{stats.messages.total}</div>
          <div className="stat-change neutral">{stats.followups.pending} follow-ups pending</div>
        </div>

        <div className="stat-card admin-card">
          <div className="stat-top">
            <span className="stat-label">AVG SPEED-TO-LEAD</span>
            <span className="stat-icon icon-admin-speed">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
            </span>
          </div>
          <div className="stat-value">{formatMs(stats.leads.avgSpeedToLeadMs)}</div>
          <div className="stat-change positive">Platform-wide</div>
        </div>
      </div>

      <div className="admin-grid">
        <div className="card">
          <h3>Lead Conversion Summary</h3>
          <div className="admin-kpi-grid">
            <div className="kpi-item">
              <span className="kpi-value">{stats.leads.booked}</span>
              <span className="kpi-label">Booked</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-value">{stats.leads.qualified}</span>
              <span className="kpi-label">Qualified</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-value">{stats.leads.thisWeek}</span>
              <span className="kpi-label">Leads This Week</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-value">{stats.leads.unresponsive}</span>
              <span className="kpi-label">Unresponsive</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-value">{stats.followups.sent}</span>
              <span className="kpi-label">Follow-ups Sent</span>
            </div>
            <div className="kpi-item">
              <span className="kpi-value">{stats.followups.pending}</span>
              <span className="kpi-label">Follow-ups Pending</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Plan Distribution</h3>
          {stats.planBreakdown.length === 0 ? (
            <div className="empty-state"><p>No tenants yet</p></div>
          ) : (
            <div className="plan-breakdown">
              {stats.planBreakdown.map((p) => (
                <div key={p.plan} className="plan-row">
                  <span className="plan-name">{p.plan}</span>
                  <span className="plan-count">{p.count}</span>
                  <div className="plan-bar">
                    <div className="plan-fill" style={{ width: `${Math.max(8, (p.count / stats.tenants.total) * 100)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/admin/tenants" className="card-link">View all businesses &rarr;</Link>
        </div>
      </div>
    </div>
  );
}
