import { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const TIMEZONES = [
  'America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Phoenix','America/Anchorage','Pacific/Honolulu','America/Toronto',
  'Europe/London','Europe/Paris','Asia/Dubai','Asia/Kolkata','Asia/Tokyo','Australia/Sydney',
];
const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];
const TONES = ['friendly', 'professional', 'casual', 'urgent', 'warm'];

export default function SettingsPage() {
  const { tenant } = useAuth();
  const [tab, setTab] = useState('business');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const loadSettings = async () => {
    try {
      const data = await api.get('/settings');
      setSettings(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSettings(); }, []);

  const save = async (payload) => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.put('/settings', payload);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="page-loader">Loading settings...</div>;
  if (!settings) return <div className="page-loader">Failed to load settings</div>;

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Settings</h1>
        {saved && <span className="save-badge">Saved</span>}
      </div>
      <div className="settings-tabs">
        {[
          { key: 'business', label: 'Business' },
          { key: 'followup', label: 'Follow-up Engine' },
          { key: 'email', label: 'Email' },
          { key: 'integration', label: 'Integration' },
        ].map((t) => (
          <button key={t.key} className={`settings-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {error && <div className="error-msg">{error}</div>}
      {tab === 'business' && <BusinessTab settings={settings} onSave={save} saving={saving} />}
      {tab === 'followup' && <FollowupTab settings={settings} onSave={save} saving={saving} />}
      {tab === 'email' && <EmailTab settings={settings} onSave={save} saving={saving} />}
      {tab === 'integration' && <IntegrationTab settings={settings} onReload={loadSettings} />}
    </div>
  );
}

/* ==================== BUSINESS TAB ==================== */
function BusinessTab({ settings, onSave, saving }) {
  const [form, setForm] = useState({
    name: settings.business.name || '',
    industry: settings.business.industry || '',
    timezone: settings.business.timezone || 'America/New_York',
    phoneNumber: settings.business.phoneNumber || '',
    bookingLink: settings.business.bookingLink || '',
    description: settings.business.description || '',
    targetAudience: settings.business.targetAudience || '',
    tone: settings.business.tone || 'friendly',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => { e.preventDefault(); onSave({ business: form }); };

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h3>Business Information</h3>
      <p className="settings-desc">Your business profile is used to personalize SMS messages and power the AI follow-up generator.</p>

      <div className="field">
        <label>Business Name</label>
        <input value={form.name} onChange={set('name')} required />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Industry</label>
          <input value={form.industry} onChange={set('industry')} placeholder="e.g. Dental, MedSpa, Solar, Law" />
        </div>
        <div className="field">
          <label>Timezone</label>
          <select value={form.timezone} onChange={set('timezone')}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Business Description</label>
        <textarea rows={3} value={form.description} onChange={set('description')} placeholder="Describe what your business does, your specialties, and what makes you unique..." />
        <span className="field-hint">The AI uses this to craft personalized follow-up messages for your leads.</span>
      </div>
      <div className="field-row">
        <div className="field">
          <label>Target Audience</label>
          <input value={form.targetAudience} onChange={set('targetAudience')} placeholder="e.g. Homeowners aged 30-55 in Miami" />
        </div>
        <div className="field">
          <label>Message Tone</label>
          <select value={form.tone} onChange={set('tone')}>
            {TONES.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <hr className="settings-divider" />

      <div className="field">
        <label>SMS Phone Number</label>
        <input value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+15551234567" />
        <span className="field-hint">Your Twilio number. Leads will receive SMS from this number.</span>
      </div>
      <div className="field">
        <label>Booking Link</label>
        <input value={form.bookingLink} onChange={set('bookingLink')} placeholder="https://calendly.com/your-link" />
        <span className="field-hint">Sent to qualified leads and used in follow-up messages.</span>
      </div>
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}

/* ==================== FOLLOW-UP TAB ==================== */
function FollowupTab({ settings, onSave, saving }) {
  const [schedule, setSchedule] = useState(settings.followup.schedule || []);
  const [window, setWindow] = useState(settings.followup.outreachWindow || {
    enabled: true, start_hour: 9, end_hour: 19, days: ['mon','tue','wed','thu','fri','sat'],
  });
  const [generating, setGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [refining, setRefining] = useState(false);
  const chatEndRef = useRef(null);

  const updateStep = (idx, field, value) => {
    const updated = [...schedule];
    updated[idx] = { ...updated[idx], [field]: field === 'delay_hours' ? Number(value) : value };
    setSchedule(updated);
  };

  const addStep = () => {
    const lastDelay = schedule.length > 0 ? schedule[schedule.length - 1].delay_hours : 0;
    setSchedule([...schedule, { step: schedule.length + 1, delay_hours: lastDelay + 24, message: 'Hi {firstName}, book your appointment at {businessName}: {bookingLink}' }]);
  };

  const removeStep = (idx) => {
    setSchedule(schedule.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })));
  };

  const toggleDay = (day) => {
    const days = window.days.includes(day) ? window.days.filter((d) => d !== day) : [...window.days, day];
    setWindow({ ...window, days });
  };

  const handleSubmit = (e) => { e.preventDefault(); onSave({ followup: { schedule, outreachWindow: window } }); };

  const formatDelay = (hours) => {
    if (hours < 24) return `${hours}h`;
    const d = Math.floor(hours / 24); const h = hours % 24;
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const data = await api.post('/settings/generate-followups');
      setSchedule(data.schedule);
      setChatMessages([{ role: 'ai', text: 'I generated 7 follow-up messages based on your business profile. Review them below and edit as needed, or tell me what to change!' }]);
      setChatOpen(true);
    } catch (err) {
      alert(err.message);
    } finally { setGenerating(false); }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || refining) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: instruction }]);
    setRefining(true);
    try {
      const data = await api.post('/settings/refine-followups', { currentSchedule: schedule, instruction });
      setSchedule(data.schedule);
      setChatMessages((prev) => [...prev, { role: 'ai', text: 'Done! I updated the messages based on your feedback. Check them out below.' }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: `Sorry, something went wrong: ${err.message}` }]);
    } finally { setRefining(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h3>Outreach Window</h3>
      <p className="settings-desc">Messages outside this window are delayed to the next valid slot.</p>

      <div className="window-toggle">
        <label className="toggle-label">
          <input type="checkbox" checked={window.enabled} onChange={(e) => setWindow({ ...window, enabled: e.target.checked })} />
          <span className="toggle-slider"></span>
          Enforce outreach window
        </label>
      </div>

      {window.enabled && (
        <>
          <div className="field-row">
            <div className="field">
              <label>Start Hour</label>
              <select value={window.start_hour} onChange={(e) => setWindow({ ...window, start_hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>End Hour</label>
              <select value={window.end_hour} onChange={(e) => setWindow({ ...window, end_hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Active Days</label>
            <div className="day-picker">
              {DAYS.map((d) => (
                <button key={d.key} type="button" className={`day-btn ${window.days.includes(d.key) ? 'active' : ''}`} onClick={() => toggleDay(d.key)}>{d.label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      <hr className="settings-divider" />

      <div className="followup-header-row">
        <div>
          <h3>Follow-Up Schedule</h3>
          <p className="settings-desc">
            Use <code>{'{firstName}'}</code>, <code>{'{businessName}'}</code>, and <code>{'{bookingLink}'}</code> as template variables.
          </p>
        </div>
        <button type="button" className="btn-ai" onClick={generateWithAI} disabled={generating}>
          {generating ? (
            <><span className="ai-spinner"></span> Generating...</>
          ) : (
            <><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor"/></svg> Generate with AI</>
          )}
        </button>
      </div>

      <div className="schedule-list">
        {schedule.map((step, idx) => (
          <div key={idx} className="schedule-step">
            <div className="step-header">
              <span className="step-number">Step {step.step}</span>
              <span className="step-delay">{formatDelay(step.delay_hours)} after booking link</span>
              {schedule.length > 1 && (
                <button type="button" className="step-remove" onClick={() => removeStep(idx)}>Remove</button>
              )}
            </div>
            <div className="field-row">
              <div className="field" style={{ maxWidth: 120 }}>
                <label>Delay (hours)</label>
                <input type="number" min="1" value={step.delay_hours} onChange={(e) => updateStep(idx, 'delay_hours', e.target.value)} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Message</label>
                <textarea rows={2} value={step.message} onChange={(e) => updateStep(idx, 'message', e.target.value)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {schedule.length < 10 && (
        <button type="button" className="btn-secondary" onClick={addStep}>+ Add Step</button>
      )}

      {/* AI Chat Panel */}
      {chatOpen && (
        <div className="ai-chat-panel">
          <div className="ai-chat-header">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor"/></svg>
            AI Assistant
            <button type="button" className="ai-chat-close" onClick={() => setChatOpen(false)}>x</button>
          </div>
          <div className="ai-chat-messages">
            {chatMessages.map((m, i) => (
              <div key={i} className={`ai-msg ${m.role}`}>
                <p>{m.text}</p>
              </div>
            ))}
            {refining && <div className="ai-msg ai"><p className="ai-typing">Thinking...</p></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="ai-chat-input">
            <input
              type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              placeholder="e.g. Make step 3 mention our same-day appointments..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendChatMessage())}
              disabled={refining}
            />
            <button type="button" onClick={sendChatMessage} disabled={refining || !chatInput.trim()} className="ai-send-btn">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
      )}

      <div className="settings-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Follow-Up Settings'}
        </button>
        {!chatOpen && schedule.length > 0 && (
          <button type="button" className="btn-secondary" onClick={() => setChatOpen(true)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor"/></svg>
            {' '}Refine with AI
          </button>
        )}
      </div>
    </form>
  );
}

/* ==================== EMAIL TAB ==================== */
function EmailTab({ settings, onSave, saving }) {
  const [form, setForm] = useState({
    fromName: settings.email?.fromName || '',
    fromAddress: settings.email?.fromAddress || '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => { e.preventDefault(); onSave({ email: form }); };

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h3>Email Configuration</h3>
      <p className="settings-desc">Configure your email sender identity for campaign emails.</p>

      <div className="email-settings-section">
        <h4>Sender Identity</h4>
        <p className="settings-desc">This is who your campaign emails will appear to be from.</p>

        <div className="field-row">
          <div className="field">
            <label>From Name</label>
            <input value={form.fromName} onChange={set('fromName')} placeholder="e.g. Dr. Smith's Dental" />
            <span className="field-hint">The name that appears in the recipient's inbox</span>
          </div>
          <div className="field">
            <label>From Email Address</label>
            <input type="email" value={form.fromAddress} onChange={set('fromAddress')} placeholder="e.g. hello@yourbusiness.com" />
            <span className="field-hint">Must be a verified email with your email provider</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border-light)' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>How Email Works</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.8 }}>
          <li>When creating a campaign, you choose <strong>SMS Only</strong>, <strong>Email Only</strong>, or <strong>Both</strong></li>
          <li>Email messages can be longer and more detailed than SMS</li>
          <li>AI will automatically adapt message style based on your channel choice</li>
          <li>Contacts without an email address are skipped for email campaigns</li>
          <li>Unsubscribed contacts are never emailed</li>
        </ul>
      </div>

      <button type="submit" className="btn-primary" disabled={saving} style={{ marginTop: 20 }}>
        {saving ? 'Saving...' : 'Save Email Settings'}
      </button>
    </form>
  );
}

/* ==================== INTEGRATION TAB ==================== */
function IntegrationTab({ settings, onReload }) {
  const [copying, setCopying] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  const apiKey = settings.integration.apiKey;

  const copyToClipboard = async (text, label) => {
    await navigator.clipboard.writeText(text);
    setCopying(label);
    setTimeout(() => setCopying(''), 2000);
  };

  const regenerate = async () => {
    if (!confirm('Regenerate your API key? The old key will stop working immediately.')) return;
    setRegenerating(true);
    try {
      await api.post('/settings/regenerate-api-key');
      await onReload();
    } catch (err) { alert(err.message); }
    finally { setRegenerating(false); }
  };

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:3000/api/v1/webhook/leads`;

  return (
    <div className="settings-card">
      <h3>Webhook Integration</h3>
      <p className="settings-desc">Use these credentials to send leads from external sources (website forms, ad platforms, Zapier, etc.)</p>

      <div className="integration-block">
        <label>API Key</label>
        <div className="key-row">
          <code className="key-value">{apiKey || 'No API key generated yet'}</code>
          {apiKey && (
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(apiKey, 'key')}>
              {copying === 'key' ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button type="button" className="btn-sm btn-danger-sm" onClick={regenerate} disabled={regenerating}>
            {regenerating ? '...' : 'Regenerate'}
          </button>
        </div>
      </div>

      <div className="integration-block">
        <label>Webhook Endpoint</label>
        <div className="key-row">
          <code className="key-value">{webhookUrl}</code>
          <button type="button" className="btn-sm" onClick={() => copyToClipboard(webhookUrl, 'url')}>
            {copying === 'url' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <hr className="settings-divider" />

      <h3>Example Request</h3>
      <pre className="code-block">{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "phone": "+15551234567",
    "email": "jane@example.com",
    "source": "website_form"
  }'`}</pre>
    </div>
  );
}
