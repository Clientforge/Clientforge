import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import {
  WORKFLOW_TABS, CHANNELS, TEMPLATE_VARS, emptyConfig, newStepId,
  parseOffset, toOffsetMinutes, formatOffsetLabel,
} from './shared';

export default function WorkflowsPanel() {
  const [tab, setTab] = useState('confirmations');
  const [config, setConfig] = useState(emptyConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [refining, setRefining] = useState(false);
  const chatEndRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/automations/appointments');
      setConfig({ ...emptyConfig(), ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.put('/automations/appointments', config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (key, patch) => {
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const updateStep = (sectionKey, idx, field, value) => {
    setConfig((prev) => {
      const steps = [...(prev[sectionKey]?.steps || [])];
      steps[idx] = { ...steps[idx], [field]: value };
      return { ...prev, [sectionKey]: { ...prev[sectionKey], steps } };
    });
  };

  const updateStepOffset = (sectionKey, idx, offsetParts) => {
    updateStep(sectionKey, idx, 'offset_minutes', toOffsetMinutes(offsetParts));
  };

  const addStep = (sectionKey) => {
    const defaults = {
      confirmations: { offset_minutes: 0, message: 'Hi {firstName}! Your appointment with {businessName} is confirmed for {appointmentDate} at {appointmentTime}.' },
      reminders: { offset_minutes: -1440, message: 'Hi {firstName}! Reminder: appointment with {businessName} on {appointmentDate} at {appointmentTime}.' },
      postAppointment: { offset_minutes: 1440, message: 'Hi {firstName}! Hope your visit to {businessName} went well.' },
      reviewRequests: { offset_minutes: 2880, message: 'Hi {firstName}! We\'d love a quick review: {reviewLink}' },
      rebooking: { offset_minutes: 43200, message: 'Hi {firstName}! Ready to book again with {businessName}? {bookingLink}' },
    };
    const d = defaults[sectionKey] || defaults.reminders;
    setConfig((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        steps: [
          ...(prev[sectionKey]?.steps || []),
          {
            id: newStepId(),
            enabled: true,
            channel: 'sms',
            offset_minutes: d.offset_minutes,
            message: d.message,
            email_subject: 'Message from {businessName}',
          },
        ],
      },
    }));
  };

  const removeStep = (sectionKey, idx) => {
    setConfig((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        steps: (prev[sectionKey]?.steps || []).filter((_, i) => i !== idx),
      },
    }));
  };

  const updateEventMessage = (key, field, value) => {
    setConfig((prev) => ({
      ...prev,
      eventMessages: {
        ...prev.eventMessages,
        [key]: { ...prev.eventMessages[key], [field]: value },
      },
    }));
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const data = await api.post('/automations/generate-messages', { category: tab });
      updateSection(tab, { steps: data.steps });
      setChatMessages([{
        role: 'ai',
        text: `I generated ${data.steps.length} message(s) for ${WORKFLOW_TABS.find((t) => t.key === tab)?.label}. Review below or tell me what to change.`,
      }]);
      setChatOpen(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || refining) return;
    const instruction = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', text: instruction }]);
    setRefining(true);
    try {
      const data = await api.post('/automations/refine-messages', {
        category: tab,
        currentSteps: config[tab]?.steps || [],
        instruction,
      });
      updateSection(tab, { steps: data.steps });
      setChatMessages((prev) => [...prev, { role: 'ai', text: 'Done! I updated the messages based on your feedback.' }]);
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: `Sorry, something went wrong: ${err.message}` }]);
    } finally {
      setRefining(false);
    }
  };

  if (loading) return <div className="page-loader">Loading workflows...</div>;

  const section = config[tab] || { enabled: true, steps: [] };

  return (
    <>
      {saved && <div className="automation-inline-saved"><span className="save-badge">Saved</span></div>}

      <div className="settings-tabs automation-tabs">
        {WORKFLOW_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`settings-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div className="settings-card">
        <div className="followup-header-row">
          <div className="automation-section-header" style={{ marginBottom: 0, flex: 1 }}>
            <div>
              <h3>{WORKFLOW_TABS.find((t) => t.key === tab)?.label}</h3>
              <p className="settings-desc">
                Use template variables:{' '}
                {TEMPLATE_VARS.map((v) => <code key={v}>{v}</code>)}
              </p>
            </div>
          </div>
          <button type="button" className="btn-ai" onClick={generateWithAI} disabled={generating}>
            {generating ? (
              <><span className="ai-spinner" /> Generating...</>
            ) : (
              <><svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor" /></svg> Generate with AI</>
            )}
          </button>
        </div>

        <div className="automation-section-header">
          <span className="settings-desc" style={{ marginBottom: 0 }}>Enable or disable this sequence</span>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={section.enabled !== false}
              onChange={(e) => updateSection(tab, { enabled: e.target.checked })}
            />
            <span className="toggle-slider" />
            Enabled
          </label>
        </div>

        {section.enabled !== false && (
          <>
            <div className="schedule-list">
              {(section.steps || []).map((step, idx) => (
                <StepEditor
                  key={step.id || idx}
                  step={step}
                  idx={idx}
                  showImmediate={tab === 'confirmations'}
                  onUpdate={(field, value) => updateStep(tab, idx, field, value)}
                  onUpdateOffset={(parts) => updateStepOffset(tab, idx, parts)}
                  onRemove={() => removeStep(tab, idx)}
                  canRemove={(section.steps || []).length > 1}
                />
              ))}
            </div>
            <button type="button" className="btn-secondary" onClick={() => addStep(tab)}>+ Add Step</button>
          </>
        )}

        {tab === 'confirmations' && (
          <>
            <hr className="settings-divider" />
            <h3>Event Messages</h3>
            <p className="settings-desc">Sent immediately when an appointment is cancelled or rescheduled.</p>
            <EventMessageEditor
              title="Cancellation"
              config={config.eventMessages?.cancellation}
              onChange={(field, value) => updateEventMessage('cancellation', field, value)}
            />
            <EventMessageEditor
              title="Reschedule"
              config={config.eventMessages?.reschedule}
              onChange={(field, value) => updateEventMessage('reschedule', field, value)}
            />
          </>
        )}

        {chatOpen && (
          <div className="ai-chat-panel">
            <div className="ai-chat-header">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor" /></svg>
              AI Assistant
              <button type="button" className="ai-chat-close" onClick={() => setChatOpen(false)}>×</button>
            </div>
            <div className="ai-chat-messages">
              {chatMessages.map((m, i) => (
                <div key={i} className={`ai-msg ${m.role}`}><p>{m.text}</p></div>
              ))}
              {refining && <div className="ai-msg ai"><p className="ai-typing">Thinking...</p></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="ai-chat-input">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="e.g. Make it more casual and mention our loyalty program"
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
              />
              <button type="button" className="btn-primary" onClick={sendChatMessage} disabled={refining}>Send</button>
            </div>
          </div>
        )}

        <div className="settings-actions">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving...' : 'Save Automations'}
          </button>
        </div>
      </div>
    </>
  );
}

function StepEditor({ step, idx, showImmediate, onUpdate, onUpdateOffset, onRemove, canRemove }) {
  const offset = parseOffset(step.offset_minutes ?? 0);

  return (
    <div className="schedule-step">
      <div className="step-header">
        <span className="step-number">Step {idx + 1}</span>
        <span className="step-delay">{formatOffsetLabel(step.offset_minutes ?? 0)}</span>
        <label className="toggle-label step-toggle">
          <input type="checkbox" checked={step.enabled !== false} onChange={(e) => onUpdate('enabled', e.target.checked)} />
          <span className="toggle-slider" />
        </label>
        {canRemove && (
          <button type="button" className="step-remove" onClick={onRemove}>Remove</button>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label>Timing</label>
          <select value={offset.direction} onChange={(e) => onUpdateOffset({ ...offset, direction: e.target.value })}>
            {showImmediate && <option value="immediate">Immediately</option>}
            <option value="before">Before appointment</option>
            <option value="after">After appointment</option>
          </select>
        </div>
        {offset.direction !== 'immediate' && (
          <>
            <div className="field" style={{ maxWidth: 100 }}>
              <label>Value</label>
              <input type="number" min="1" value={offset.value} onChange={(e) => onUpdateOffset({ ...offset, value: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ maxWidth: 120 }}>
              <label>Unit</label>
              <select value={offset.unit} onChange={(e) => onUpdateOffset({ ...offset, unit: e.target.value })}>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </>
        )}
        <div className="field" style={{ maxWidth: 140 }}>
          <label>Channel</label>
          <select value={step.channel || 'sms'} onChange={(e) => onUpdate('channel', e.target.value)}>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {(step.channel === 'email' || step.channel === 'both') && (
        <div className="field">
          <label>Email subject</label>
          <input value={step.email_subject || ''} onChange={(e) => onUpdate('email_subject', e.target.value)} placeholder="Subject — {businessName}" />
        </div>
      )}

      <div className="field">
        <label>Message</label>
        <textarea rows={3} value={step.message || ''} onChange={(e) => onUpdate('message', e.target.value)} disabled={step.enabled === false} />
      </div>
    </div>
  );
}

function EventMessageEditor({ title, config, onChange }) {
  if (!config) return null;
  return (
    <div className="event-message-block">
      <div className="automation-section-header" style={{ marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14 }}>{title}</h4>
        <label className="toggle-label">
          <input type="checkbox" checked={config.enabled !== false} onChange={(e) => onChange('enabled', e.target.checked)} />
          <span className="toggle-slider" />
          Enabled
        </label>
      </div>
      <div className="field-row">
        <div className="field" style={{ maxWidth: 140 }}>
          <label>Channel</label>
          <select value={config.channel || 'sms'} onChange={(e) => onChange('channel', e.target.value)}>
            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
      {(config.channel === 'email' || config.channel === 'both') && (
        <div className="field">
          <label>Email subject</label>
          <input value={config.email_subject || ''} onChange={(e) => onChange('email_subject', e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>Message</label>
        <textarea rows={2} value={config.message || ''} onChange={(e) => onChange('message', e.target.value)} disabled={config.enabled === false} />
      </div>
    </div>
  );
}
