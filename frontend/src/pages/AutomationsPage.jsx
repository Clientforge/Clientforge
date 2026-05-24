import { useState } from 'react';
import WorkflowsPanel from './automations/WorkflowsPanel';
import AppointmentsPanel from './automations/AppointmentsPanel';
import EmailIngestPanel from './automations/EmailIngestPanel';
import ServicesPanel from './automations/ServicesPanel';

const VIEWS = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'services', label: 'Services' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'email', label: 'Email Ingest' },
];

export default function AutomationsPage() {
  const [view, setView] = useState('workflows');

  return (
    <div className="settings-page automations-page">
      <div className="page-header">
        <div>
          <h1>Booking Automations</h1>
          <p className="page-subtitle">
            Configure message sequences, track appointment timelines, and monitor forwarded booking emails
          </p>
        </div>
      </div>

      {view === 'workflows' && (
        <div className="automation-flow-hint">
          <span>Appointment detected</span>
          <span className="flow-arrow">→</span>
          <span>Confirmation</span>
          <span className="flow-arrow">→</span>
          <span>Reminders</span>
          <span className="flow-arrow">→</span>
          <span>Follow-up</span>
          <span className="flow-arrow">→</span>
          <span>Review</span>
          <span className="flow-arrow">→</span>
          <span>Rebook</span>
        </div>
      )}

      <div className="settings-tabs automation-view-tabs">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            className={`settings-tab ${view === v.key ? 'active' : ''}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'workflows' && <WorkflowsPanel />}
      {view === 'services' && <ServicesPanel />}
      {view === 'appointments' && <AppointmentsPanel />}
      {view === 'email' && <EmailIngestPanel />}
    </div>
  );
}
