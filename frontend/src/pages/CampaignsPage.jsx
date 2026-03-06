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
              <tr><th>Campaign</th><th>Channel</th><th>Status</th><th>Recipients</th><th>Sent</th><th>Replies</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} campaign={c} formatDate={formatDate} onRefresh={loadCampaigns} />
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
    </div>
  );
}

function CampaignRow({ campaign, formatDate, onRefresh }) {
  const [launching, setLaunching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const s = STATUS_STYLES[campaign.status] || STATUS_STYLES.draft;

  const handleExpand = async () => {
    if (!expanded) {
      try { setDetail(await api.get(`/campaigns/${campaign.id}`)); } catch (err) { console.error(err); }
    }
    setExpanded(!expanded);
  };

  const handleLaunch = async () => {
    const waveCount = (campaign.schedule || []).length || 1;
    const ch = CHANNEL_LABELS[campaign.channel] || 'SMS';
    const msg = `Launch "${campaign.name}"? ${waveCount} wave(s) via ${ch} to all matching contacts.`;
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
        <td className="muted">{formatDate(campaign.createdAt)}</td>
        <td>
          {campaign.status === 'draft' && (
            <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); handleLaunch(); }} disabled={launching}>
              {launching ? 'Launching...' : 'Launch'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="campaign-detail-row"><td colSpan="8"><CampaignDetail campaign={detail || campaign} formatDate={formatDate} /></td></tr>
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
        <span>Opted out: {campaign.optoutCount}</span>
      </div>
    </div>
  );
}

function CreateCampaignModal({ onClose, onSuccess }) {
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState({ name: '', channel: 'sms', schedule: [], audienceFilter: {} });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiForm, setAiForm] = useState({ promotionDetails: '', audienceDescription: '', waveCount: 4 });

  const showSms = form.channel === 'sms' || form.channel === 'both';
  const showEmail = form.channel === 'email' || form.channel === 'both';

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
    try { await api.post('/campaigns', form); onSuccess(); }
    catch (err) { setError(err.message); }
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Campaign</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="wizard-steps">
            <div className={`wizard-step ${wizardStep >= 1 ? 'active' : ''}`}>1. Details</div>
            <div className={`wizard-step ${wizardStep >= 2 ? 'active' : ''}`}>2. Sequence</div>
            <div className={`wizard-step ${wizardStep >= 3 ? 'active' : ''}`}>3. Review</div>
          </div>

          {/* Step 1 */}
          {wizardStep === 1 && (
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

              <div className="template-vars" style={{ marginTop: 12 }}>
                <span className="hint">Variables: </span>
                <code>{'{firstName}'}</code>
                <code>{'{businessName}'}</code>
                <code>{'{bookingLink}'}</code>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>Back</button>
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
  );
}
