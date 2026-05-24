import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const emptyService = () => ({
  name: '',
  aliases: [],
  aliasesText: '',
  returnIntervalDays: 28,
  rebookingEnabled: true,
  rebookMessage: '',
  notes: '',
});

export default function ServicesPanel() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/automations/services');
      setServices((data.services || []).map((s) => ({
        ...s,
        aliasesText: (s.aliases || []).join(', '),
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
        notes: s.notes || '',
        sortOrder,
      }));
      const data = await api.put('/automations/services', { services: payload });
      setServices((data.services || []).map((s) => ({
        ...s,
        aliasesText: (s.aliases || []).join(', '),
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
            When a booking email includes a service name, we match it here and schedule a rebooking message
            after the return interval. Use the <strong>Rebooking</strong> workflow tab for the default SMS template.
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
