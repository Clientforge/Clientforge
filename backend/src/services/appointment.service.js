const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');

/**
 * Upsert contact from booking event. Match by tenant_id + phone (or email if no phone).
 */
const upsertContact = async (tenantId, contactData) => {
  const phone = contactData.phone ? normalizePhone(contactData.phone) : null;
  const email = (contactData.email || '').trim().toLowerCase() || null;

  if (!phone && !email) {
    throw Object.assign(new Error('Contact must have phone or email'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  // Try to find existing by phone first
  if (phone) {
    const existing = await db.query(
      'SELECT id FROM contacts WHERE tenant_id = $1 AND phone = $2',
      [tenantId, phone],
    );
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await db.query(
        `UPDATE contacts SET
          first_name = COALESCE(NULLIF($2, ''), first_name),
          last_name = COALESCE(NULLIF($3, ''), last_name),
          email = COALESCE(NULLIF($4, ''), email),
          source = CASE WHEN source = 'import' THEN 'calendly' ELSE source END,
          updated_at = NOW()
         WHERE id = $1`,
        [id, contactData.firstName || '', contactData.lastName || '', contactData.email || ''],
      );
      return id;
    }
  }

  // Try by email if no phone match
  if (email) {
    const existing = await db.query(
      'SELECT id FROM contacts WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenantId, email],
    );
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await db.query(
        `UPDATE contacts SET
          first_name = COALESCE(NULLIF($2, ''), first_name),
          last_name = COALESCE(NULLIF($3, ''), last_name),
          phone = COALESCE(NULLIF($4, ''), phone),
          source = CASE WHEN source = 'import' THEN 'calendly' ELSE source END,
          updated_at = NOW()
         WHERE id = $1`,
        [id, contactData.firstName || '', contactData.lastName || '', phone || ''],
      );
      return id;
    }
  }

  // Create new — need phone for unique constraint; use email-based placeholder if no phone
  const insertPhone = phone || (email ? `e-${email}` : `unknown-${Date.now()}`);
  const result = await db.query(
    `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, source)
     VALUES ($1, $2, $3, $4, $5, 'calendly')
     ON CONFLICT (tenant_id, phone) DO UPDATE SET
       first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), contacts.first_name),
       last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), contacts.last_name),
       email = COALESCE(NULLIF(EXCLUDED.email, ''), contacts.email),
       updated_at = NOW()
     RETURNING id`,
    [
      tenantId,
      contactData.firstName || null,
      contactData.lastName || null,
      insertPhone,
      contactData.email || null,
    ],
  );
  return result.rows[0].id;
};

/**
 * Upsert appointment. Match by tenant_id + external_id.
 */
const upsertAppointment = async (tenantId, contactId, appointmentData, status = 'scheduled') => {
  const { externalId, provider, scheduledAt, timezone, serviceName, durationMinutes, rawPayload } =
    appointmentData;

  const result = await db.query(
    `INSERT INTO appointments (tenant_id, contact_id, external_id, provider, status, scheduled_at, timezone, service_name, duration_minutes, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (tenant_id, external_id) DO UPDATE SET
       contact_id = EXCLUDED.contact_id,
       status = EXCLUDED.status,
       scheduled_at = EXCLUDED.scheduled_at,
       timezone = EXCLUDED.timezone,
       service_name = EXCLUDED.service_name,
       duration_minutes = EXCLUDED.duration_minutes,
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()
     RETURNING id, status`,
    [
      tenantId,
      contactId,
      externalId,
      provider || 'calendly',
      status,
      scheduledAt,
      timezone || 'America/New_York',
      serviceName || null,
      durationMinutes || 30,
      rawPayload ? JSON.stringify(rawPayload) : null,
    ],
  );

  const row = result.rows[0];
  return {
    id: row.id,
    status: row.status,
  };
};

/**
 * Process canonical event from adapter: upsert contact + appointment, return for workflow dispatch.
 */
const processBookingEvent = async (tenantId, { eventType, contact, appointment }) => {
  const contactId = await upsertContact(tenantId, contact);

  let status = 'scheduled';
  if (eventType === 'booking.cancelled') status = 'cancelled';
  else if (eventType === 'booking.rescheduled') status = 'rescheduled';

  const { id: appointmentId } = await upsertAppointment(
    tenantId,
    contactId,
    appointment,
    status,
  );

  return {
    contactId,
    appointmentId,
    eventType,
  };
};

/**
 * Schedule a workflow job (reminder, confirmation, etc.).
 */
const scheduleWorkflowJob = async (tenantId, appointmentId, contactId, jobType, options = {}) => {
  const {
    scheduledAt,
    channel = 'sms',
    messageBody,
    emailSubject,
  } = options;

  await db.query(
    `INSERT INTO appointment_workflow_jobs (tenant_id, appointment_id, contact_id, job_type, channel, message_body, email_subject, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId,
      appointmentId,
      contactId,
      jobType,
      channel,
      messageBody || null,
      emailSubject || null,
      scheduledAt,
    ],
  );
};

/**
 * Cancel all pending workflow jobs for an appointment.
 */
const cancelWorkflowJobsForAppointment = async (appointmentId) => {
  await db.query(
    `UPDATE appointment_workflow_jobs SET status = 'cancelled', cancelled_at = NOW() WHERE appointment_id = $1 AND status = 'pending'`,
    [appointmentId],
  );
};

module.exports = {
  upsertContact,
  upsertAppointment,
  processBookingEvent,
  scheduleWorkflowJob,
  cancelWorkflowJobsForAppointment,
};
