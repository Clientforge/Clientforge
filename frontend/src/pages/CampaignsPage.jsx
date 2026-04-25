import { useState, useEffect } from 'react';
import { api } from '../api/client';

const STATUS_STYLES = {
  draft: { bg: '#f3f4f6', color: '#6b7280' },
  sending: { bg: '#dbeafe', color: '#2563eb' },
  completed: { bg: '#d1fae5', color: '#059669' },
  paused: { bg: '#fef3c7', color: '#d97706' },
};

const CHANNEL_LABELS = { sms: 'SMS Only', email: 'Email Only', both: 'SMS + Email' };
const CHANNEL_ICONS = {
  sms: <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  email: <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>,
  both: <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [linkClicksModal, setLinkClicksModal] = useState(null);

  const loadCampaigns = async (page = 1) => {
    setLoading(true);
    try {
      const [data, statsData] = await Promise.all([
        api.get(`/campaigns?page=${page}&limit=20`),
        api.get('/campaigns/stats'),
      ]);
      setCampaigns(data.campaigns);
      setPagination(data.pagination);
      setStats(statsData);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="campaigns-page">
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p className="page-subtitle">Re-engage past customers with targeted multi-wave sequences</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Campaign</button>
      </div>

      <div className="stats-row">
        <div className="mini-stat"><span className="mini-stat-value">{stats.total || 0}</span><span className="mini-stat-label">Total Campaigns</span></div>
        <div className="mini-stat"><span className="mini-stat-value">{stats.sending || 0}</span><span className="mini-stat-label">Active</span></div>
        <div className="mini-stat"><span className="mini-stat-value">{stats.total_sent || 0}</span><span className="mini-stat-label">Messages Sent</span></div>
        <div className="mini-stat"><span className="mini-stat-value">{stats.total_replies || 0}</span><span className="mini-stat-label">Replies</span></div>
      </div>

      <div className="card">
        {loading ? (
          <div className="page-loader">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="48" height="48" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p>No campaigns yet</p>
            <p className="muted">Create your first campaign to re-engage past customers</p>
          </div>
        ) : (
          <table className="leads-table">
            <thead>
              <tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Replies</th><th>Link clicks</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow
                  key={c.id}
                  campaign={c}
                  formatDate={formatDate}
                  onRefresh={loadCampaigns}
                  onOpenLinkClicks={(camp) => setLinkClicksModal({ id: camp.id, name: camp.name })}
                />
              ))}
            </tbody>
          </table>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination">
            {Array.from({ length: pagination.totalPages }, (_, i) => (
              <button key={i} className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`} onClick={() => loadCampaigns(i + 1)}>{i + 1}</button>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onSuccess={() => { setShowCreate(false); loadCampaigns(); }} />}
      {linkClicksModal && (
        <LinkClicksModal
          campaignId={linkClicksModal.id}
          campaignName={linkClicksModal.name}
          formatDate={formatDate}
          onClose={() => setLinkClicksModal(null)}
        />
      )}
    </div>
  );
}

function CampaignRow({ campaign, formatDate, onRefresh, onOpenLinkClicks }) {
  const [launching, setLaunching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [audiencePreview, setAudiencePreview] = useState(null);
  const s = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;

  const unique = campaign.linkUniqueClicks ?? 0;
  const total = campaign.linkTotalClicks ?? 0;

  const handleExpand = async () => {
    if (!expanded) {
      try { setDetail(await api.get(`/campaigns/${campaign.id}`)); } catch (err) { console.error(err); }
    }
    setExpanded(!expanded);
  };

  const handleLaunch = async () => {
    const waveCount = (campaign.schedule || []).length || 1;
    const ch = CHANNEL_LABELS[campaign.channel] || 'SMS';
    const tagNote = campaign.audienceFilter?.tag
      ? ` Tag: "${campaign.audienceFilter.tag}".`
      : '';
    const msg = `Launch "${campaign.name}"? ${waveCount} wave(s) via ${ch} to all matching contacts.${tagNote} Use Preview to see the list.`;
    if (!window.confirm(msg)) return;
    setLaunching(true);
    try { await api.post(`/campaigns/${campaign.id}/launch`); onRefresh(); }
    catch (err) { alert(err.message); }
    finally { setLaunching(false); }
  };

  const waveCount = (campaign.schedule || []).length;
  const ch = campaign.channel || 'sms';

  return (
    <>
      <tr className="campaign-row" onClick={handleExpand}>
        <td>
          <div className="campaign-name">{campaign.name}</div>
          <div className="campaign-type muted">{waveCount > 1 ? `${waveCount}-wave sequence` : 'Single broadcast'}</div>
        </td>
        <td><span className={`channel-badge ch-${ch}`}>{CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}</span></td>
        <td><span className="status-badge" style={{ background: s.bg, color: s.color }}>{campaign.status}</span></td>
        <td>{campaign.totalRecipients}</td>
        <td>{campaign.sentCount}</td>
        <td>{campaign.replyCount}</td>
        <td>
          <div
            className="link-clicks-cell"
            title={total > unique ? `${total} total taps · ${unique} people` : unique > 0 ? `${unique} people clicked` : undefined}
          >
            {unique > 0 ? (
              <button
                type="button"
                className="link-clicks-trigger"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenLinkClicks(campaign);
                }}
              >
                {unique}
                <span className="link-clicks-people-label"> people</span>
              </button>
            ) : (
              <span className="muted">0</span>
            )}
            {total > unique && unique > 0 && (
              <div className="muted link-clicks-taps-hint">{total} taps</div>
            )}
          </div>
        </td>
        <td className="muted">{formatDate(campaign.createdAt)}</td>
        <td onClick={(e) => e.stopPropagation()}>
          {campaign.status === 'draft' && (
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => setAudiencePreview({ id: campaign.id, name: campaign.name })}
              >
                Recipients
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={handleLaunch}
                disabled={launching}
              >
                {launching ? 'Launching...' : 'Launch'}
              </button>
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="campaign-detail-row"><td colSpan="9"><CampaignDetail campaign={detail || campaign} formatDate={formatDate} /></td></tr>
      )}
      {audiencePreview && (
        <AudiencePreviewModal
          onClose={() => setAudiencePreview(null)}
          title={`Recipients · ${audiencePreview.name}`}
          campaignId={audiencePreview.id}
          channel={campaign.channel}
        />
      )}
    </>
  );
}

function CampaignDetail({ campaign, formatDate }) {
  const schedule = campaign.schedule || [];
  const waveStats = campaign.waveStats || [];
  const ch = campaign.channel || 'sms';
  const showEmail = ch === 'email' || ch === 'both';
  const showSms = ch === 'sms' || ch === 'both';

  return (
    <div className="campaign-detail">
      <div className="detail-channel-label">
        <span className={`channel-badge ch-${ch}`}>{CHANNEL_ICONS[ch]} {CHANNEL_LABELS[ch]}</span>
      </div>
      {campaign.audienceFilter?.tag ? (
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>
          Audience tag: <strong>{campaign.audienceFilter.tag}</strong>
        </p>
      ) : (
        <p className="muted" style={{ margin: '0.35rem 0 0' }}>Audience: all eligible contacts (no tag filter)</p>
      )}

      {schedule.length > 0 && (
        <div className="wave-timeline">
          <h4>Sequence Timeline</h4>
          <div className="waves">
            {schedule.map((wave, i) => {
              const stats = waveStats.filter((w) => w.step === wave.step);
              const smsStats = stats.find((s) => s.channel === 'sms') || {};
              const emailStats = stats.find((s) => s.channel === 'email') || {};
              const combined = stats.length === 0 ? null : {
                total: (smsStats.total || 0) + (emailStats.total || 0),
                sent: (smsStats.sent || 0) + (emailStats.sent || 0),
                pending: (smsStats.pending || 0) + (emailStats.pending || 0),
                skipped: (smsStats.skipped || 0) + (emailStats.skipped || 0),
              };
              const pct = combined && combined.total > 0 ? Math.round((combined.sent / combined.total) * 100) : 0;

              return (
                <div key={i} className="wave-card">
                  <div className="wave-header">
                    <span className="wave-number">Wave {wave.step}</span>
                    <span className="wave-timing">{wave.delay_days === 0 ? 'Immediate' : `Day ${wave.delay_days}`}</span>
                  </div>
                  {showSms && wave.message && (
                    <div className="wave-msg-block">
                      <span className="msg-channel-label">SMS</span>
                      <div className="wave-message">{wave.message}</div>
                    </div>
                  )}
                  {showEmail && (wave.email_body || wave.message) && (
                    <div className="wave-msg-block">
                      <span className="msg-channel-label">Email</span>
                      {wave.email_subject && <div className="wave-email-subject">Subject: {wave.email_subject}</div>}
                      <div className="wave-message">{wave.email_body || wave.message}</div>
                    </div>
                  )}
                  {combined && (
                    <div className="wave-progress">
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                      <div className="wave-stats-row">
                        <span>{combined.sent} sent</span>
                        <span>{combined.pending} pending</span>
                        <span>{combined.skipped} skipped</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="campaign-meta">
        {campaign.launchedAt && <span>Launched: {formatDate(campaign.launchedAt)}</span>}
        {campaign.completedAt && <span>Completed: {formatDate(campaign.completedAt)}</span>}
        <span>Sent: {campaign.sentCount}</span>
        <span>Failed: {campaign.failedCount}</span>
        <span>Replies: {campaign.replyCount}</span>
        {(campaign.linkUniqueClicks > 0 || campaign.linkTotalClicks > 0) && (
          <span title={campaign.linkTotalClicks > campaign.linkUniqueClicks ? `${campaign.linkTotalClicks} total link taps` : undefined}>
            Link clicks: {campaign.linkUniqueClicks ?? 0} people
            {(campaign.linkTotalClicks ?? 0) > (campaign.linkUniqueClicks ?? 0) &&
              ` (${campaign.linkTotalClicks} taps)`}
          </span>
        )}
        <span>Opted out: {campaign.optoutCount}</span>
      </div>
    </div>
  );
}

function LinkClicksModal({ campaignId, campaignName, formatDate, onClose }) {
  const [clicks, setClicks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get(`/campaigns/${campaignId}/link-clicks`);
        if (!cancelled) setClicks(data.clicks || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load clicks');
      }
    })();
    return () => { cancelled = true; };
  }, [campaignId]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal link-clicks-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Link clicks · {campaignName}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          {clicks === null && !error && <div className="page-loader">Loading…</div>}
          {clicks && clicks.length === 0 && <p className="muted">No attributed clicks yet.</p>}
          {clicks && clicks.length > 0 && (
            <div className="link-clicks-table-wrap">
              <table className="link-clicks-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Clicks</th>
                    <th>Last clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {clicks.map((row) => {
                    const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '—';
                    return (
                      <tr key={row.contactId}>
                        <td>{name}</td>
                        <td>{row.phone || '—'}</td>
                        <td>{row.clickCount}</td>
                        <td className="muted">{formatDate(row.lastClickedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CHANNEL_RECIPIENT_HINT = {
  sms: 'Requires phone number. Unsubscribed contacts are excluded.',
  email: 'Requires email. Unsubscribed contacts are excluded.',
  both: 'Requires both phone and email. Unsubscribed contacts are excluded.',
};

/**
 * Fetches the same audience as campaign launch: optional tag, channel address requirements.
 * Pass either campaignId (saved draft) or audienceFilter + channel (composer).
 */
function AudiencePreviewModal({ onClose, title, campaignId, audienceFilter, channel }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const ch = channel || 'sms';
  const filterKey = campaignId != null ? `c:${campaignId}` : `f:${JSON.stringify(audienceFilter || {})}:${ch}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData(null);
      setError('');
      try {
        const payload = campaignId
          ? await api.get(`/campaigns/${campaignId}/preview-audience`)
          : await api.post('/campaigns/preview-audience', {
            audienceFilter: audienceFilter || {},
            channel: ch,
          });
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load recipients');
      }
    })();
    return () => { cancelled = true; };
  }, [filterKey, campaignId, ch]);

  const showPhone = ch === 'sms' || ch === 'both';
  const showEmail = ch === 'email' || ch === 'both';

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal modal-lg audience-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title || 'Recipients'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc" style={{ marginTop: 0 }}>{CHANNEL_RECIPIENT_HINT[ch] || CHANNEL_RECIPIENT_HINT.sms}</p>
          {error && <div className="form-error">{error}</div>}
          {data === null && !error && <div className="page-loader">Loading recipients…</div>}
          {data && (
            <>
              <p className="audience-preview-total">
                <strong>{data.total}</strong> contact{data.total === 1 ? '' : 's'}
                {data.truncated ? ` (showing first ${data.contacts.length})` : ''} match.
              </p>
              {data.total === 0 && <p className="muted">No one matches. Adjust the tag or add contacts with the required address fields.</p>}
              {data.contacts && data.contacts.length > 0 && (
                <div className="link-clicks-table-wrap audience-preview-table-wrap">
                  <table className="link-clicks-table audience-preview-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        {showPhone && <th>Phone</th>}
                        {showEmail && <th>Email</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.contacts.map((row) => {
                        const name = [row.firstName, row.lastName].filter(Boolean).join(' ') || '—';
                        return (
                          <tr key={row.id}>
                            <td>{name}</td>
                            {showPhone && <td className="audience-mono">{row.phone || '—'}</td>}
                            {showEmail && <td>{row.email || '—'}</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const START_MODE = { scratch: 'scratch', copy: 'copy', template: 'template' };

function CreateCampaignModal({ onClose, onSuccess }) {
  const [startMode, setStartMode] = useState(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState({ name: '', channel: 'sms', schedule: [], audienceFilter: {} });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiForm, setAiForm] = useState({ promotionDetails: '', audienceDescription: '', waveCount: 4 });
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [contactTags, setContactTags] = useState([]);
  const [audiencePreviewOpen, setAudiencePreviewOpen] = useState(false);

  const showSms = form.channel === 'sms' || form.channel === 'both';
  const showEmail = form.channel === 'email' || form.channel === 'both';

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/contacts/tags');
        setContactTags(d.tags || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const loadCampaigns = async () => {
    try {
      const data = await api.get('/campaigns?limit=50');
      setCampaigns(data.campaigns || []);
    } catch (err) { console.error(err); }
  };

  const loadTemplates = async () => {
    try {
      const data = await api.get('/campaigns/templates');
      setTemplates(data.templates || []);
    } catch (err) { console.error(err); }
  };

  const handleCopyFromCampaign = async (campaignId) => {
    setLoadingSource(true);
    setError('');
    try {
      const c = await api.get(`/campaigns/${campaignId}`);
      setForm({
        name: `${c.name} (Copy)`,
        channel: c.channel || 'sms',
        schedule: (c.schedule || []).map((w, i) => ({ ...w, step: i + 1 })),
        audienceFilter: c.audienceFilter || {},
      });
      setStartMode(START_MODE.copy);
      setWizardStep(2);
    } catch (err) { setError(err.message); }
    finally { setLoadingSource(false); }
  };

  const handleUseTemplate = (template) => {
    setForm({
      name: template.name,
      channel: template.channel || 'sms',
      schedule: (template.schedule || []).map((w, i) => ({ ...w, step: i + 1 })),
      audienceFilter: template.audienceFilter || {},
    });
    setStartMode(START_MODE.template);
    setWizardStep(2);
  };

  const generateSequence = async () => {
    if (!form.name) { setError('Enter a campaign name first'); return; }
    setGenerating(true);
    setError('');
    try {
      const data = await api.post('/campaigns/generate-sequence', {
        campaignName: form.name,
        promotionDetails: aiForm.promotionDetails,
        audienceDescription: aiForm.audienceDescription,
        waveCount: aiForm.waveCount,
        channel: form.channel,
      });
      setForm({ ...form, schedule: data.sequence });
      setWizardStep(2);
    } catch (err) { setError(err.message); }
    finally { setGenerating(false); }
  };

  const handleSave = async () => {
    if (!form.name) { setError('Campaign name is required'); return; }
    if (form.schedule.length === 0) { setError('Add at least one wave'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/campaigns', form);
      if (saveAsTemplate) {
        const name = templateName.trim() || form.name;
        await api.post('/campaigns/templates', {
          name,
          channel: form.channel,
          schedule: form.schedule,
          audienceFilter: form.audienceFilter,
        });
      }
      onSuccess();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const updateWave = (index, field, value) => {
    const updated = [...form.schedule];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, schedule: updated });
  };

  const addWave = () => {
    const lastDelay = form.schedule.length > 0 ? form.schedule[form.schedule.length - 1].delay_days : 0;
    setForm({
      ...form,
      schedule: [
        ...form.schedule,
        { step: form.schedule.length + 1, delay_days: lastDelay + 3, message: '', email_subject: '', email_body: '' },
      ],
    });
  };

  const removeWave = (index) => {
    setForm({ ...form, schedule: form.schedule.filter((_, i) => i !== index).map((w, i) => ({ ...w, step: i + 1 })) });
  };

  const previewMsg = (msg) =>
    (msg || '').replace(/\{firstName\}/gi, 'Sarah').replace(/\{businessName\}/gi, 'Your Business').replace(/\{bookingLink\}/gi, 'book.example.com');

  return (
    <>
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Campaign</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="wizard-steps">
            <div className={`wizard-step ${startMode !== null ? 'active' : ''}`}>1. Start</div>
            <div className={`wizard-step ${wizardStep >= 2 ? 'active' : ''}`}>2. Sequence</div>
            <div className={`wizard-step ${wizardStep >= 3 ? 'active' : ''}`}>3. Review</div>
          </div>

          {/* Step 0: Choose how to start */}
          {startMode === null && wizardStep === 1 && (
            <div className="wizard-content">
              {campaigns.length > 0 || templates.length > 0 ? (
                <div className="source-list">
                  <h4>{campaigns.length > 0 ? 'Select a campaign to copy' : 'Select a template'}</h4>
                  <div className="source-list-items">
                      {campaigns.length > 0
                        ? campaigns.map((c) => (
                            <button key={c.id} type="button" className="source-item" onClick={() => handleCopyFromCampaign(c.id)} disabled={loadingSource}>
                              <span className="source-item-name">{c.name}</span>
                              <span className="source-item-meta">{CHANNEL_LABELS[c.channel]} · {(c.schedule || []).length} waves</span>
                            </button>
                          ))
                        : templates.map((t) => (
                            <button key={t.id} type="button" className="source-item" onClick={() => handleUseTemplate(t)}>
                              <span className="source-item-name">{t.name}</span>
                              <span className="source-item-meta">{CHANNEL_LABELS[t.channel]} · {(t.schedule || []).length} waves</span>
                            </button>
                          ))}
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setCampaigns([]); setTemplates([]); }}>← Back</button>
                </div>
              ) : (
                <>
                  <h3 className="start-section-title">How would you like to start?</h3>
                  <div className="start-options">
                    <button type="button" className="start-option-card" onClick={() => setStartMode(START_MODE.scratch)}>
                      <span className="start-option-icon">✏️</span>
                      <span className="start-option-label">Create from scratch</span>
                      <span className="start-option-hint">Build a new campaign with AI or write your own</span>
                    </button>
                    <button type="button" className="start-option-card" onClick={async () => { setTemplates([]); await loadCampaigns(); }}>
                      <span className="start-option-icon">📋</span>
                      <span className="start-option-label">Copy from campaign</span>
                      <span className="start-option-hint">Reuse a previous campaign and make edits</span>
                    </button>
                    <button type="button" className="start-option-card" onClick={async () => { setCampaigns([]); await loadTemplates(); }}>
                      <span className="start-option-icon">📁</span>
                      <span className="start-option-label">Use a template</span>
                      <span className="start-option-hint">Start from a saved template</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 1: Details (only when Create from scratch) */}
          {startMode === START_MODE.scratch && wizardStep === 1 && (
            <div className="wizard-content">
              <div className="form-group">
                <label>Campaign Name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spring Promo 2026" />
              </div>

              <div className="form-group">
                <label>Delivery Channel</label>
                <div className="channel-selector">
                  {['sms', 'email', 'both'].map((ch) => (
                    <button key={ch} type="button" className={`channel-option ${form.channel === ch ? 'active' : ''}`} onClick={() => setForm({ ...form, channel: ch })}>
                      {CHANNEL_ICONS[ch]}
                      <span>{CHANNEL_LABELS[ch]}</span>
                    </button>
                  ))}
                </div>
                <span className="hint">
                  {form.channel === 'sms' && 'Short text messages sent to contact phone numbers'}
                  {form.channel === 'email' && 'Emails sent to contact email addresses'}
                  {form.channel === 'both' && 'Every wave sends both an SMS and an email to each contact'}
                </span>
              </div>

              <div className="ai-generate-section">
                <h3>Generate Sequence with AI</h3>
                <p className="hint">Describe your promotion and AI will create a multi-wave {CHANNEL_LABELS[form.channel]} sequence</p>
                <div className="form-group">
                  <label>What's the promotion or offer?</label>
                  <textarea value={aiForm.promotionDetails} onChange={(e) => setAiForm({ ...aiForm, promotionDetails: e.target.value })} placeholder="e.g. 20% off this weekend, free consultation..." rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Target Audience</label>
                    <input type="text" value={aiForm.audienceDescription} onChange={(e) => setAiForm({ ...aiForm, audienceDescription: e.target.value })} placeholder="e.g. Past customers, VIP clients" />
                  </div>
                  <div className="form-group">
                    <label>Number of Waves</label>
                    <select value={aiForm.waveCount} onChange={(e) => setAiForm({ ...aiForm, waveCount: parseInt(e.target.value) })}>
                      <option value={2}>2 waves</option>
                      <option value={3}>3 waves</option>
                      <option value={4}>4 waves</option>
                    </select>
                  </div>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" onClick={() => {
                    if (form.schedule.length === 0) setForm({ ...form, schedule: [{ step: 1, delay_days: 0, message: '', email_subject: '', email_body: '' }] });
                    setWizardStep(2);
                  }}>Skip — I'll write my own</button>
                  <button className="btn btn-ai" onClick={generateSequence} disabled={generating || !form.name}>
                    {generating ? <><span className="ai-spinner" /> Generating...</> : 'Generate Sequence with AI'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Sequence Editor */}
          {wizardStep === 2 && (
            <div className="wizard-content">
              <div className="sequence-editor">
                {form.schedule.map((wave, i) => (
                  <div key={i} className="wave-editor-card">
                    <div className="wave-editor-header">
                      <div className="wave-label"><span className="wave-dot" /> Wave {wave.step}</div>
                      <div className="wave-editor-controls">
                        <div className="delay-picker">
                          <label>Delay:</label>
                          <select value={wave.delay_days} onChange={(e) => updateWave(i, 'delay_days', parseInt(e.target.value))}>
                            <option value={0}>Immediate</option>
                            <option value={1}>1 day</option>
                            <option value={2}>2 days</option>
                            <option value={3}>3 days</option>
                            <option value={5}>5 days</option>
                            <option value={7}>7 days</option>
                            <option value={10}>10 days</option>
                            <option value={14}>14 days</option>
                          </select>
                        </div>
                        {form.schedule.length > 1 && (
                          <button className="wave-remove" onClick={() => removeWave(i)} title="Remove wave">&times;</button>
                        )}
                      </div>
                    </div>

                    {showSms && (
                      <div className="wave-field-group">
                        <label className="wave-field-label">
                          {CHANNEL_ICONS.sms} SMS Message
                        </label>
                        <textarea
                          value={wave.message}
                          onChange={(e) => updateWave(i, 'message', e.target.value)}
                          placeholder="Short SMS message..."
                          rows={2}
                        />
                        <div className="char-count" style={{ color: (wave.message || '').length > 155 ? '#dc2626' : '#94a3b8' }}>
                          {(wave.message || '').length}/155
                        </div>
                      </div>
                    )}

                    {showEmail && (
                      <div className="wave-field-group">
                        <label className="wave-field-label">
                          {CHANNEL_ICONS.email} Email
                        </label>
                        <input
                          type="text"
                          value={wave.email_subject || ''}
                          onChange={(e) => updateWave(i, 'email_subject', e.target.value)}
                          placeholder="Email subject line..."
                          className="email-subject-input"
                        />
                        <textarea
                          value={wave.email_body || (form.channel === 'email' ? wave.message : '')}
                          onChange={(e) => updateWave(i, form.channel === 'email' ? 'message' : 'email_body', e.target.value)}
                          placeholder="Email body (can be longer and more detailed)..."
                          rows={4}
                        />
                      </div>
                    )}

                    {wave.message && showSms && (
                      <div className="sms-mini-preview">
                        <span className="preview-label">SMS Preview:</span> {previewMsg(wave.message)}
                      </div>
                    )}
                  </div>
                ))}

                {form.schedule.length < 6 && (
                  <button className="add-wave-btn" onClick={addWave}>+ Add Wave</button>
                )}
              </div>

              <div className="audience-campaign-block" style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
                <h4 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Audience</h4>
                <p className="hint" style={{ marginBottom: '0.75rem' }}>
                  Optional tag: only matching contacts are included. Leave empty for everyone who can receive
                  {form.channel === 'sms' && ' SMS (has phone)'}
                  {form.channel === 'email' && ' email (has address)'}
                  {form.channel === 'both' && ' both SMS and email (has phone and email)'}
                  . Unsubscribed contacts are always excluded.
                </p>
                <div className="form-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <div className="form-group" style={{ flex: '1 1 12rem' }}>
                    <label>Filter by tag</label>
                    <input
                      type="text"
                      list="campaign-audience-tag-list"
                      value={form.audienceFilter?.tag || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm({ ...form, audienceFilter: v.trim() ? { tag: v.trim() } : {} });
                      }}
                      placeholder="e.g. vip, returning"
                    />
                    <datalist id="campaign-audience-tag-list">
                      {contactTags.map((t) => <option key={t} value={t} />)}
                    </datalist>
                  </div>
                  <button type="button" className="btn btn-ghost" onClick={() => setAudiencePreviewOpen(true)}>
                    Preview recipients
                  </button>
                </div>
              </div>

              <div className="template-vars" style={{ marginTop: 12 }}>
                <span className="hint">Variables: </span>
                <code>{'{firstName}'}</code>
                <code>{'{businessName}'}</code>
                <code>{'{bookingLink}'}</code>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => {
                  if (startMode === START_MODE.scratch) setWizardStep(1);
                  else { setStartMode(null); setWizardStep(1); setCampaigns([]); setTemplates([]); }
                }}>Back</button>
                <button className="btn btn-ai" onClick={() => setWizardStep(1)} disabled={generating}>Regenerate with AI</button>
                <button className="btn btn-primary" onClick={() => {
                  const hasEmpty = form.schedule.some((w) => {
                    if (showSms && !(w.message || '').trim()) return true;
                    if (form.channel === 'email' && !(w.message || '').trim()) return true;
                    if (form.channel === 'both' && !(w.email_body || '').trim()) return true;
                    return false;
                  });
                  if (hasEmpty) { setError('All waves must have a message'); return; }
                  setError('');
                  setWizardStep(3);
                }}>Next: Review</button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {wizardStep === 3 && (
            <div className="wizard-content">
              <div className="review-section">
                <h3>{form.name}</h3>
                <div className="review-meta">
                  <span className={`channel-badge ch-${form.channel}`}>{CHANNEL_ICONS[form.channel]} {CHANNEL_LABELS[form.channel]}</span>
                  <span className="muted">{form.schedule.length}-wave {form.schedule.length > 1 ? 'sequence' : 'broadcast'}</span>
                </div>
                {form.audienceFilter?.tag ? (
                  <p style={{ margin: '0.5rem 0 0' }}>
                    Tag filter: <strong>{form.audienceFilter.tag}</strong>
                    {' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAudiencePreviewOpen(true)}>Preview recipients</button>
                  </p>
                ) : (
                  <p className="muted" style={{ margin: '0.5rem 0 0' }}>
                    Audience: all eligible contacts (no tag)
                    {' '}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAudiencePreviewOpen(true)}>Preview recipients</button>
                  </p>
                )}
              </div>

              <div className="review-timeline">
                {form.schedule.map((wave, i) => (
                  <div key={i} className="review-wave">
                    <div className="review-wave-header">
                      <span className="wave-dot" />
                      <span className="wave-number">Wave {wave.step}</span>
                      <span className="wave-timing">{wave.delay_days === 0 ? 'Sent immediately' : `Day ${wave.delay_days}`}</span>
                    </div>
                    {showSms && wave.message && (
                      <div className="review-msg-block">
                        <span className="msg-channel-label">SMS</span>
                        <div className="sms-bubble">{previewMsg(wave.message)}</div>
                      </div>
                    )}
                    {showEmail && (
                      <div className="review-msg-block">
                        <span className="msg-channel-label">Email</span>
                        {wave.email_subject && <div className="review-email-subject">Subject: {previewMsg(wave.email_subject)}</div>}
                        <div className="email-bubble">{previewMsg(wave.email_body || wave.message)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="review-note">
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
                <span>If a contact replies, remaining waves are skipped. Unsubscribed contacts are never messaged.</span>
              </div>

              <div className="save-as-template-row">
                <label className="save-template-check">
                  <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                  <span>Save as template for future campaigns</span>
                </label>
                {saveAsTemplate && (
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Template name (e.g. Monthly Promo)"
                    className="template-name-input"
                  />
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setWizardStep(2)}>Edit Sequence</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    {audiencePreviewOpen && (
      <AudiencePreviewModal
        onClose={() => setAudiencePreviewOpen(false)}
        title="Recipients (preview)"
        audienceFilter={form.audienceFilter}
        channel={form.channel}
      />
    )}
    </>
  );
}
