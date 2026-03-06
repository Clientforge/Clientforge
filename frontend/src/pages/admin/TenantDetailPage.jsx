import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

function PhoneNumberEditor({ tenantId, value, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [phone, setPhone] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const { phoneNumber } = await api.patch(`/admin/tenants/${tenantId}`, { phoneNumber: phone.trim() || null });
      onSaved(phoneNumber);
      setEdit(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (edit) {
    return (
      <div className="config-edit-row">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+15551234567"
          className="config-edit-input"
          autoFocus
        />
        <button type="button" onClick={handleSave} className="btn btn-primary btn-sm" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={() => { setEdit(false); setPhone(value || ''); setError(''); }} className="btn btn-ghost btn-sm">
          Cancel
        </button>
        {error && <span className="config-edit-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="config-value-row">
      <span className="config-value">{value || 'Not set'}</span>
      <button type="button" onClick={() => setEdit(true)} className="btn btn-ghost btn-sm config-edit-btn">
        {value ? 'Edit' : 'Assign'}
      </button>
    </div>
  );
}

const STATUS_COLORS = {
  NEW: { bg: '#f3f4f6', color: '#6b7280' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb' },
  QUALIFYING: { bg: '#ede9fe', color: '#7c3aed' },
  QUALIFIED: { bg: '#fef3c7', color: '#d97706' },
  BOOKED: { bg: '#d1fae5', color: '#059669' },
  UNRESPONSIVE: { bg: '#fee2e2', color: '#dc2626' },
};

export default function TenantDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sendingWelcome, setSendingWelcome] = useState(false);
  const [welcomeSent, setWelcomeSent] = useState(false);

  const handleSendWelcome = async () => {
    setSendingWelcome(true);
    try {
      await api.post(`/admin/tenants/${id}/send-welcome-email`);
      setWelcomeSent(true);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to send welcome email');
    } finally {
      setSendingWelcome(false);
    }
  };

  useEffect(() => {
    api.get(`/admin/tenants/${id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loader">Loading tenant...</div>;
  if (!data) return <div className="page-loader">Tenant not found</div>;

  const { tenant, stats, users, recentLeads } = data;
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="tenant-detail">
      <div className="detail-back">
        <Link to="/admin/tenants">&larr; Back to Businesses</Link>
      </div>

      <div className="tenant-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="tenant-avatar">{tenant.name[0]}</div>
          <div>
            <h1>{tenant.name}</h1>
            <div className="detail-meta">
            <span className={`plan-badge plan-${tenant.plan}`}>{tenant.plan}</span>
            <span>{tenant.industry || 'No industry'}</span>
            <span>{tenant.timezone}</span>
            <span className={`status-dot ${tenant.active ? 'dot-active' : 'dot-inactive'}`}></span>
            <span>{tenant.active ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
        </div>
        <button
          type="button"
          onClick={handleSendWelcome}
          disabled={sendingWelcome || welcomeSent}
          className="btn btn-secondary btn-sm"
        >
          {sendingWelcome ? 'Sending...' : welcomeSent ? 'Welcome email sent' : 'Send welcome email'}
        </button>
      </div>

      <div className="detail-stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <div className="mini-stat"><span className="mini-label">Total Leads</span><span className="mini-value">{stats.totalLeads}</span></div>
        <div className="mini-stat"><span className="mini-label">Booked</span><span className="mini-value">{stats.booked}</span></div>
        <div className="mini-stat"><span className="mini-label">Qualified</span><span className="mini-value">{stats.qualified}</span></div>
        <div className="mini-stat"><span className="mini-label">Avg Speed</span><span className="mini-value">{stats.avgSpeedMs ? `${(stats.avgSpeedMs / 1000).toFixed(1)}s` : '—'}</span></div>
        <div className="mini-stat"><span className="mini-label">SMS Sent</span><span className="mini-value">{stats.totalMessages}</span></div>
      </div>

      <div className="detail-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="mini-stat"><span className="mini-label">Leads This Week</span><span className="mini-value">{stats.leadsThisWeek}</span></div>
        <div className="mini-stat"><span className="mini-label">Booking Links</span><span className="mini-value">{stats.bookingLinksSent}</span></div>
        <div className="mini-stat"><span className="mini-label">Follow-ups Sent</span><span className="mini-value">{stats.sentFollowups}</span></div>
        <div className="mini-stat"><span className="mini-label">Follow-ups Pending</span><span className="mini-value">{stats.pendingFollowups}</span></div>
      </div>

      <div className="admin-detail-grid">
        <div className="card">
          <h3>Team Members</h3>
          <div className="user-list">
            {users.map((u) => (
              <div key={u.id} className="user-row">
                <div className="user-avatar sm">{(u.firstName?.[0] || '')}{(u.lastName?.[0] || '')}</div>
                <div className="user-row-info">
                  <span className="user-row-name">{u.firstName} {u.lastName}</span>
                  <span className="user-row-email">{u.email}</span>
                </div>
                <span className="user-row-role">{u.role}</span>
                <span className="muted" style={{fontSize:'11px'}}>{u.lastLoginAt ? `Last login ${formatDate(u.lastLoginAt)}` : 'Never logged in'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3>Recent Leads</h3>
          {recentLeads.length === 0 ? (
            <div className="empty-state"><p>No leads yet</p></div>
          ) : (
            <div className="leads-list">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="lead-row" style={{cursor:'default'}}>
                  <div className="lead-avatar">{(lead.firstName?.[0] || '?')}{(lead.lastName?.[0] || '')}</div>
                  <div className="lead-info">
                    <span className="lead-name">{lead.firstName || 'Unknown'} {lead.lastName || ''}</span>
                    <span className="lead-source">{lead.source || 'Direct'}</span>
                  </div>
                  <span className="status-badge" style={{ background: STATUS_COLORS[lead.status]?.bg, color: STATUS_COLORS[lead.status]?.color }}>
                    {lead.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{marginTop: '20px'}}>
        <h3>Configuration</h3>
        <div className="config-grid">
          <div><span className="config-label">Booking Link</span><span className="config-value">{tenant.bookingLink || 'Not set'}</span></div>
          <div>
            <span className="config-label">SMS Phone Number</span>
            <PhoneNumberEditor tenantId={tenant.id} value={tenant.phoneNumber} onSaved={(v) => setData((d) => ({ ...d, tenant: { ...d.tenant, phoneNumber: v } }))} />
          </div>
          <div><span className="config-label">API Key</span><span className="config-value mono">{tenant.apiKey || 'Not generated'}</span></div>
          <div><span className="config-label">Signed Up</span><span className="config-value">{formatDate(tenant.createdAt)}</span></div>
        </div>
      </div>
    </div>
  );
}
