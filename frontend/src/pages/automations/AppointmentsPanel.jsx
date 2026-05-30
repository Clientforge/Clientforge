import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  APPT_STATUS_STYLES, JOB_STATUS_STYLES, formatDateTime,
} from './shared';

export default function AppointmentsPanel() {
  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const data = await api.get(`/automations/appointment-records?${params}`);
      setAppointments(data.appointments);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id) => {
    setDetailLoading(true);
    setSelectedId(id);
    try {
      const data = await api.get(`/automations/appointment-records/${id}`);
      setDetail(data);
    } catch (err) {
      console.error(err);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { load(); }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  return (
    <div className="automation-split-view">
      <div className="automation-list-pane">
        <form className="filter-bar automation-filter" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Search name, phone, service..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-sm">Search</button>
        </form>

        <div className="filter-bar" style={{ marginBottom: 16 }}>
          {['', 'scheduled', 'rescheduled', 'cancelled', 'completed'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="page-loader">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="empty-state card"><p>No appointments yet</p><p className="muted">Appointments from Calendly, Google Calendar, or forwarded booking emails will appear here.</p></div>
        ) : (
          <>
            <div className="card automation-record-list">
              {appointments.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`automation-record-item ${selectedId === a.id ? 'active' : ''}`}
                  onClick={() => loadDetail(a.id)}
                >
                  <div className="record-item-top">
                    <strong>{a.contactName}</strong>
                    <span className="status-badge" style={{
                      background: APPT_STATUS_STYLES[a.status]?.bg || '#f3f4f6',
                      color: APPT_STATUS_STYLES[a.status]?.color || '#6b7280',
                    }}>
                      {a.status}
                    </span>
                  </div>
                  <div className="record-item-meta muted">
                    {formatDateTime(a.scheduledAt)} · {a.provider}
                    {a.serviceName ? ` · ${a.serviceName}` : ''}
                  </div>
                  <div className="record-item-stats">
                    {a.sentCount}/{a.jobCount} messages sent
                    {a.pendingCount > 0 && <span className="pending-dot">{a.pendingCount} scheduled</span>}
                  </div>
                </button>
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="pagination">
                {Array.from({ length: pagination.totalPages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`page-btn ${pagination.page === i + 1 ? 'active' : ''}`}
                    onClick={() => load(i + 1)}
                  >
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
            <p>Select an appointment</p>
            <p className="muted">View the automation timeline — scheduled, sent, and failed messages.</p>
          </div>
        ) : detailLoading ? (
          <div className="page-loader">Loading timeline...</div>
        ) : !detail ? (
          <div className="empty-state"><p>Could not load appointment</p></div>
        ) : (
          <AppointmentTimeline detail={detail} />
        )}
      </div>
    </div>
  );
}

function AppointmentTimeline({ detail }) {
  const { appointment, contact, workflowJobs } = detail;

  return (
    <div className="appointment-timeline">
      <div className="timeline-header">
        <h3>{appointment.contactName}</h3>
        <span className="status-badge" style={{
          background: APPT_STATUS_STYLES[appointment.status]?.bg,
          color: APPT_STATUS_STYLES[appointment.status]?.color,
        }}>
          {appointment.status}
        </span>
      </div>

      <div className="timeline-meta">
        <div><span className="muted">When</span> {formatDateTime(appointment.scheduledAt, appointment.timezone)}</div>
        <div><span className="muted">Service</span> {appointment.serviceName || '—'}</div>
        {appointment.matchedServiceName && (
          <div>
            <span className="muted">Matched</span>{' '}
            {appointment.matchedServiceName}
            {appointment.matchedReturnIntervalDays
              ? ` · rebook in ${appointment.matchedReturnIntervalDays} days`
              : ''}
          </div>
        )}
        <div><span className="muted">Source</span> {appointment.provider}</div>
        <div><span className="muted">Contact</span> {contact.phone || contact.email || '—'}</div>
      </div>

      <hr className="settings-divider" />

      <h4>Automation Timeline</h4>
      <p className="settings-desc">Messages scheduled or sent for this appointment.</p>

      {workflowJobs.length === 0 ? (
        <p className="muted">No workflow messages yet.</p>
      ) : (
        <div className="timeline-list">
          {workflowJobs.map((job) => (
            <div key={job.id} className={`timeline-item timeline-${job.status}`}>
              <div className="timeline-item-marker" />
              <div className="timeline-item-body">
                <div className="timeline-item-top">
                  <strong>{job.jobTypeLabel}</strong>
                  <span className="status-badge" style={{
                    background: JOB_STATUS_STYLES[job.status]?.bg,
                    color: JOB_STATUS_STYLES[job.status]?.color,
                  }}>
                    {JOB_STATUS_STYLES[job.status]?.label || job.status}
                  </span>
                </div>
                <div className="timeline-item-meta muted">
                  {job.channel.toUpperCase()} · {formatDateTime(job.scheduledAt, appointment.timezone)}
                  {job.sentAt && ` · Sent ${formatDateTime(job.sentAt, appointment.timezone)}`}
                </div>
                {job.messageBody && (
                  <p className="timeline-message">{job.messageBody}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
