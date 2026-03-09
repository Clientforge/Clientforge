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

export default function ConversationsPage() {
  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState({});
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [composeBody, setComposeBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  const loadConversations = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      const data = await api.get(`/conversations?${params}`);
      setConversations(data.conversations);
      setPagination(data.pagination || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (participantType, participantId) => {
    setThreadLoading(true);
    setThread(null);
    setSelected({ participantType, participantId });
    setComposeBody('');
    try {
      const data = await api.get(`/conversations/${participantType}/${participantId}`);
      setThread(data);
    } catch (err) {
      console.error(err);
    } finally {
      setThreadLoading(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!selected || !composeBody.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.post(
        `/conversations/${selected.participantType}/${selected.participantId}/messages`,
        { body: composeBody.trim() },
      );
      setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : null));
      setComposeBody('');
      loadConversations(pagination.page || 1);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    loadConversations(1);
  }, [search]);

  const formatTime = (d) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const formatPreview = (body, maxLen = 40) => {
    if (!body) return '';
    const t = body.replace(/\n/g, ' ').trim();
    return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
  };

  return (
    <div className="conversations-page">
      <div className="page-header">
        <div>
          <h1>Conversations</h1>
          <p className="page-subtitle">SMS and missed-call text interactions in one place</p>
        </div>
      </div>

      <div className="inbox-layout">
        <div className="inbox-sidebar">
          <div className="inbox-search">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="inbox-list">
            {loading ? (
              <div className="inbox-empty">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="inbox-empty">No conversations yet</div>
            ) : (
              conversations.map((c) => {
                const isSelected =
                  selected &&
                  selected.participantType === c.participantType &&
                  selected.participantId === c.participantId;
                return (
                  <button
                    key={`${c.participantType}-${c.participantId}`}
                    type="button"
                    className={`inbox-item ${isSelected ? 'active' : ''}`}
                    onClick={() => loadThread(c.participantType, c.participantId)}
                  >
                    <div className="inbox-avatar">
                      {(c.participant.firstName?.[0] || c.participant.phone?.[1] || '?')}
                    </div>
                    <div className="inbox-item-body">
                      <div className="inbox-item-top">
                        <span className="inbox-name">{c.participant.displayName || c.participant.phone}</span>
                        {c.lastMessage && (
                          <span className="inbox-time">{formatTime(c.lastMessage.createdAt)}</span>
                        )}
                      </div>
                      {c.lastMessage && (
                        <span className="inbox-preview">
                          {c.lastMessage.direction === 'inbound' ? '↩ ' : ''}
                          {formatPreview(c.lastMessage.body)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="inbox-main">
          {!selected ? (
            <div className="inbox-placeholder">
              <p>Select a conversation to view and reply</p>
            </div>
          ) : threadLoading ? (
            <div className="inbox-placeholder">Loading...</div>
          ) : thread ? (
            <>
              <div className="inbox-thread-header">
                <div className="inbox-thread-avatar">
                  {(thread.participant.firstName?.[0] || thread.participant.phone?.[1] || '?')}
                </div>
                <div className="inbox-thread-info">
                  <h3>{thread.participant.displayName || thread.participant.phone}</h3>
                  <div className="inbox-thread-meta">
                    <span>{thread.participant.phone}</span>
                    {thread.participant.status && (
                      <span
                        className="status-badge sm"
                        style={{
                          background: STATUS_COLORS[thread.participant.status]?.bg,
                          color: STATUS_COLORS[thread.participant.status]?.color,
                        }}
                      >
                        {thread.participant.status}
                      </span>
                    )}
                    {thread.participantType === 'lead' ? (
                      <Link to={`/leads/${thread.participant.id}`} className="inbox-link">
                        View lead →
                      </Link>
                    ) : (
                      <Link to="/contacts" className="inbox-link">
                        View contacts →
                      </Link>
                    )}
                  </div>
                </div>
              </div>

              <div className="inbox-messages">
                {thread.messages.length === 0 ? (
                  <div className="empty-state">
                    <p>No messages yet</p>
                  </div>
                ) : (
                  thread.messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.direction}`}>
                      <div className="msg-bubble">
                        <p>{msg.body}</p>
                        <span className="msg-time">{formatTime(msg.createdAt)}</span>
                      </div>
                      <span className="msg-type">{msg.messageType || '—'}</span>
                    </div>
                  ))
                )}
              </div>

              <form className="inbox-compose" onSubmit={sendReply}>
                <textarea
                  placeholder="Type your reply..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={2}
                  disabled={sending}
                />
                <button type="submit" className="btn-primary" disabled={!composeBody.trim() || sending}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div className="inbox-placeholder">Could not load conversation</div>
          )}
        </div>
      </div>
    </div>
  );
}
