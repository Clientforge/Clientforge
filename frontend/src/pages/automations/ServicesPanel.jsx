import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const TEMPLATE_VARS = ['{firstName}', '{lastName}', '{serviceName}', '{businessName}', '{bookingLink}'];

const emptyService = () => ({
  name: '',
  aliases: [],
  aliasesText: '',
  returnIntervalDays: 28,
  rebookingEnabled: true,
  rebookMessage: '',
  followUpCampaigns: [],
  notes: '',
});

const emptyFollowUpStep = () => ({
  id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  enabled: true,
  intervalDays: 28,
  message: 'Hi {firstName}! Ready to schedule your next {serviceName} at {businessName}? {bookingLink}',
});

export default function ServicesPanel() {
  const [services, setServices] = useState([]);
  const [serviceFollowupCampaignsEnabled, setServiceFollowupCampaignsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/automations/services');
      setServiceFollowupCampaignsEnabled(!!data.serviceFollowupCampaignsEnabled);
      setServices((data.services || []).map((s) => ({
        ...s,
        aliasesText: (s.aliases || []).join(', '),
        followUpCampaigns: Array.isArray(s.followUpCampaigns) ? s.followUpCampaigns : [],
      })));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateService = (idx, field, value) => {
    setServices((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const updateFollowUpStep = (serviceIdx, stepIdx, field, value) => {
    setServices((prev) => {
      const next = [...prev];
      const campaigns = [...(next[serviceIdx].followUpCampaigns || [])];
      campaigns[stepIdx] = { ...campaigns[stepIdx], [field]: value };
      next[serviceIdx] = { ...next[serviceIdx], followUpCampaigns: campaigns };
      return next;
    });
  };

  const addFollowUpStep = (serviceIdx) => {
    setServices((prev) => {
      const next = [...prev];
      next[serviceIdx] = {
        ...next[serviceIdx],
        followUpCampaigns: [...(next[serviceIdx].followUpCampaigns || []), emptyFollowUpStep()],
      };
      return next;
    });
  };

  const removeFollowUpStep = (serviceIdx, stepIdx) => {
    setServices((prev) => {
      const next = [...prev];
      next[serviceIdx] = {
        ...next[serviceIdx],
        followUpCampaigns: (next[serviceIdx].followUpCampaigns || []).filter((_, i) => i !== stepIdx),
      };
      return next;
    });
  };

  const addService = () => {
    setServices((prev) => [...prev, emptyService()]);
  };

  const removeService = (idx) => {
    setServices((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = services.map((s, sortOrder) => ({
        name: s.name,
        aliases: s.aliasesText
          ? s.aliasesText.split(',').map((a) => a.trim()).filter(Boolean)
          : (s.aliases || []),
        returnIntervalDays: s.returnIntervalDays === '' || s.returnIntervalDays == null
          ? null
          : Number(s.returnIntervalDays),
        rebookingEnabled: s.rebookingEnabled !== false,
        rebookMessage: s.rebookMessage || '',
        followUpCampaigns: serviceFollowupCampaignsEnabled
          ? (s.followUpCampaigns || []).map((step) => ({
            id: step.id,
            enabled: step.enabled !== false,
            intervalDays: step.intervalDays === '' || step.intervalDays == null
              ? null
              : Number(step.intervalDays),
            message: step.message || '',
          })).filter((step) => step.intervalDays)
          : [],
        notes: s.notes || '',
        sortOrder,
      }));
      const data = await api.put('/automations/services', { services: payload });
      setServiceFollowupCampaignsEnabled(!!data.serviceFollowupCampaignsEnabled);
      setServices((data.services || []).map((s) => ({
        ...s,
        aliasesText: (s.aliases || []).join(', '),
        followUpCampaigns: Array.isArray(s.followUpCampaigns) ? s.followUpCampaigns : [],
      })));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loader">Loading services...</div>;

  return (
    <div className="settings-card">
      <div className="automation-section-header">
        <div>
          <h3>Services & return intervals</h3>
          <p className="settings-desc">
            When a booking email includes a service name, we match it here and schedule rebooking messages
            after the visit. Use the <strong>Rebooking</strong> workflow tab for the default SMS template
            {serviceFollowupCampaignsEnabled ? (
              <> — or configure <strong>Follow-up Campaigns</strong> per service below.</>
            ) : (
              <>.</>
            )}
          </p>
        </div>
        {saved && <span className="save-badge">Saved</span>}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {services.length === 0 ? (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <p>No services configured yet.</p>
          <button type="button" className="btn-secondary" onClick={addService}>+ Add service</button>
        </div>
      ) : (
        <div className="services-list">
          {services.map((s, idx) => (
            <div key={s.id || idx} className="service-row schedule-step">
              <div className="step-header">
                <span className="step-number">{s.name || `Service ${idx + 1}`}</span>
                <label className="toggle-label step-toggle">
                  <input
                    type="checkbox"
                    checked={s.rebookingEnabled !== false}
                    onChange={(e) => updateService(idx, 'rebookingEnabled', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                  Auto-rebook
                </label>
                <button type="button" className="step-remove" onClick={() => removeService(idx)}>Remove</button>
              </div>
              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Service name</label>
                  <input
                    value={s.name}
                    onChange={(e) => updateService(idx, 'name', e.target.value)}
                    placeholder="Fillers"
                  />
                </div>
                {!serviceFollowupCampaignsEnabled && (
                  <div className="field" style={{ maxWidth: 120 }}>
                    <label>Return (days)</label>
                    <input
                      type="number"
                      min="1"
                      value={s.returnIntervalDays ?? ''}
                      onChange={(e) => updateService(idx, 'returnIntervalDays', e.target.value)}
                      disabled={s.rebookingEnabled === false}
                    />
                  </div>
                )}
              </div>
              <div className="field">
                <label>Aliases (comma-separated)</label>
                <input
                  value={s.aliasesText ?? (s.aliases || []).join(', ')}
                  onChange={(e) => updateService(idx, 'aliasesText', e.target.value)}
                  placeholder="Lip Fillers, Dermal Fillers"
                />
              </div>
              <div className="field">
                <label>Notes (internal)</label>
                <input
                  value={s.notes || ''}
                  onChange={(e) => updateService(idx, 'notes', e.target.value)}
                  placeholder="Every 3–4 months"
                />
              </div>

              {serviceFollowupCampaignsEnabled ? (
                <div className="service-followup-campaigns">
                  <div className="automation-section-header" style={{ marginTop: '12px' }}>
                    <div>
                      <h4>Follow-up Campaigns</h4>
                      <p className="hint">
                        Each follow-up sends on its own schedule — days after the visit or checkout date.
                        Variables: {TEMPLATE_VARS.map((v) => <code key={v}>{v}</code>)}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => addFollowUpStep(idx)}
                      disabled={s.rebookingEnabled === false}
                    >
                      + Add follow-up
                    </button>
                  </div>

                  {(s.followUpCampaigns || []).length === 0 ? (
                    <p className="hint">No follow-ups yet — add steps like 7, 30, or 60 days after the visit.</p>
                  ) : (
                    (s.followUpCampaigns || []).map((step, stepIdx) => (
                      <div key={step.id || stepIdx} className="schedule-step nested-step">
                        <div className="step-header">
                          <span className="step-number">Follow-up {stepIdx + 1}</span>
                          <label className="toggle-label step-toggle">
                            <input
                              type="checkbox"
                              checked={step.enabled !== false}
                              onChange={(e) => updateFollowUpStep(idx, stepIdx, 'enabled', e.target.checked)}
                              disabled={s.rebookingEnabled === false}
                            />
                            <span className="toggle-slider" />
                            Enabled
                          </label>
                          <button
                            type="button"
                            className="step-remove"
                            onClick={() => removeFollowUpStep(idx, stepIdx)}
                          >
                            Remove
                          </button>
                        </div>
                        <div className="field-row">
                          <div className="field" style={{ maxWidth: 140 }}>
                            <label>Days after visit</label>
                            <input
                              type="number"
                              min="1"
                              value={step.intervalDays ?? ''}
                              onChange={(e) => updateFollowUpStep(idx, stepIdx, 'intervalDays', e.target.value)}
                              disabled={s.rebookingEnabled === false || step.enabled === false}
                            />
                          </div>
                        </div>
                        <div className="field">
                          <label>SMS message</label>
                          <textarea
                            rows={2}
                            value={step.message || ''}
                            onChange={(e) => updateFollowUpStep(idx, stepIdx, 'message', e.target.value)}
                            placeholder="Hi {firstName}! Time for your {serviceName} at {businessName}: {bookingLink}"
                            disabled={s.rebookingEnabled === false || step.enabled === false}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>Custom rebook message (optional)</label>
                    <textarea
                      rows={2}
                      value={s.rebookMessage || ''}
                      onChange={(e) => updateService(idx, 'rebookMessage', e.target.value)}
                      placeholder="Hi {firstName}! Time for your {serviceName} at {businessName}: {bookingLink}"
                      disabled={s.rebookingEnabled === false}
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-secondary" onClick={addService}>+ Add service</button>

      <div className="settings-actions">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save services'}
        </button>
      </div>
    </div>
  );
}
