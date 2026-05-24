const db = require('../db/connection');
const { v4: uuidv4 } = require('uuid');

const CATEGORY_KEYS = [
  'confirmations',
  'reminders',
  'post_appointment',
  'review_requests',
  'rebooking',
];

const JOB_TYPE_BY_CATEGORY = {
  confirmations: 'confirmation',
  reminders: 'reminder',
  post_appointment: 'post_visit',
  review_requests: 'review_request',
  rebooking: 'rebooking',
};

const DEFAULT_EVENT_MESSAGES = {
  cancellation: {
    enabled: true,
    channel: 'sms',
    message: 'Hi {firstName}, your appointment with {businessName} has been cancelled. Need to reschedule? Reply to this message.',
    email_subject: 'Appointment Cancelled — {businessName}',
  },
  reschedule: {
    enabled: true,
    channel: 'sms',
    message: 'Hi {firstName}, your appointment with {businessName} has been rescheduled. We\'ll send reminders before your new time.',
    email_subject: 'Appointment Rescheduled — {businessName}',
  },
};

const DEFAULT_STEPS = {
  confirmations: [
    {
      id: 'confirm-default',
      enabled: true,
      channel: 'sms',
      offset_minutes: 0,
      message: 'Hi {firstName}! Your appointment with {businessName} is confirmed for {appointmentDate} at {appointmentTime}. We\'ll send reminders before your visit.',
      email_subject: 'Appointment Confirmed — {businessName}',
    },
  ],
  reminders: [
    {
      id: 'reminder-24h',
      enabled: true,
      channel: 'sms',
      offset_minutes: -1440,
      message: 'Hi {firstName}! Reminder: you have an appointment with {businessName} on {appointmentDate} at {appointmentTime}. Reply if you need to reschedule.',
      email_subject: 'Appointment Reminder — {businessName}',
    },
    {
      id: 'reminder-2h',
      enabled: false,
      channel: 'sms',
      offset_minutes: -120,
      message: 'Hi {firstName}! Your appointment with {businessName} is in 2 hours ({appointmentTime}). See you soon!',
      email_subject: 'Appointment Today — {businessName}',
    },
  ],
  post_appointment: [
    {
      id: 'post-visit-24h',
      enabled: true,
      channel: 'sms',
      offset_minutes: 1440,
      message: 'Hi {firstName}! Hope your visit to {businessName} went well. We\'d love to see you again — book anytime: {bookingLink}',
      email_subject: 'Thank You for Visiting {businessName}',
    },
  ],
  review_requests: [
    {
      id: 'review-48h',
      enabled: false,
      channel: 'sms',
      offset_minutes: 2880,
      message: 'Hi {firstName}! If you enjoyed your visit to {businessName}, we\'d really appreciate a quick review: {reviewLink}',
      email_subject: 'How Was Your Visit? — {businessName}',
    },
  ],
  rebooking: [
    {
      id: 'rebook-initial',
      enabled: true,
      channel: 'sms',
      offset_minutes: 43200,
      message: 'Hi {firstName}! It\'s time for your {serviceName} at {businessName}. Book your next visit: {bookingLink}',
      email_subject: 'Time for your {serviceName} — {businessName}',
    },
    {
      id: 'rebook-followup-1',
      enabled: true,
      channel: 'sms',
      offset_minutes: 0,
      message: 'Hi {firstName}! Just checking in — ready to schedule your next {serviceName} at {businessName}? {bookingLink}',
      email_subject: 'Reminder: Book your {serviceName} — {businessName}',
    },
    {
      id: 'rebook-followup-2',
      enabled: true,
      channel: 'sms',
      offset_minutes: 0,
      message: 'Hi {firstName}, we\'d still love to see you for your {serviceName}. Book at {businessName}: {bookingLink}',
      email_subject: 'Last reminder: {serviceName} at {businessName}',
    },
  ],
};

const buildDefaultConfig = () => ({
  confirmations: { enabled: true, steps: DEFAULT_STEPS.confirmations.map((s) => ({ ...s })) },
  reminders: { enabled: true, steps: DEFAULT_STEPS.reminders.map((s) => ({ ...s })) },
  post_appointment: { enabled: true, steps: DEFAULT_STEPS.post_appointment.map((s) => ({ ...s })) },
  review_requests: { enabled: false, steps: DEFAULT_STEPS.review_requests.map((s) => ({ ...s })) },
  rebooking: { enabled: false, followup_interval_days: 14, steps: DEFAULT_STEPS.rebooking.map((s) => ({ ...s })) },
  event_messages: {
    cancellation: { ...DEFAULT_EVENT_MESSAGES.cancellation },
    reschedule: { ...DEFAULT_EVENT_MESSAGES.reschedule },
  },
});

const normalizeStep = (step, fallback) => ({
  id: step?.id || fallback?.id || uuidv4(),
  enabled: step?.enabled !== false,
  channel: ['sms', 'email', 'both'].includes(step?.channel) ? step.channel : (fallback?.channel || 'sms'),
  offset_minutes: Number.isFinite(Number(step?.offset_minutes))
    ? Number(step.offset_minutes)
    : (fallback?.offset_minutes ?? 0),
  message: typeof step?.message === 'string' && step.message.trim()
    ? step.message.trim()
    : (fallback?.message || ''),
  email_subject: typeof step?.email_subject === 'string'
    ? step.email_subject
    : (fallback?.email_subject || ''),
});

