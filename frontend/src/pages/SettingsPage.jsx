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
  const { tenant, updateTenant } = useAuth();
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab === 'integration') setTab('integration');
    const gcal = params.get('gcal');
    if (gcal === 'connected') {
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (gcal === 'error') {
      const reason = params.get('reason') || 'Connection failed';
      setError(`Google Calendar: ${decodeURIComponent(reason)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
    const square = params.get('square');
    if (square === 'connected') {
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (square === 'error') {
      const reason = params.get('reason') || 'Connection failed';
      setError(`Square Appointments: ${decodeURIComponent(reason)}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const save = async (payload) => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const updated = await api.put('/settings', payload);
      setSettings(updated);
      if (payload.business?.uiMode !== undefined) {
        updateTenant({ uiMode: payload.business.uiMode });
      }
      if (payload.automation?.testMode !== undefined) {
        updateTenant({ automationTestMode: !!payload.automation.testMode });
      }
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
      {tab === 'business' && (
        <>
          <AutomationTestModePanel settings={settings} onSave={save} onReload={loadSettings} saving={saving} updateTenant={updateTenant} />
          <BusinessTab settings={settings} onSave={save} saving={saving} />
        </>
      )}
      {tab === 'followup' && <FollowupTab settings={settings} onSave={save} saving={saving} />}
      {tab === 'email' && <EmailTab settings={settings} onSave={save} saving={saving} />}
      {tab === 'integration' && <IntegrationTab settings={settings} onSave={save} onReload={loadSettings} saving={saving} />}
    </div>
  );
}

/* ==================== AUTOMATION TEST MODE ==================== */
function AutomationTestModePanel({ settings, onSave, onReload, saving, updateTenant }) {
  const automation = settings.automation || {};
  const [testPhone, setTestPhone] = useState(automation.testPhone || '');
  const [testEmail, setTestEmail] = useState(automation.testEmail || '');
  const [goingLive, setGoingLive] = useState(false);

  useEffect(() => {
    setTestPhone(automation.testPhone || '');
    setTestEmail(automation.testEmail || '');
  }, [automation.testPhone, automation.testEmail]);

  const testMode = !!automation.testMode;

  const saveTestConfig = (e) => {
    e.preventDefault();
    onSave({
      automation: {
        testMode: true,
        testPhone,
        testEmail,
      },
    });
  };

  const handleGoLive = async () => {
    const msg = 'Go live? Pending appointment automations will be cancelled. New automations will go to real clients.';
    if (!window.confirm(msg)) return;
    setGoingLive(true);
    try {
      const result = await api.post('/settings/automation-go-live');
      updateTenant({ automationTestMode: false });
      await onReload();
      alert(
        result.cancelledPendingJobs > 0
          ? `You are live. Cancelled ${result.cancelledPendingJobs} pending automation job(s).`
          : 'You are live. Automations will now go to real clients.',
      );
    } catch (err) {
      alert(err.message || 'Failed to go live');
    } finally {
      setGoingLive(false);
    }
  };

  return (
    <div className={`settings-card automation-test-mode-card${testMode ? ' test-mode-active' : ''}`}>
      <div className="automation-test-mode-header">
        <div>
          <h3>Automation Test Mode</h3>
          <p className="settings-desc">
            While test mode is on, SMS and email automations (appointments, campaigns) are routed to your test phone and email — not your clients.
            Manual messages from Conversations are not rerouted.
          </p>
        </div>
        <span className={`test-mode-status-badge ${testMode ? 'on' : 'live'}`}>
          {testMode ? 'Test Mode ON' : 'Live'}
        </span>
      </div>

      {testMode ? (
        <form onSubmit={saveTestConfig}>
          <div className="field-row">
            <div className="field">
              <label>Test phone number</label>
              <input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+15551234567"
                required
              />
              <span className="field-hint">All automation SMS go here with a [TEST → Client Name] prefix.</span>
            </div>
            <div className="field">
              <label>Test email (optional)</label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <span className="field-hint">Required only if you use email automations. Without it, email automations are blocked in test mode.</span>
            </div>
          </div>
          <div className="automation-test-mode-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save test settings'}
            </button>
            <button
              type="button"
              className="btn-primary btn-go-live"
              onClick={handleGoLive}
              disabled={goingLive || !testPhone.trim()}
            >
              {goingLive ? 'Going live…' : 'Go Live'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          {automation.liveAt && (
            <p className="field-hint" style={{ marginBottom: 12 }}>
              Went live {new Date(automation.liveAt).toLocaleString()}.
            </p>
          )}
          <button
            type="button"
            className="btn-sm"
            onClick={() => onSave({ automation: { testMode: true, testPhone, testEmail } })}
            disabled={saving}
          >
            Re-enable test mode
          </button>
        </div>
      )}
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
    smsProvider: settings.business.smsProvider || '',
    bookingLink: settings.business.bookingLink || '',
    description: settings.business.description || '',
    targetAudience: settings.business.targetAudience || '',
    tone: settings.business.tone || 'friendly',
    aiAutoReplyEnabled: !!settings.business.aiAutoReplyEnabled,
    smsKeywordOptInEnabled: !!settings.business.smsKeywordOptInEnabled,
    smsKeywordPhrasesText: (settings.business.smsKeywordOptInPhrases || []).join('\n'),
    smsKeywordWelcomeMessage: settings.business.smsKeywordWelcomeMessage || '',
    uiMode: settings.business.uiMode || 'simple',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      phoneNumber: settings.business.phoneNumber || '',
      smsProvider: settings.business.smsProvider || '',
    }));
  }, [settings.business.phoneNumber, settings.business.smsProvider]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const phrases = form.smsKeywordPhrasesText
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const { smsKeywordPhrasesText, ...rest } = form;
    onSave({
      business: {
        ...rest,
        smsKeywordOptInPhrases: phrases,
      },
    });
  };

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

      <div className="field field-checkbox">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.aiAutoReplyEnabled}
            onChange={(e) => setForm({ ...form, aiAutoReplyEnabled: e.target.checked })}
          />
          <span>AI auto-replies to inbound SMS</span>
        </label>
        <span className="field-hint">
          When enabled, new replies are generated from your business description and tone (requires OPENAI_API_KEY on the server).
          You can turn this off per conversation in Conversations.
        </span>
      </div>

      <hr className="settings-divider" />

      <h3>SMS keyword opt-in</h3>
      <p className="settings-desc">
        When someone texts your business number with a matching word or phrase and they are not already a lead or contact,
        we create a contact and send your welcome message once. Requires prior consent where applicable (e.g. TCPA).
      </p>
      <div className="field field-checkbox">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.smsKeywordOptInEnabled}
            onChange={(e) => setForm({ ...form, smsKeywordOptInEnabled: e.target.checked })}
          />
          <span>Enable keyword opt-in</span>
        </label>
      </div>
      <div className="field">
        <label>Trigger phrases</label>
        <textarea
          rows={3}
          value={form.smsKeywordPhrasesText}
          onChange={(e) => setForm({ ...form, smsKeywordPhrasesText: e.target.value })}
          placeholder={'One per line or comma-separated, e.g.\njoin\nmenu\nstart'}
          disabled={!form.smsKeywordOptInEnabled}
        />
        <span className="field-hint">
          Matching is case-insensitive. We match if the whole message equals the phrase, or the first word does (e.g. &quot;JOIN please&quot;).
        </span>
      </div>
      <div className="field">
        <label>Welcome SMS</label>
        <textarea
          rows={3}
          value={form.smsKeywordWelcomeMessage}
          onChange={(e) => setForm({ ...form, smsKeywordWelcomeMessage: e.target.value })}
          placeholder="Thanks for subscribing! — {businessName}"
          disabled={!form.smsKeywordOptInEnabled}
        />
        <span className="field-hint">
          Use <code>{'{businessName}'}</code> for your business name. Sent only the first time we create the contact from a keyword.
        </span>
      </div>

      <hr className="settings-divider" />

      <h3>App layout</h3>
      <p className="settings-desc">
        Simple mode opens to your inbox with a streamlined menu — best for day-to-day client messaging.
        Full mode includes dashboard, leads, and automations for power users.
      </p>
      <div className="field">
        <label>Interface mode</label>
        <select value={form.uiMode} onChange={set('uiMode')}>
          <option value="simple">Simple — Inbox, Clients, Outreach</option>
          <option value="full">Full — Dashboard, Leads, Automations</option>
        </select>
      </div>

      <hr className="settings-divider" />

      <div className="field-row">
        <div className="field">
          <label>SMS Phone Number</label>
          <input value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="+15551234567" />
        </div>
        <div className="field">
          <label>SMS Provider</label>
          <select value={form.smsProvider} onChange={set('smsProvider')}>
            <option value="">Auto (match number or platform default)</option>
            <option value="twilio">Twilio</option>
            <option value="telnyx">Telnyx</option>
          </select>
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: '-8px', marginBottom: '16px' }}>
        Your dedicated SMS number in E.164 format. The provider must match where the number is registered
        (Twilio or Telnyx).
        {settings.business.smsFromSource === 'platform_default' ? (
          <>
            {' '}No dedicated number is set — outbound SMS currently sends from{' '}
            <strong>{settings.business.effectiveSmsFrom || 'the platform default'}</strong>
            {' '}via <strong>{settings.business.effectiveSmsProvider || 'twilio'}</strong>.
          </>
        ) : (
          <>
            {' '}Outbound SMS will send from{' '}
            <strong>{settings.business.effectiveSmsFrom || form.phoneNumber}</strong>
            {' '}via <strong>{settings.business.effectiveSmsProvider || 'twilio'}</strong>.
          </>
        )}
        {' '}Assigning a number here automatically removes it from any other account.
      </p>
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
  const [missedCallTextBackEnabled, setMissedCallTextBackEnabled] = useState(
    settings.followup.missedCallTextBackEnabled !== false,
  );
  const [missedCallMessage, setMissedCallMessage] = useState(settings.followup.missedCallMessage || "Sorry we missed your call! How can we help? Reply to this message.");
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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ followup: { schedule, outreachWindow: window, missedCallMessage, missedCallTextBackEnabled } });
  };

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
  useEffect(() => {
    setMissedCallTextBackEnabled(settings.followup?.missedCallTextBackEnabled !== false);
  }, [settings.followup?.missedCallTextBackEnabled]);
  useEffect(() => {
    setMissedCallMessage(settings.followup?.missedCallMessage || "Sorry we missed your call! How can we help? Reply to this message.");
  }, [settings.followup?.missedCallMessage]);

  return (
    <form className="settings-card" onSubmit={handleSubmit}>
      <h3>Missed Call Text-Back</h3>
      <p className="settings-desc">When a call is forwarded to your Twilio number (no answer), we automatically text the caller. Configure conditional call forwarding on your carrier to forward to your platform number.</p>
      <div className="window-toggle" style={{ marginBottom: 16 }}>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={missedCallTextBackEnabled}
            onChange={(e) => setMissedCallTextBackEnabled(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          Send missed-call text-back SMS
        </label>
      </div>
      <div className="field">
        <label>Missed Call Message</label>
        <textarea
          rows={2}
          value={missedCallMessage}
          onChange={(e) => setMissedCallMessage(e.target.value)}
          placeholder="Sorry we missed your call! How can we help? Reply to this message."
          disabled={!missedCallTextBackEnabled}
        />
        <span className="field-hint">SMS sent when we detect a forwarded missed call. Keep under 160 characters.</span>
      </div>

      <hr className="settings-divider" />

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
function IntegrationTab({ settings, onSave, onReload, saving }) {
  const [copying, setCopying] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [calendlyKey, setCalendlyKey] = useState(settings.integration?.calendlyWebhookSigningKey || '');
  useEffect(() => {
    setCalendlyKey(settings.integration?.calendlyWebhookSigningKey || '');
  }, [settings.integration?.calendlyWebhookSigningKey]);

  const [optimantraSecret, setOptimantraSecret] = useState(settings.integration?.optimantraWebhookSecret || '');
  const [optimantraCheckoutAutomations, setOptimantraCheckoutAutomations] = useState(
    !!settings.integration?.optimantraCheckoutAutomations,
  );
  useEffect(() => {
    setOptimantraSecret(settings.integration?.optimantraWebhookSecret || '');
    setOptimantraCheckoutAutomations(!!settings.integration?.optimantraCheckoutAutomations);
  }, [settings.integration?.optimantraWebhookSecret, settings.integration?.optimantraCheckoutAutomations]);

  const apiKey = settings.integration?.apiKey;
  const calendlyWebhookUrl = settings.integration?.calendlyWebhookUrl || '';
  const optimantraWebhookUrl = settings.integration?.optimantraWebhookUrl || '';
  const optimantraSuperbillWebhookUrl = settings.integration?.optimantraSuperbillWebhookUrl || '';
  const voiceWebhookUrl = settings.integration?.voiceWebhookUrl || '';
  const telnyxVoiceWebhookUrl = settings.integration?.telnyxVoiceWebhookUrl || '';
  const smsInboundWebhookUrl = settings.integration?.smsInboundWebhookUrl || '';

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

  const saveCalendly = (e) => {
    e.preventDefault();
    onSave({ integration: { calendlyWebhookSigningKey: calendlyKey || null } });
  };

  const saveOptimantra = (e) => {
    e.preventDefault();
    onSave({
      integration: {
        optimantraWebhookSecret: optimantraSecret || null,
        optimantraCheckoutAutomations: optimantraCheckoutAutomations,
      },
    });
  };

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

      <h3>Calendly Integration</h3>
      <p className="settings-desc">Connect Calendly to automatically create contacts, track appointments, and send reminders, confirmations, and post-visit follow-ups. Configure message content and timing in <strong>Automations</strong>.</p>
      <form onSubmit={saveCalendly} className="integration-block">
        <div className="field">
          <label>Calendly Webhook Signing Key</label>
          <input
            type="password"
            value={calendlyKey}
            onChange={(e) => setCalendlyKey(e.target.value)}
            placeholder="Paste from Calendly webhook subscription"
          />
          <span className="field-hint">Optional. When set, webhook requests are verified for security.</span>
        </div>
        {calendlyWebhookUrl && (
          <div className="integration-block" style={{ marginTop: 12 }}>
            <label>Calendly Webhook URL</label>
            <div className="key-row">
              <code className="key-value" style={{ fontSize: 12 }}>{calendlyWebhookUrl}</code>
              <button type="button" className="btn-sm" onClick={() => copyToClipboard(calendlyWebhookUrl, 'calendly')}>
                {copying === 'calendly' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <span className="field-hint">Add this URL in Calendly → Integrations → Webhooks. Subscribe to invitee.created and invitee.canceled.</span>
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ marginTop: 12 }} disabled={saving}>
          {saving ? 'Saving...' : 'Save Calendly Config'}
        </button>
      </form>

      <hr className="settings-divider" />

      <h3>OptiMantra Integration</h3>
      <p className="settings-desc">
        Connect OptiMantra for appointment booking and superbill checkout. With checkout mode enabled,
        confirmations and reminders run when appointments are booked; post-visit messages (review,
        rebooking, follow-ups) run when the superbill checkout webhook fires. Other integrations
        (Google Calendar, Calendly, etc.) are unchanged.
      </p>
      <form onSubmit={saveOptimantra} className="integration-block">
        <div className="field">
          <label>OptiMantra Webhook Secret</label>
          <input
            type="password"
            value={optimantraSecret}
            onChange={(e) => setOptimantraSecret(e.target.value)}
            placeholder="Optional shared secret"
          />
          <span className="field-hint">
            Optional. When set, requests must include header <code>x-optimantra-webhook-secret</code> with this value.
          </span>
        </div>

        <div className="automation-section-header" style={{ marginTop: 16 }}>
          <div>
            <strong>Post-visit at checkout</strong>
            <p className="settings-desc" style={{ marginBottom: 0 }}>
              When enabled, OptiMantra booking webhooks only schedule confirmations and reminders.
              Post-visit automations run from the Superbill Checkout webhook below.
            </p>
          </div>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={optimantraCheckoutAutomations}
              onChange={(e) => setOptimantraCheckoutAutomations(e.target.checked)}
            />
            <span className="toggle-slider" />
            Enabled
          </label>
        </div>

        {optimantraWebhookUrl && (
          <div className="integration-block" style={{ marginTop: 12 }}>
            <label>Booking Webhook URL</label>
            <div className="key-row">
              <code className="key-value" style={{ fontSize: 12 }}>{optimantraWebhookUrl}</code>
              <button type="button" className="btn-sm" onClick={() => copyToClipboard(optimantraWebhookUrl, 'optimantra')}>
                {copying === 'optimantra' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <span className="field-hint">
              OptiMantra → Settings → Marketing → CRM Integration → Out-Bound Webhook.
              Trigger: <strong>When an Appointment is Booked</strong>. Method: <strong>PUT</strong>.
            </span>
          </div>
        )}

        {optimantraSuperbillWebhookUrl && (
          <div className="integration-block" style={{ marginTop: 12 }}>
            <label>Superbill Checkout Webhook URL</label>
            <div className="key-row">
              <code className="key-value" style={{ fontSize: 12 }}>{optimantraSuperbillWebhookUrl}</code>
              <button type="button" className="btn-sm" onClick={() => copyToClipboard(optimantraSuperbillWebhookUrl, 'optimantra-superbill')}>
                {copying === 'optimantra-superbill' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <span className="field-hint">
              Add a second Out-Bound Webhook for <strong>Superbill Checkout</strong>.
              Include patient contact info, appointment ID, checkout date, and service lines with service type
              (Office Visit, Procedure, Lab Work, Other).
            </span>
          </div>
        )}
        <button type="submit" className="btn-primary" style={{ marginTop: 12 }} disabled={saving}>
          {saving ? 'Saving...' : 'Save OptiMantra Config'}
        </button>
      </form>

      <hr className="settings-divider" />

      <SquareSection settings={settings} onReload={onReload} copyToClipboard={copyToClipboard} copying={copying} />

      <hr className="settings-divider" />

      <GoogleCalendarSection settings={settings} onReload={onReload} />

      <hr className="settings-divider" />

      <InstagramSection settings={settings} onReload={onReload} copyToClipboard={copyToClipboard} copying={copying} />

      <hr className="settings-divider" />

      <h3>SMS Inbound Webhook (Twilio / Telnyx)</h3>
      <p className="settings-desc">Configure your SMS provider to receive inbound messages. Set this URL in Twilio or Telnyx messaging profile.</p>
      {smsInboundWebhookUrl && (
        <div className="integration-block">
          <label>SMS Inbound Webhook URL</label>
          <div className="key-row">
            <code className="key-value" style={{ fontSize: 12 }}>{smsInboundWebhookUrl}</code>
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(smsInboundWebhookUrl, 'sms')}>
              {copying === 'sms' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <span className="field-hint">Telnyx: Messaging Profile → Inbound → Webhook URL. Twilio: Phone Numbers → [Number] → Messaging → A MESSAGE COMES IN.</span>
        </div>
      )}

      <hr className="settings-divider" />

      <h3>Missed Call Text-Back</h3>
      <p className="settings-desc">
        Forward unanswered or busy calls from your business line to your platform number.
        When a forwarded call arrives, we text the caller back automatically (enable in Follow-up Engine).
      </p>

      <h4 style={{ fontSize: '0.95rem', margin: '1rem 0 0.5rem' }}>Twilio Voice</h4>
      <p className="settings-desc" style={{ marginTop: 0 }}>
        Use your Twilio number as SMS Phone Number with SMS Provider set to Twilio.
      </p>
      {voiceWebhookUrl && (
        <div className="integration-block">
          <label>Voice Webhook URL (Twilio)</label>
          <div className="key-row">
            <code className="key-value" style={{ fontSize: 12 }}>{voiceWebhookUrl}</code>
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(voiceWebhookUrl, 'voice')}>
              {copying === 'voice' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <span className="field-hint">Twilio: Phone Numbers → [Number] → Voice → A CALL COMES IN → Webhook URL.</span>
        </div>
      )}

      <h4 style={{ fontSize: '0.95rem', margin: '1.25rem 0 0.5rem' }}>Telnyx Voice</h4>
      <p className="settings-desc" style={{ marginTop: 0 }}>
        Use your Telnyx toll-free as SMS Phone Number with SMS Provider set to Telnyx. Assign the same number to a Telnyx Voice API Application.
      </p>
      {telnyxVoiceWebhookUrl && (
        <div className="integration-block">
          <label>Voice Webhook URL (Telnyx)</label>
          <div className="key-row">
            <code className="key-value" style={{ fontSize: 12 }}>{telnyxVoiceWebhookUrl}</code>
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(telnyxVoiceWebhookUrl, 'telnyx-voice')}>
              {copying === 'telnyx-voice' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <span className="field-hint">Telnyx: Voice → Voice API Applications → Webhook URL (API v2). Keep Messaging Profile SMS webhook separate.</span>
        </div>
      )}

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

function SquareSection({ settings, onReload, copyToClipboard, copying }) {
  const sq = settings.integration?.square || {};
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [webhooksEnabled, setWebhooksEnabled] = useState(sq.webhooksEnabled !== false);

  useEffect(() => {
    setWebhooksEnabled(sq.webhooksEnabled !== false);
  }, [sq.webhooksEnabled]);

  const connect = async () => {
    setBusy('connect');
    setMsg('');
    try {
      const { url } = await api.post('/integrations/square/connect');
      window.location.href = url;
    } catch (err) {
      setMsg(err.message);
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Square Appointments? New Square bookings will no longer sync.')) return;
    setBusy('disconnect');
    setMsg('');
    try {
      await api.post('/integrations/square/disconnect');
      await onReload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setBusy('save');
    setMsg('');
    try {
      await api.put('/integrations/square', { webhooksEnabled });
      await onReload();
      setMsg('Square settings saved');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!sq.configured) {
    return (
      <div className="integration-block">
        <h3>Square Appointments</h3>
        <p className="settings-desc muted">
          Square is not configured on the server yet. Set <code>SQUARE_APPLICATION_ID</code> and{' '}
          <code>SQUARE_APPLICATION_SECRET</code> in the backend environment.
        </p>
      </div>
    );
  }

  return (
    <div className="integration-block">
      <h3>Square Appointments</h3>
      <p className="settings-desc">
        Connect Square Appointments to automatically create contacts, track bookings, and trigger
        reminders, confirmations, and service-specific rebooking.
      </p>

      {sq.webhookUrl && (
        <div className="integration-block" style={{ marginTop: 12 }}>
          <label>Square Webhook URL (register once in Square Developer)</label>
          <div className="key-row">
            <code className="key-value" style={{ fontSize: 12 }}>{sq.webhookUrl}</code>
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(sq.webhookUrl, 'square-webhook')}>
              {copying === 'square-webhook' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <span className="field-hint">
            Square Developer → Webhooks → Add endpoint. Events: <strong>booking.created</strong>,{' '}
            <strong>booking.updated</strong>. Set <code>SQUARE_WEBHOOK_SIGNATURE_KEY</code> on the server.
          </span>
        </div>
      )}

      {!sq.connected ? (
        <button type="button" className="btn-primary" style={{ marginTop: 12 }} onClick={connect} disabled={busy === 'connect'}>
          {busy === 'connect' ? 'Redirecting…' : 'Connect Square Appointments'}
        </button>
      ) : (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Connected Square account</label>
            <p style={{ margin: 0, fontSize: 14 }}>
              {sq.businessName || 'Square seller'}
              {sq.merchantId ? ` · Merchant ${sq.merchantId}` : ''}
            </p>
            {sq.lastWebhookAt && (
              <span className="field-hint">Last webhook: {new Date(sq.lastWebhookAt).toLocaleString()}</span>
            )}
            {sq.lastWebhookError && (
              <span className="field-hint" style={{ color: 'var(--danger, #c0392b)' }}>
                Last error: {sq.lastWebhookError}
              </span>
            )}
          </div>

          <form onSubmit={saveSettings} style={{ marginTop: 16 }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={webhooksEnabled}
                onChange={(e) => setWebhooksEnabled(e.target.checked)}
              />
              Process Square booking webhooks for this tenant
            </label>
            <div className="modal-actions" style={{ marginTop: 12 }}>
              <button type="submit" className="btn-primary" disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn-sm btn-danger-sm" onClick={disconnect} disabled={busy === 'disconnect'}>
                {busy === 'disconnect' ? '…' : 'Disconnect'}
              </button>
            </div>
          </form>
        </>
      )}

      {msg && <p className="field-hint" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}

function GoogleCalendarSection({ settings, onReload }) {
  const gcal = settings.integration?.googleCalendar || {};
  const [busy, setBusy] = useState('');
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState(gcal.calendarId || 'primary');
  const [syncEnabled, setSyncEnabled] = useState(gcal.syncEnabled !== false);
  const [msg, setMsg] = useState('');
  const [skippedLog, setSkippedLog] = useState([]);
  const [skippedLoading, setSkippedLoading] = useState(false);

  const loadSkippedLog = async () => {
    if (!gcal.connected) return;
    setSkippedLoading(true);
    try {
      const data = await api.get('/integrations/google-calendar/sync-log?limit=50');
      setSkippedLog(data.events || []);
    } catch {
      setSkippedLog([]);
    } finally {
      setSkippedLoading(false);
    }
  };

  useEffect(() => {
    setCalendarId(gcal.calendarId || 'primary');
    setSyncEnabled(gcal.syncEnabled !== false);
  }, [gcal.calendarId, gcal.syncEnabled]);

  useEffect(() => {
    if (!gcal.connected) return;
    api.get('/integrations/google-calendar/calendars')
      .then((data) => setCalendars(data.calendars || []))
      .catch(() => {});
    loadSkippedLog();
  }, [gcal.connected]);

  const connect = async () => {
    setBusy('connect');
    setMsg('');
    try {
      const { url } = await api.post('/integrations/google-calendar/connect');
      window.location.href = url;
    } catch (err) {
      setMsg(err.message);
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Google Calendar? Appointment sync from calendar will stop.')) return;
    setBusy('disconnect');
    setMsg('');
    try {
      await api.post('/integrations/google-calendar/disconnect');
      await onReload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    setMsg('');
    try {
      const result = await api.post('/integrations/google-calendar/sync', { full: true });
      setMsg(`Sync complete — ${result.processed ?? 0} processed, ${result.skipped ?? 0} skipped`);
      await onReload();
      await loadSkippedLog();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  const clearAndResync = async () => {
    if (!confirm(
      'Clear all Google Calendar appointments and sync again?\n\n'
      + 'This removes every appointment imported from Google Calendar (and their scheduled messages), '
      + 'then re-imports current and upcoming calendar events. Contacts are not deleted.',
    )) return;
    setBusy('clear');
    setMsg('');
    try {
      const result = await api.post('/integrations/google-calendar/clear-and-resync');
      setMsg(
        `Cleared ${result.deletedCount ?? 0} appointment(s) — `
        + `${result.processed ?? 0} processed, ${result.skipped ?? 0} skipped on resync`,
      );
      await onReload();
      await loadSkippedLog();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  const saveCalendar = async (e) => {
    e.preventDefault();
    setBusy('save');
    setMsg('');
    try {
      await api.put('/integrations/google-calendar', { calendarId, syncEnabled });
      await onReload();
      setMsg('Calendar settings saved');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!gcal.configured) {
    return (
      <div className="integration-block">
        <h3>Google Calendar</h3>
        <p className="settings-desc muted">Google Calendar sync is not configured on the server yet. Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the backend environment.</p>
      </div>
    );
  }

  return (
    <div className="integration-block">
      <h3>Google Calendar</h3>
      <p className="settings-desc">
        Sync appointments booked directly on Google Calendar into ClientForge. Client events with a guest attendee are matched to contacts and trigger the same automations as email ingest and Calendly (reminders, reviews, rebooking).
      </p>

      {!gcal.connected ? (
        <button type="button" className="btn-primary" onClick={connect} disabled={busy === 'connect'}>
          {busy === 'connect' ? 'Redirecting…' : 'Connect Google Calendar'}
        </button>
      ) : (
        <>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Connected account</label>
            <p style={{ margin: 0, fontSize: 14 }}>{gcal.googleEmail || 'Google account'}</p>
            {gcal.lastSyncedAt && (
              <span className="field-hint">Last synced: {new Date(gcal.lastSyncedAt).toLocaleString()}</span>
            )}
            {gcal.lastSyncError && (
              <span className="field-hint" style={{ color: 'var(--danger, #c0392b)' }}>Last error: {gcal.lastSyncError}</span>
            )}
          </div>

          <form onSubmit={saveCalendar} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Calendar to sync</label>
              <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)}>
                {(calendars.length ? calendars : [{ id: calendarId, summary: gcal.calendarSummary || calendarId }]).map((c) => (
                  <option key={c.id} value={c.id}>{c.summary || c.id}{c.primary ? ' (primary)' : ''}</option>
                ))}
              </select>
            </div>
            <label className="checkbox-row" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
              Enable automatic sync
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              <button type="submit" className="btn-primary" disabled={busy === 'save'}>
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn-sm" onClick={syncNow} disabled={!!busy}>
                {busy === 'sync' ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="btn-sm btn-danger-sm" onClick={clearAndResync} disabled={!!busy}>
                {busy === 'clear' ? 'Clearing…' : 'Clear & resync'}
              </button>
              <button type="button" className="btn-sm btn-danger-sm" onClick={disconnect} disabled={!!busy}>
                Disconnect
              </button>
            </div>
          </form>
        </>
      )}

      {msg && <p className="field-hint" style={{ marginTop: 12 }}>{msg}</p>}

      {gcal.connected && (
        <GoogleCalendarSkippedLog
          events={skippedLog}
          loading={skippedLoading}
          onRefresh={loadSkippedLog}
          busy={!!busy}
        />
      )}

      <span className="field-hint" style={{ display: 'block', marginTop: 12 }}>
        Imports current and upcoming appointments from the selected calendar. Clients with a name and phone on the event are added to Contacts automatically; existing clients are matched by phone, email, or name. Events without a valid phone are skipped. Square Appointments and GlossGenius feeds are supported.
      </span>
    </div>
  );
}

const GCAL_SKIP_HINTS = {
  contact_not_in_list: 'Need client name and phone on the calendar event to import automatically.',
  missing_phone: 'Add a phone on the calendar event or import the client to Contacts first.',
  past_event: 'Only current and upcoming appointments are imported.',
  no_contact_identity: 'Often a staff block or personal event — not a client booking.',
  missing_contact_identity: 'Could not parse a client name or email from the calendar event.',
};

function formatSkippedClient(event) {
  const name = [event.firstName, event.lastName].filter(Boolean).join(' ').trim();
  if (name) return name;
  if (event.summary) return event.summary;
  return 'Unknown client';
}

function GoogleCalendarSkippedLog({ events, loading, onRefresh, busy }) {
  return (
    <div className="gcal-sync-log" style={{ marginTop: 20 }}>
      <div className="gcal-sync-log-header">
        <div>
          <h4 style={{ margin: 0, fontSize: 15 }}>Skipped calendar events</h4>
          <p className="field-hint" style={{ margin: '4px 0 0' }}>
            Events from the latest sync that were not imported into ClientForge.
          </p>
        </div>
        <button type="button" className="btn-sm" onClick={onRefresh} disabled={loading || busy}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && events.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 12 }}>Loading skipped events…</p>
      ) : events.length === 0 ? (
        <p className="field-hint" style={{ marginTop: 12 }}>No skipped events logged yet.</p>
      ) : (
        <div className="gcal-sync-log-list">
          {events.map((event) => (
            <div key={event.id} className="gcal-sync-log-item">
              <div className="gcal-sync-log-item-top">
                <strong>{formatSkippedClient(event)}</strong>
                <span className="gcal-sync-log-reason">{event.skipReasonLabel || event.skipReason}</span>
              </div>
              {event.summary && event.summary !== formatSkippedClient(event) && (
                <div className="field-hint">Calendar title: {event.summary}</div>
              )}
              <div className="field-hint gcal-sync-log-meta">
                {event.phone && <span>Phone: {event.phone}</span>}
                {event.email && <span>Email: {event.email}</span>}
                {event.eventEnd && <span>Ended: {new Date(event.eventEnd).toLocaleString()}</span>}
                {event.createdAt && <span>Logged: {new Date(event.createdAt).toLocaleString()}</span>}
              </div>
              {GCAL_SKIP_HINTS[event.skipReason] && (
                <div className="field-hint">{GCAL_SKIP_HINTS[event.skipReason]}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InstagramSection({ settings, onReload, copyToClipboard, copying }) {
  const ig = settings.integration?.instagram || {};
  const metaWebhookUrl = settings.integration?.metaWebhookUrl || '';
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const connect = async () => {
    setBusy('connect');
    setMsg('');
    try {
      const { url } = await api.post('/integrations/instagram/connect');
      window.location.href = url;
    } catch (err) {
      setMsg(err.message);
      setBusy('');
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Instagram? Incoming DMs will no longer sync to your inbox.')) return;
    setBusy('disconnect');
    setMsg('');
    try {
      await api.post('/integrations/instagram/disconnect');
      await onReload();
      setMsg('Instagram disconnected');
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!ig.configured) {
    return (
      <div className="integration-block">
        <h3>Instagram DMs</h3>
        <p className="settings-desc muted">
          Instagram messaging is not configured on the server yet. Set <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, and <code>META_WEBHOOK_VERIFY_TOKEN</code> in the backend environment.
        </p>
      </div>
    );
  }

  return (
    <div className="integration-block">
      <h3>Instagram DMs</h3>
      <p className="settings-desc">
        Connect your Instagram Business account to receive DMs in Inbox and reply manually. AI auto-replies for Instagram are coming in a later update.
      </p>

      {metaWebhookUrl && (
        <div style={{ marginBottom: 16 }}>
          <label>Meta Webhook URL</label>
          <div className="key-row">
            <code className="key-value" style={{ fontSize: 12 }}>{metaWebhookUrl}</code>
            <button type="button" className="btn-sm" onClick={() => copyToClipboard(metaWebhookUrl, 'meta')}>
              {copying === 'meta' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <span className="field-hint">
            In Meta Developer Console → your app → Instagram → Webhooks: paste this URL, use the same verify token as <code>META_WEBHOOK_VERIFY_TOKEN</code>, and subscribe to <strong>messages</strong>.
          </span>
        </div>
      )}

      {!ig.connected ? (
        <button type="button" className="btn-primary" onClick={connect} disabled={!!busy}>
          {busy === 'connect' ? 'Redirecting…' : 'Connect Instagram'}
        </button>
      ) : (
        <>
          <p className="field-hint" style={{ marginBottom: 8 }}>
            Connected as {ig.instagramUsername ? `@${ig.instagramUsername}` : ig.pageName || 'Instagram Business'}
            {ig.pageName && ig.instagramUsername ? ` · Page: ${ig.pageName}` : ''}
          </p>
          <button type="button" className="btn-sm btn-danger-sm" onClick={disconnect} disabled={!!busy}>
            {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </>
      )}

      {ig.lastWebhookError && (
        <p className="form-error" style={{ marginTop: 12 }}>Last webhook error: {ig.lastWebhookError}</p>
      )}
      {msg && <p className="field-hint" style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
