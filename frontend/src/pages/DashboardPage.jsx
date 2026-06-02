import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const BADGE_STYLES = {
  booked: { bg: '#d1fae5', color: '#059669' },
  pending: { bg: '#fef3c7', color: '#d97706' },
  ai_resolved: { bg: '#dbeafe', color: '#2563eb' },
  active: { bg: '#f3f4f6', color: '#6b7280' },
};

const ACTIVITY_ICONS = {
  phone: '📞',
  calendar: '📅',
  rebook: '🔄',
  ai: '✨',
  star: '⭐',
  message: '💬',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatApptTime(d, timeZone = 'America/New_York') {
  return new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
}

function initials(name) {
  const parts = (name || '?').trim().split(/\s+/);
  return (parts[0]?.[0] || '?') + (parts[1]?.[0] || '');
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState(null);

  const load = async () => {
    try {
      const overview = await api.get('/dashboard/overview');
      setData(overview);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleNudge = async (contactId) => {
    setNudging(contactId);
    try {
      await api.post(`/dashboard/win-back/${contactId}/nudge`);
      await load();
    } catch (err) {
      alert(err.message || 'Failed to send nudge');
    } finally {
      setNudging(null);
    }
  };

  if (loading) return <div className="page-loader">Loading dashboard...</div>;
  if (!data) return <div className="page-loader">Could not load dashboard</div>;

  const { impact, todayAppointments, recentConversations, liveActivity, winBack, timezone } = data;
  const displayTz = timezone || 'America/New_York';

  return (
    <div className="dashboard ops-dashboard">
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Automation impact and today&apos;s schedule</p>
        </div>
        <span className="live-badge"><span className="live-dot" /> Live</span>
      </div>

      <div className="ops-hero card">
        <div className="ops-hero-main">
          <span className="ops-hero-label">Automation impact this month</span>
          <div className="ops-hero-stats-inline">
            <div><strong>{impact.remindersSent}</strong> reminders sent</div>
            <div><strong>{impact.missedCallsCaptured}</strong> missed calls captured</div>
            <div><strong>{impact.winBackDueCount}</strong> clients due for win-back</div>
          </div>
        </div>
        <div className="ops-hero-side">
          <span className="ops-hero-big">{impact.appointmentsToday}</span>
          <span className="ops-hero-side-label">appointments today</span>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">MISSED CALLS</span>
            <span className="stat-icon icon-missed">📞</span>
          </div>
          <div className="stat-value">{impact.missedCallsCaptured}</div>
          <div className="stat-change neutral">Captured by AI this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">REMINDERS</span>
            <span className="stat-icon icon-reminders">🔔</span>
          </div>
          <div className="stat-value">{impact.remindersSent}</div>
          <div className="stat-change neutral">Sent this month</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">TODAY</span>
            <span className="stat-icon icon-booked">📅</span>
          </div>
          <div className="stat-value">{impact.appointmentsToday}</div>
          <div className="stat-change neutral">On the calendar</div>
        </div>
        <div className="stat-card">
          <div className="stat-top">
            <span className="stat-label">NEEDS REPLY</span>
            <span className="stat-icon icon-followup">💬</span>
          </div>
          <div className="stat-value">{impact.needsReplyCount}</div>
          <div className="stat-change neutral">
            <Link to="/conversations">Open inbox →</Link>
          </div>
        </div>
      </div>

      <div className="dashboard-grid ops-grid-main">
        <div className="card">
          <div className="card-header-row">
            <h3>Recent conversations</h3>
            <Link to="/conversations" className="card-link">See all</Link>
          </div>
          {recentConversations.length === 0 ? (
            <div className="empty-state">
              <p>No conversations yet</p>
              <span>Inbound texts and AI replies will show here</span>
            </div>
          ) : (
            <div className="ops-convo-list">
              {recentConversations.map((c) => (
                <Link
                  key={`${c.participantType}-${c.participantId}`}
                  to="/conversations"
                  className="ops-convo-row"
                >
                  <div className="ops-avatar">{initials(c.displayName)}</div>
                  <div className="ops-convo-body">
                    <div className="ops-convo-top">
                      <span className="ops-convo-name">{c.displayName}</span>
                      <span className="ops-convo-time">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="ops-convo-preview">{c.preview || '—'}</p>
                  </div>
                  <span
                    className="status-badge sm"
                    style={{
                      background: BADGE_STYLES[c.badge]?.bg,
                      color: BADGE_STYLES[c.badge]?.color,
                    }}
                  >
                    {c.badgeLabel}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header-row">
            <h3>Today&apos;s appointments</h3>
            <Link to="/automations" className="card-link">Automations</Link>
          </div>
          {todayAppointments.length === 0 ? (
            <div className="empty-state">
              <p>No appointments today</p>
              <span>Synced from Google Calendar or booking emails</span>
            </div>
          ) : (
            <div className="ops-appt-list">
              {todayAppointments.map((a) => (
                <div key={a.id} className="ops-appt-row">
                  <div className="ops-appt-time">{formatApptTime(a.scheduledAt, a.timezone || displayTz)}</div>
                  <div className="ops-appt-body">
                    <span className="ops-appt-name">{a.contactName}</span>
                    <span className="ops-appt-service">{a.serviceName || 'Appointment'}</span>
                  </div>
                  {a.automationLabel && (
                    <span className={`ops-appt-badge ${a.automationStatus || ''}`}>
                      {a.automationStatus === 'reminded' ? '✓ ' : ''}{a.automationLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid ops-grid-secondary">
        <div className="card">
          <div className="card-header-row">
            <h3>⚡ Live activity</h3>
          </div>
          {liveActivity.length === 0 ? (
            <div className="empty-state">
              <p>No recent activity</p>
              <span>Automations and AI actions will appear here</span>
            </div>
          ) : (
            <div className="ops-activity-list">
              {liveActivity.map((item) => (
                <div key={item.id} className="ops-activity-row">
                  <span className="ops-activity-icon">{ACTIVITY_ICONS[item.icon] || '💬'}</span>
                  <div className="ops-activity-body">
                    <p>{item.text}</p>
                    <span>{timeAgo(item.at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header-row">
            <h3>🚨 Win-back needed</h3>
            {impact.winBackDueCount > winBack.length && (
              <Link to="/contacts" className="card-link">View {impact.winBackDueCount} →</Link>
            )}
          </div>
          {winBack.length === 0 ? (
            <div className="empty-state">
              <p>All caught up</p>
              <span>Clients past their rebook interval will show here</span>
            </div>
          ) : (
            <div className="ops-winback-list">
              {winBack.map((w) => (
                <div key={w.contactId} className="ops-winback-row">
                  <div className="ops-avatar">{initials(w.displayName)}</div>
                  <div className="ops-winback-body">
                    <span className="ops-convo-name">{w.displayName}</span>
                    <span className="ops-winback-meta">
                      Last visit {w.daysSinceVisit} days ago · {w.serviceName || 'Service'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-nudge"
                    disabled={nudging === w.contactId}
                    onClick={() => handleNudge(w.contactId)}
                  >
                    {nudging === w.contactId ? 'Sending…' : 'Nudge'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
