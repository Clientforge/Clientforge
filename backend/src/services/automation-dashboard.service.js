const db = require('../db/connection');
const { inboxEmail } = require('./bookingEmailIngest.service');

const JOB_TYPE_LABELS = {
  confirmation: 'Confirmation',
  reminder: 'Reminder',
  post_visit: 'Post-visit follow-up',
  review_request: 'Review request',
  rebooking: 'Rebooking',
  cancellation: 'Cancellation',
  reschedule: 'Reschedule',
};

const listAppointmentRecords = async (tenantId, { page = 1, limit = 20, status, search } = {}) => {
  const offset = (page - 1) * limit;
  const conditions = ['a.tenant_id = $1'];
  const params = [tenantId];
  let idx = 2;

  if (status) {
    conditions.push(`a.status = $${idx++}`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(
      c.first_name ILIKE $${idx} OR c.last_name ILIKE $${idx} OR
      c.phone ILIKE $${idx} OR c.email ILIKE $${idx} OR
      a.service_name ILIKE $${idx}
    )`);
    params.push(`%${search}%`);
    idx++;
  }

  const where = conditions.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE ${where}`,
    params,
  );
  const total = countResult.rows[0]?.total || 0;

  const result = await db.query(
    `SELECT a.id, a.external_id, a.provider, a.status, a.scheduled_at, a.timezone,
            a.service_name, a.duration_minutes, a.created_at,
            c.id AS contact_id, c.first_name, c.last_name, c.phone, c.email,
            (SELECT COUNT(*)::int FROM appointment_workflow_jobs j WHERE j.appointment_id = a.id) AS job_count,
            (SELECT COUNT(*)::int FROM appointment_workflow_jobs j WHERE j.appointment_id = a.id AND j.status = 'sent') AS sent_count,
            (SELECT COUNT(*)::int FROM appointment_workflow_jobs j WHERE j.appointment_id = a.id AND j.status = 'pending') AS pending_count
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE ${where}
     ORDER BY a.scheduled_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  return {
    appointments: result.rows.map(mapAppointmentRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getAppointmentRecord = async (tenantId, appointmentId) => {
  const apptResult = await db.query(
    `SELECT a.*, c.first_name, c.last_name, c.phone, c.email
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE a.id = $1 AND a.tenant_id = $2`,
    [appointmentId, tenantId],
  );

  if (apptResult.rows.length === 0) {
    throw Object.assign(new Error('Appointment not found'), { statusCode: 404, isOperational: true });
  }

  const jobsResult = await db.query(
    `SELECT id, job_type, channel, message_body, email_subject, scheduled_at, status, sent_at, cancelled_at, created_at
     FROM appointment_workflow_jobs
     WHERE appointment_id = $1
     ORDER BY scheduled_at ASC, created_at ASC`,
    [appointmentId],
  );

  const row = apptResult.rows[0];
  return {
    appointment: mapAppointmentRow(row),
    contact: {
      id: row.contact_id,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
    },
    workflowJobs: jobsResult.rows.map(mapJobRow),
  };
};

const listBookingEmails = async (tenantId, { page = 1, limit = 20, parseStatus } = {}) => {
  const offset = (page - 1) * limit;
  const conditions = ['tenant_id = $1'];
  const params = [tenantId];
  let idx = 2;

  if (parseStatus) {
    conditions.push(`parse_status = $${idx++}`);
    params.push(parseStatus);
  }

  const where = conditions.join(' AND ');

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM booking_email_messages WHERE ${where}`,
    params,
  );
  const total = countResult.rows[0]?.total || 0;

  const result = await db.query(
    `SELECT id, message_id, from_address, subject, parse_status, received_at,
            appointment_id, error_message, parsed, created_at
     FROM booking_email_messages
     WHERE ${where}
     ORDER BY COALESCE(received_at, created_at) DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset],
  );

  return {
    emails: result.rows.map(mapEmailRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

const getBookingEmail = async (tenantId, emailId) => {
  const result = await db.query(
    `SELECT id, message_id, inbox_email, from_address, subject, body_text, body_html,
            parse_status, received_at, appointment_id, error_message, parsed, created_at
     FROM booking_email_messages
     WHERE id = $1 AND tenant_id = $2`,
    [emailId, tenantId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Booking email not found'), { statusCode: 404, isOperational: true });
  }

  return mapEmailDetail(result.rows[0]);
};

const getBookingEmailSetup = async (tenantId) => {
  const aliasResult = await db.query(
    `SELECT id, alias, match_type, priority, active, created_at
     FROM tenant_booking_email_aliases
     WHERE tenant_id = $1
     ORDER BY priority DESC, alias ASC`,
    [tenantId],
  );

  const tenantResult = await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);

  return {
    inboxEmail: inboxEmail(),
    businessName: tenantResult.rows[0]?.name || '',
    aliases: aliasResult.rows.map((r) => ({
      id: r.id,
      alias: r.alias,
      matchType: r.match_type,
      priority: r.priority,
      active: r.active,
      createdAt: r.created_at,
    })),
  };
};

const updateBookingEmailAliases = async (tenantId, aliases) => {
  if (!Array.isArray(aliases)) {
    throw Object.assign(new Error('aliases must be an array'), { statusCode: 400, isOperational: true });
  }

  await db.query('DELETE FROM tenant_booking_email_aliases WHERE tenant_id = $1', [tenantId]);

  for (const row of aliases) {
    const alias = String(row.alias || '').trim();
    if (!alias) continue;

    await db.query(
      `INSERT INTO tenant_booking_email_aliases (tenant_id, alias, match_type, priority, active)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        tenantId,
        alias,
        row.matchType === 'exact' ? 'exact' : 'contains',
        Number(row.priority) || 0,
        row.active !== false,
      ],
    );
  }

  return getBookingEmailSetup(tenantId);
};