const normalizeCategory = (raw, key) => {
  const defaults = buildDefaultConfig()[key];
  const steps = Array.isArray(raw?.steps) && raw.steps.length > 0
    ? raw.steps.map((step, idx) => normalizeStep(step, defaults.steps[idx] || defaults.steps[0]))
    : defaults.steps.map((s) => ({ ...s }));

  const section = {
    enabled: raw?.enabled !== false,
    steps,
  };

  if (key === 'rebooking') {
    const followupDays = Number(raw?.followup_interval_days ?? raw?.followupIntervalDays);
    section.followup_interval_days = Number.isFinite(followupDays) && followupDays > 0
      ? Math.round(followupDays)
      : defaults.followup_interval_days ?? 14;
  }

  return section;
};

const normalizeEventMessage = (raw, key) => {
  const fallback = DEFAULT_EVENT_MESSAGES[key];
  return {
    enabled: raw?.enabled !== false,
    channel: ['sms', 'email', 'both'].includes(raw?.channel) ? raw.channel : fallback.channel,
    message: typeof raw?.message === 'string' && raw.message.trim() ? raw.message.trim() : fallback.message,
    email_subject: typeof raw?.email_subject === 'string' ? raw.email_subject : fallback.email_subject,
  };
};

const normalizeConfig = (raw) => {
  const base = buildDefaultConfig();
  if (!raw || typeof raw !== 'object') return base;

  const config = { ...base };
  for (const key of CATEGORY_KEYS) {
    config[key] = normalizeCategory(raw[key], key);
  }
  config.event_messages = {
    cancellation: normalizeEventMessage(raw.event_messages?.cancellation, 'cancellation'),
    reschedule: normalizeEventMessage(raw.event_messages?.reschedule, 'reschedule'),
  };

  return config;
};

const toApiConfig = (config) => ({
  confirmations: config.confirmations,
  reminders: config.reminders,
  postAppointment: config.post_appointment,
  reviewRequests: config.review_requests,
  rebooking: {
    ...config.rebooking,
    followupIntervalDays: config.rebooking.followup_interval_days,
  },
  eventMessages: {
    cancellation: config.event_messages.cancellation,
    reschedule: config.event_messages.reschedule,
  },
});

const fromApiConfig = (api) => {
  if (!api || typeof api !== 'object') return null;

  const raw = {};
  if (api.confirmations) raw.confirmations = api.confirmations;
  if (api.reminders) raw.reminders = api.reminders;
  if (api.postAppointment) raw.post_appointment = api.postAppointment;
  if (api.reviewRequests) raw.review_requests = api.reviewRequests;
  if (api.rebooking) {
    raw.rebooking = {
      ...api.rebooking,
      followup_interval_days: api.rebooking.followupIntervalDays ?? api.rebooking.followup_interval_days,
    };
  }
  if (api.eventMessages) {
    raw.event_messages = {
      cancellation: api.eventMessages.cancellation,
      reschedule: api.eventMessages.reschedule,
    };
  }
  return normalizeConfig(raw);
};

const formatAppointmentDateTime = (scheduledAt, timezone) => {
  const date = new Date(scheduledAt);
  const tz = timezone || 'America/New_York';

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  });

  return {
    appointmentDate: dateFmt.format(date),
    appointmentTime: timeFmt.format(date),
  };
};

const renderTemplate = (template, vars) => {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] != null ? String(vars[key]) : `{${key}}`));
};

const buildTemplateVars = ({ tenant, contact, appointment }) => {
  const firstName = contact.first_name || 'there';
  const lastName = contact.last_name || '';
  const { appointmentDate, appointmentTime } = formatAppointmentDateTime(
    appointment.scheduled_at,
    appointment.timezone || tenant.timezone,
  );

  return {
    firstName,
    lastName,
    businessName: tenant.name || 'us',
    serviceName: appointment.service_name || 'your appointment',
    appointmentDate,
    appointmentTime,
    bookingLink: tenant.booking_link || '',
    reviewLink: tenant.review_link || tenant.booking_link || '',
  };
};

const getConfigForTenant = async (tenantId) => {
  const result = await db.query(
    `SELECT appointment_automation_config, name, timezone, phone_number, booking_link
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  if (result.rows.length === 0) {
    throw Object.assign(new Error('Tenant not found'), { statusCode: 404, isOperational: true });
  }
  return normalizeConfig(result.rows[0].appointment_automation_config);
};

const getAutomations = async (tenantId) => {
  const config = await getConfigForTenant(tenantId);
  return toApiConfig(config);
};

const updateAutomations = async (tenantId, updates) => {
  const normalized = fromApiConfig(updates);
  if (!normalized) {
    throw Object.assign(new Error('Invalid automation config'), { statusCode: 400, isOperational: true });
  }

  await db.query(
    'UPDATE tenants SET appointment_automation_config = $1, updated_at = NOW() WHERE id = $2',
    [JSON.stringify(normalized), tenantId],
  );

  return getAutomations(tenantId);
};

const channelsForStep = (channel) => {
  if (channel === 'both') return ['sms', 'email'];
  return [channel];
};

module.exports = {
  CATEGORY_KEYS,
  JOB_TYPE_BY_CATEGORY,
  buildDefaultConfig,
  normalizeConfig,
  getConfigForTenant,
  getAutomations,
  updateAutomations,
  buildTemplateVars,
  renderTemplate,
  channelsForStep,
};
