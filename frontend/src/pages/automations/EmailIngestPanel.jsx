import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PARSE_STATUS_STYLES, formatDateTime } from './shared';

export default function EmailIngestPanel() {
  const [setup, setSetup] = useState(null);
  const [emails, setEmails] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [aliases, setAliases] = useState([]);
  const [savingAliases, setSavingAliases] = useState(false);
  const [aliasSaved, setAliasSaved] = useState(false);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const [setupData, emailData] = await Promise.all([
        api.get('/automations/booking-email-setup'),
        (async () => {
          const params = new URLSearchParams({ page, limit: 20 });
          if (statusFilter) params.set('parseStatus', statusFilter);
          return api.get(`/automations/booking-emails?${params}`);
        })(),
      ]);
      setSetup(setupData);
      setAliases(setupData.aliases || []);
      setEmails(emailData.emails);
      setPagination(emailData.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const loadDetail = async (id) => {
    setDetailLoading(true);
    setSelectedId(id);
    try {
      const data = await api.get(`/automations/booking-emails/${id}`);
      setDetail(data);
    } catch (err) {
      console.error(err);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const addAlias = () => {
    setAliases([...aliases, { alias: '', matchType: 'contains', priority: 10, active: true }]);
  };

  const updateAlias = (idx, field, value) => {
    const updated = [...aliases];
    updated[idx] = { ...updated[idx], [field]: value };
    setAliases(updated);
  };

  const removeAlias = (idx) => {
    setAliases(aliases.filter((_, i) => i !== idx));
  };

  const saveAliases = async () => {
    setSavingAliases(true);
    setAliasSaved(false);
    try {
      const updated = await api.put('/automations/booking-email-setup', { aliases });
      setSetup(updated);
      setAliases(updated.aliases || []);
      setAliasSaved(true);
      setTimeout(() => setAliasSaved(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingAliases(false);
    }
  };

  const copyInbox = () => {
    if (setup?.inboxEmail) navigator.clipboard.writeText(setup.inboxEmail);
  };

  if (loading && !setup) return <div className="page-loader">Loading email ingest...</div>;

  return (
    <div className="email-ingest-layout">
      <div className="settings-card email-setup-card">
        <h3>Booking Email Forwarding</h3>
        <p className="settings-desc">
          Forward booking confirmation emails to this address. We parse the appointment and trigger your automations.
        </p>

        <div className="integration-block">
          <label>Inbox address</label>
          <div className="key-row">
            <code className="key-value">{setup?.inboxEmail || 'info@clientforge-ai.com'}</code>
            <button type="button" className="btn-sm" onClick={copyInbox}>Copy</button>
          </div>
          <span className="field-hint">
            Set up auto-forwarding in Gmail/Outlook from your booking platform emails to this address.
          </span>
        </div>

        <hr className="settings-divider" />

        <div className="automation-section-header">
          <div>
            <h3>Business Name Aliases</h3>
            <p className="settings-desc">
              Help us match emails to your account. Your business name ({setup?.businessName || '—'}) is matched automatically.
              Add aliases if emails use a different name.
            </p>
          </div>
          {aliasSaved && <span className="save-badge">Saved</span>}
        </div>

        <div className="alias-list">
          {aliases.map((row, idx) => (
            <div key={row.id || idx} className="alias-row field-row">
              <div className="field" style={{ flex: 2 }}>
                <label>Alias</label>
                <input
                  value={row.alias}
                  onChange={(e) => updateAlias(idx, 'alias', e.target.value)}
                  placeholder="e.g. Glow Studio NYC"
                />
              </div>
              <div className="field" style={{ maxWidth: 130 }}>
                <label>Match</label>
                <select value={row.matchType || 'contains'} onChange={(e) => updateAlias(idx, 'matchType', e.target.value)}>
                  <option value="contains">Contains</option>
                  <option value="exact">Exact</option>
                </select>
              </div>
              <div className="field" style={{ maxWidth: 80 }}>
                <label>Priority</label>
                <input type="number" value={row.priority ?? 0} onChange={(e) => updateAlias(idx, 'priority', Number(e.target.value))} />
              </div>
              <button type="button" className="step-remove alias-remove" onClick={() => removeAlias(idx)}>Remove</button>
            </div>
          ))}
        </div>

        <button type="button" className="btn-secondary" onClick={addAlias}>+ Add alias</button>
        <div className="settings-actions">
          <button type="button" className="btn-primary" onClick={saveAliases} disabled={savingAliases}>
            {savingAliases ? 'Saving...' : 'Save Aliases'}
          </button>
        </div>
      </div>

      <div className="automation-split-view">
        <div className="automation-list-pane">
          <h3>Ingest Log</h3>
          <div className="filter-bar" style={{ marginBottom: 16 }}>
            {['', 'parsed', 'failed', 'needs_review'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s ? (PARSE_STATUS_STYLES[s]?.label || s) : 'All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="page-loader">Loading...</div>
          ) : emails.length === 0 ? (
            <div className="empty-state card"><p>No booking emails yet</p></div>
          ) : (
            <>
              <div className="card automation-record-list">
                {emails.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    className={`automation-record-item ${selectedId === e.id ? 'active' : ''}`}
                    onClick={() => loadDetail(e.id)}
                  >
                    <div className="record-item-top">
                      <strong>{e.subject || '(no subject)'}</strong>
                      <span className="status-badge" style={{
                        background: PARSE_STATUS_STYLES[e.parseStatus]?.bg || '#f3f4f6',
                        color: PARSE_STATUS_STYLES[e.parseStatus]?.color || '#6b7280',
                      }}>
                        {PARSE_STATUS_STYLES[e.parseStatus]?.label || e.parseStatus}
                      </span>
                    </div>
                    <div className="record-item-meta muted">
                      {formatDateTime(e.receivedAt || e.createdAt)}
                      {e.customerName ? ` · ${e.customerName}` : ''}
                    </div>
                    {e.errorMessage && <div className="record-error">{e.errorMessage}</div>}
                  </button>
                ))}
              </div>

              {pagination.totalPages > 1 && (
                <div className="pagination">
                  {Array.from({ length: pagination.totalPages }, (_, i) => (
                    <button key={i} type="button" className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`} onClick={() => load(i + 1)}>
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="automation-detail-pane card">
          {!selectedId ? (
            <div className="empty-state">
              <p>Select an email</p>
              <p className="muted">View parsed fields and raw content.</p>
            </div>
          ) : detailLoading ? (
            <div className="page-loader">Loading...</div>
          ) : !detail ? (
            <div className="empty-state"><p>Could not load email</p></div>
          ) : (
            <EmailDetail detail={detail} />
          )}
        </div>
      </div>
    </div>
  );
}

function EmailDetail({ detail }) {
  const parsed = detail.parsed || {};

  return (
    <div className="email-detail">
      <h3>{detail.subject || '(no subject)'}</h3>
      <div className="timeline-meta">
        <div><span className="muted">From</span> {detail.fromAddress || '—'}</div>
        <div><span className="muted">Received</span> {formatDateTime(detail.receivedAt || detail.createdAt)}</div>
        <div><span className="muted">Status</span> {detail.parseStatus}</div>
        {detail.appointmentId && <div><span className="muted">Appointment</span> Created</div>}
      </div>

      {detail.errorMessage && (
        <div className="error-msg" style={{ marginTop: 12 }}>{detail.errorMessage}</div>
      )}

      {parsed && Object.keys(parsed).length > 0 && (
        <>
          <hr className="settings-divider" />
          <h4>Parsed data</h4>
          <pre className="code-block parsed-json">{JSON.stringify(parsed, null, 2)}</pre>
        </>
      )}

      {detail.bodyText && (
        <>
          <hr className="settings-divider" />
          <h4>Email body</h4>
          <pre className="email-body-preview">{detail.bodyText.slice(0, 3000)}{detail.bodyText.length > 3000 ? '…' : ''}</pre>
        </>
      )}
    </div>
  );
}