const mapAppointmentRow = (row) => ({
  id: row.id,
  externalId: row.external_id,
  provider: row.provider,
  status: row.status,
  scheduledAt: row.scheduled_at,
  timezone: row.timezone,
  serviceName: row.service_name,
  durationMinutes: row.duration_minutes,
  createdAt: row.created_at,
  contactId: row.contact_id,
  contactName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'Unknown',
  contactPhone: row.phone,
  contactEmail: row.email,
  jobCount: row.job_count ?? 0,
  sentCount: row.sent_count ?? 0,
  pendingCount: row.pending_count ?? 0,
});

const mapJobRow = (row) => ({
  id: row.id,
  jobType: row.job_type,
  jobTypeLabel: JOB_TYPE_LABELS[row.job_type] || row.job_type,
  channel: row.channel,
  messageBody: row.message_body,
  emailSubject: row.email_subject,
  scheduledAt: row.scheduled_at,
  status: row.status,
  sentAt: row.sent_at,
  cancelledAt: row.cancelled_at,
  createdAt: row.created_at,
});

const mapEmailRow = (row) => ({
  id: row.id,
  messageId: row.message_id,
  fromAddress: row.from_address,
  subject: row.subject,
  parseStatus: row.parse_status,
  receivedAt: row.received_at,
  appointmentId: row.appointment_id,
  errorMessage: row.error_message,
  customerName: row.parsed?.contact?.firstName
    ? [row.parsed.contact.firstName, row.parsed.contact.lastName].filter(Boolean).join(' ')
    : row.parsed?.contactName || null,
  scheduledAt: row.parsed?.appointment?.scheduledAt || row.parsed?.scheduledAt || null,
  createdAt: row.created_at,
});

const mapEmailDetail = (row) => ({
  ...mapEmailRow(row),
  inboxEmail: row.inbox_email,
  bodyText: row.body_text,
  bodyHtml: row.body_html,
  parsed: row.parsed,
});

module.exports = {
  listAppointmentRecords,
  getAppointmentRecord,
  listBookingEmails,
  getBookingEmail,
  getBookingEmailSetup,
  updateBookingEmailAliases,
  JOB_TYPE_LABELS,
};
