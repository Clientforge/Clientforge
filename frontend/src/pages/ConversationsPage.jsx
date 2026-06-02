import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { isSimpleMode } from '../utils/uiMode';

/** How often to pull new messages while a thread is open (inbound SMS is server-driven; no websocket yet). */
const THREAD_POLL_MS = 4000;

const STATUS_COLORS = {
  NEW: { bg: '#f3f4f6', color: '#6b7280' },
  CONTACTED: { bg: '#dbeafe', color: '#2563eb' },
  QUALIFYING: { bg: '#ede9fe', color: '#7c3aed' },
  QUALIFIED: { bg: '#fef3c7', color: '#d97706' },
  BOOKED: { bg: '#d1fae5', color: '#059669' },
  UNRESPONSIVE: { bg: '#fee2e2', color: '#dc2626' },
};

export default function ConversationsPage() {
  const { tenant } = useAuth();
  const simple = isSimpleMode(tenant);
  const [conversations, setConversations] = useState([]);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState(null);
  const [needsReplyFilter, setNeedsReplyFilter] = useState(false);
  const [selected, setSelected] = useState(null);
  const [thread, setThread] = useState(null);
  const [composeBody, setComposeBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiSaving, setAiSaving] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(search);
  searchRef.current = search;
  const needsReplyRef = useRef(needsReplyFilter);
  needsReplyRef.current = needsReplyFilter;

  const loadSummary = async () => {
    try {
      const data = await api.get('/conversations/summary');
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadConversations = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      if (needsReplyFilter) params.set('needsReply', 'true');
      const data = await api.get(`/conversations?${params}`);
      setConversations(data.conversations);
      setPagination(data.pagination || {});
      if (data.needsReplyCount !== undefined) {
        setSummary((prev) => ({ ...prev, needsReplyCount: data.needsReplyCount }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** User opened a thread from the sidebar — show loading state. */
  const openThread = async (participantType, participantId) => {
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
      loadSummary();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const updateAiOverride = async (value) => {
    if (!selected) return;
    let aiAutoReplyOverride = null;
    if (value === 'on') aiAutoReplyOverride = true;
    if (value === 'off') aiAutoReplyOverride = false;
    setAiSaving(true);
    try {
      const data = await api.patch(
        `/conversations/${selected.participantType}/${selected.participantId}/ai-reply`,
        { aiAutoReplyOverride },
      );
      setThread(data);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to update AI setting');
    } finally {
      setAiSaving(false);
    }
  };

  useEffect(() => {
    loadConversations(1);
    loadSummary();
  }, [search, needsReplyFilter]);

  // Poll open thread + inbox list so inbound SMS appears without refresh.
  useEffect(() => {
    if (!selected) return undefined;

    const { participantType, participantId } = selected;
    const page = pagination.page || 1;

    const refresh = async () => {
      try {
        const listParams = new URLSearchParams({ page: String(page), limit: '25' });
        const s = searchRef.current;
        if (s) listParams.set('search', s);
        if (needsReplyRef.current) listParams.set('needsReply', 'true');

        const [threadData, listData, summaryData] = await Promise.all([
          api.get(`/conversations/${participantType}/${participantId}`),
          api.get(`/conversations?${listParams}`),
          api.get('/conversations/summary'),
        ]);

        setThread(threadData);
        setConversations(listData.conversations);
        setPagination(listData.pagination || {});
        setSummary(summaryData);
      } catch (err) {
        console.error(err);
      }
    };

    const iv = setInterval(refresh, THREAD_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [selected, pagination.page, needsReplyFilter]);

  const formatTime = (d) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

  const formatPreview = (body, maxLen = 40) => {
    if (!body) return '';
    const t = body.replace(/\n/g, ' ').trim();
    return t.length > maxLen ? t.slice(0, maxLen) + '…' : t;
  };

  const needsReplyCount = summary?.needsReplyCount ?? 0;

  return (
    <div className="conversations-page">
      {simple && (
        <div className="inbox-hero">
          <div className="inbox-hero-main">
            <h1>Inbox</h1>
            <p className="inbox-hero-sub">
              {needsReplyCount > 0
                ? `${needsReplyCount} conversation${needsReplyCount === 1 ? '' : 's'} waiting for a reply`
                : 'All caught up — no messages waiting'}
            </p>
          </div>
          <div className="inbox-hero-stats">
            {summary?.appointmentsToday > 0 && (
              <div className="inbox-stat">
                <span className="inbox-stat-value">{summary.appointmentsToday}</span>
                <span className="inbox-stat-label">Today</span>
              </div>
            )}
            {summary?.totalConversations > 0 && (
              <div className="inbox-stat">
                <span className="inbox-stat-value">{summary.totalConversations}</span>
                <span className="inbox-stat-label">Total</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!simple && (
        <div className="page-header">
          <div>
            <h1>Conversations</h1>
            <p className="page-subtitle">SMS and missed-call text interactions in one place</p>
          </div>
        </div>
      )}

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
          <div className="inbox-filters">
            <button
              type="button"
              className={`inbox-filter-btn ${!needsReplyFilter ? 'active' : ''}`}
              onClick={() => setNeedsReplyFilter(false)}
            >
              All
            </button>
            <button
              type="button"
              className={`inbox-filter-btn ${needsReplyFilter ? 'active' : ''}`}
              onClick={() => setNeedsReplyFilter(true)}
            >
              Needs reply
              {needsReplyCount > 0 && <span className="inbox-filter-badge">{needsReplyCount}</span>}
            </button>
          </div>
          <div className="inbox-list">
            {loading ? (
              <div className="inbox-empty">Loading...</div>
            ) : conversations.length === 0 ? (
              <div className="inbox-empty">
                {needsReplyFilter ? 'No conversations waiting for a reply' : 'No conversations yet'}
              </div>
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
                    className={`inbox-item ${isSelected ? 'active' : ''}${c.needsReply ? ' needs-reply' : ''}`}
                    onClick={() => openThread(c.participantType, c.participantId)}
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
                          {c.needsReply && <span className="inbox-reply-dot" aria-hidden />}
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
              <p>{simple ? 'Select a conversation to reply' : 'Select a conversation to view and reply'}</p>
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
                        View {simple ? 'client' : 'contacts'} →
                      </Link>
                    )}
                  </div>
                  {thread.aiReply && (
                    <div className="inbox-ai-setting">
                      <label htmlFor="ai-reply-override">AI auto-reply</label>
                      <select
                        id="ai-reply-override"
                        value={
                          thread.participant.aiAutoReplyOverride === null ||
                          thread.participant.aiAutoReplyOverride === undefined
                            ? 'inherit'
                            : thread.participant.aiAutoReplyOverride
                              ? 'on'
                              : 'off'
                        }
                        onChange={(e) => updateAiOverride(e.target.value)}
                        disabled={aiSaving}
                      >
                        <option value="inherit">
                          Default ({thread.aiReply.tenantDefault ? 'on' : 'off'})
                        </option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </div>
                  )}
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
