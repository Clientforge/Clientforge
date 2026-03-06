import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUS_COLORS = {
  NEW: { bg: '#f3f4f6', color: '#6b7280' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb' },
  QUALIFYING: { bg: '#ede9fe', color: '#7c3aed' },
  QUALIFIED: { bg: '#fef3c7', color: '#d97706' },
  BOOKED: { bg: '#d1fae5', color: '#059669' },
  UNRESPONSIVE: { bg: '#fee2e2', color: '#dc2626' },
};

export default function LeadDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/leads/${id}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-loader">Loading lead...</div>;
  if (!data) return <div className="page-loader">Lead not found</div>;

  const { lead, messages, followUps } = data;
  const formatTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="lead-detail">
      <div className="detail-back">
        <Link to="/leads">&larr; Back to Leads</Link>
      </div>

      <div className="detail-header">
        <div className="detail-avatar">{(lead.firstName?.[0] || '?')}{(lead.lastName?.[0] || '')}</div>
        <div>
          <h1>{lead.firstName || 'Unknown'} {lead.lastName || ''}</h1>
          <div className="detail-meta">
            <span>{lead.phone}</span>
            {lead.email && <span>{lead.email}</span>}
            {lead.source && <span>Source: {lead.source}</span>}
          </div>
        </div>
        <span className="status-badge lg" style={{ background: STATUS_COLORS[lead.status]?.bg, color: STATUS_COLORS[lead.status]?.color }}>
          {lead.status}
        </span>
      </div>

      <div className="detail-stats">
        <div className="mini-stat">
          <span className="mini-label">Speed-to-Lead</span>
          <span className="mini-value">{lead.speedToLeadMs ? `${(lead.speedToLeadMs/1000).toFixed(1)}s` : '—'}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-label">Score</span>
          <span className="mini-value">{lead.qualificationScore}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-label">Follow-up Step</span>
          <span className="mini-value">{lead.followupStep}/7</span>
        </div>
        <div className="mini-stat">
          <span className="mini-label">Booking Link</span>
          <span className="mini-value">{lead.bookingLinkSent ? 'Sent' : 'Not sent'}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card conversation-card">
          <h3>Conversation</h3>
          <div className="messages-thread">
            {messages.length === 0 ? (
              <div className="empty-state"><p>No messages yet</p></div>
            ) : messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.direction}`}>
                <div className="msg-bubble">
                  <p>{msg.body}</p>
                  <span className="msg-time">{formatTime(msg.createdAt)}</span>
                </div>
                <span className="msg-type">{msg.messageType}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card followup-card">
          <h3>Follow-Up Schedule</h3>
          {followUps.length === 0 ? (
            <div className="empty-state"><p>No follow-ups</p></div>
          ) : (
            <div className="followup-list">
              {followUps.map((fu) => (
                <div key={fu.id} className={`followup-item ${fu.status}`}>
                  <div className="fu-step">Step {fu.step}</div>
                  <div className="fu-info">
                    <span className="fu-status">{fu.status}</span>
                    <span className="fu-time">
                      {fu.status === 'sent' ? `Sent ${formatTime(fu.sentAt)}` : formatTime(fu.scheduledAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
