import { useState, useEffect } from 'react';
import { api } from '../../api/client';

const TEMPLATE_VARS = ['{firstName}', '{lastName}', '{businessName}', '{bookingLink}', '{reviewLink}'];

const emptyConfig = () => ({
  enabled: false,
  message: 'Happy Birthday {firstName}! From all of us at {businessName}, we hope you have an amazing day. Book a treat: {bookingLink}',
  sendHour: 9,
});

const SEND_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`,
}));

export default function BirthdayCampaignPanel() {
  const [config, setConfig] = useState(emptyConfig());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/automations/birthday');
      setConfig({ ...emptyConfig(), ...data });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await api.put('/automations/birthday', config);
      setConfig({ ...emptyConfig(), ...updated });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page-loader">Loading birthday campaign...</div>;
  }

  return (
    <div className="card automation-section">
      <div className="section-header">
        <div>
          <h2>Birthday Campaign</h2>
          <p className="section-desc">
            Every day at the configured time, ClientForge sends a birthday SMS to contacts whose date of birth matches that day.
            Each contact receives at most one birthday message per calendar year.
          </p>
        </div>
        <label className="toggle-row">
          <span className={`status-badge ${config.enabled ? 'enabled' : 'disabled'}`}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
        </label>
      </div>

      {error && <div className="form-error">{error}</div>}
      {saved && <div className="save-success">Birthday campaign saved.</div>}

      <div className="form-group">
        <label>Send time (clinic timezone)</label>
        <select
          value={config.sendHour}
          onChange={(e) => setConfig({ ...config, sendHour: Number(e.target.value) })}
        >
          {SEND_HOURS.map((h) => (
            <option key={h.value} value={h.value}>{h.label}</option>
          ))}
        </select>
        <p className="hint">Uses your clinic timezone from Settings. The check runs once per day at this hour.</p>
      </div>

      <div className="form-group">
        <label>Birthday SMS message</label>
        <textarea
          rows={4}
          value={config.message}
          onChange={(e) => setConfig({ ...config, message: e.target.value })}
          placeholder="Happy Birthday {firstName}! ..."
        />
        <p className="hint template-vars-hint">
          Variables: {TEMPLATE_VARS.map((v) => (
            <code key={v}>{v}</code>
          ))}
        </p>
      </div>

      <div className="automation-note">
        <strong>Contacts need a date of birth.</strong>
        {' '}
        Import or edit contacts with a DOB column (e.g. <code>date_of_birth</code> or <code>dob</code> in CSV).
        Contacts without a birthday on file are skipped. Opted-out contacts are not messaged.
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving...' : 'Save Birthday Campaign'}
        </button>
      </div>
    </div>
  );
}
