export const WORKFLOW_TABS = [
  { key: 'confirmations', label: 'Booking Confirmations' },
  { key: 'reminders', label: 'Reminder Sequences' },
  { key: 'postAppointment', label: 'Post-Appointment' },
  { key: 'reviewRequests', label: 'Review Requests' },
  { key: 'rebooking', label: 'Rebooking' },
];

export const CHANNELS = [
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'SMS + Email' },
];

export const TEMPLATE_VARS = [
  '{firstName}', '{lastName}', '{businessName}', '{serviceName}',
  '{appointmentDate}', '{appointmentTime}', '{bookingLink}', '{reviewLink}',
];

export const PARSE_STATUS_STYLES = {
  parsed: { bg: '#d1fae5', color: '#059669', label: 'Parsed' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
  needs_review: { bg: '#fef3c7', color: '#d97706', label: 'Needs review' },
  unroutable: { bg: '#fee2e2', color: '#dc2626', label: 'Unroutable' },
  ambiguous: { bg: '#ede9fe', color: '#7c3aed', label: 'Ambiguous' },
  pending: { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
};

export const JOB_STATUS_STYLES = {
  pending: { bg: '#dbeafe', color: '#2563eb', label: 'Scheduled' },
  sent: { bg: '#d1fae5', color: '#059669', label: 'Sent' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled' },
  failed: { bg: '#fee2e2', color: '#dc2626', label: 'Failed' },
};

export const APPT_STATUS_STYLES = {
  scheduled: { bg: '#dbeafe', color: '#2563eb' },
  confirmed: { bg: '#d1fae5', color: '#059669' },
  rescheduled: { bg: '#fef3c7', color: '#d97706' },
  cancelled: { bg: '#fee2e2', color: '#dc2626' },
  completed: { bg: '#d1fae5', color: '#059669' },
  no_show: { bg: '#fee2e2', color: '#dc2626' },
};

export const emptyConfig = () => ({
  confirmations: { enabled: true, steps: [] },
  reminders: { enabled: true, steps: [] },
  postAppointment: { enabled: true, steps: [] },
  reviewRequests: { enabled: false, steps: [] },
  rebooking: { enabled: false, followupIntervalDays: 14, steps: [] },
  eventMessages: {
    cancellation: { enabled: true, channel: 'sms', message: '', email_subject: '' },
    reschedule: { enabled: true, channel: 'sms', message: '', email_subject: '' },
  },
});

export const parseOffset = (minutes) => {
  const abs = Math.abs(minutes);
  if (minutes === 0) return { direction: 'immediate', value: 0, unit: 'hours' };
  const direction = minutes < 0 ? 'before' : 'after';
  if (abs % 1440 === 0) return { direction, value: abs / 1440, unit: 'days' };
  if (abs % 60 === 0) return { direction, value: abs / 60, unit: 'hours' };
  return { direction, value: abs, unit: 'minutes' };
};

export const toOffsetMinutes = ({ direction, value, unit }) => {
  if (direction === 'immediate') return 0;
  const mult = unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
  const mins = Number(value) * mult;
  return direction === 'before' ? -mins : mins;
};

export const formatOffsetLabel = (minutes) => {
  if (minutes === 0) return 'Immediately on booking';
  const { direction, value, unit } = parseOffset(minutes);
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit;
  return `${value} ${unitLabel} ${direction === 'before' ? 'before appointment' : 'after appointment'}`;
};

export const newStepId = () => `step-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const formatDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};
