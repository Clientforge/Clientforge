const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');

const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'rescheduled'];
const SAME_TIME_MS = 60 * 1000;

const servicesMatch = (a, b) => {
  if (!a || !b) return true;
  const x = String(a).toLowerCase().trim();
  const y = String(b).toLowerCase().trim();
  return x.includes(y) || y.includes(x);
};

/**
 * Decide whether an incoming booking.rescheduled event is a true reschedule
 * (existing appointment moved to a new time) vs a first-time confirmation
 * (email template says "rescheduled" but no prior appointment exists).
 */
const resolveEventTypeFromExisting = (incomingEventType, {
  scheduledAt,
  serviceName,
  priorByExternalId,
  priorByContact,
}) => {
  if (incomingEventType === 'booking.cancelled') {
    return {
      eventType: 'booking.cancelled',
      existingAppointmentId: priorByExternalId?.id || null,
    };
  }

  const newTime = new Date(scheduledAt).getTime();

  if (priorByExternalId) {
    const oldTime = new Date(priorByExternalId.scheduled_at).getTime();
    const isActive = ACTIVE_APPOINTMENT_STATUSES.includes(priorByExternalId.status);

    if (!Number.isNaN(newTime) && !Number.isNaN(oldTime) && isActive) {
      if (Math.abs(oldTime - newTime) <= SAME_TIME_MS) {
        return {
          eventType: 'booking.unchanged',
          existingAppointmentId: priorByExternalId.id,
          existingStatus: priorByExternalId.status,
        };
      }
      return { eventType: 'booking.rescheduled', existingAppointmentId: priorByExternalId.id };
    }

    return { eventType: 'booking.created', existingAppointmentId: priorByExternalId.id };
  }

  if (!Number.isNaN(newTime)) {
    for (const row of priorByContact || []) {
      if (!ACTIVE_APPOINTMENT_STATUSES.includes(row.status)) continue;
      if (!servicesMatch(serviceName, row.service_name)) continue;

      const oldTime = new Date(row.scheduled_at).getTime();
      if (Number.isNaN(oldTime)) continue;

      if (Math.abs(oldTime - newTime) <= SAME_TIME_MS) {
        return {
          eventType: 'booking.unchanged',
          existingAppointmentId: row.id,
          existingStatus: row.status,
        };
      }
      if (incomingEventType === 'booking.rescheduled') {
        return { eventType: 'booking.rescheduled', existingAppointmentId: row.id };
      }
    }
  }

  if (incomingEventType === 'booking.rescheduled') {
    return { eventType: 'booking.created', existingAppointmentId: null };
  }

  return { eventType: incomingEventType, existingAppointmentId: null };
};

const findPriorAppointmentByExternalId = async (tenantId, externalId) => {
  if (!externalId) return null;
  const result = await db.query(
    `SELECT id, scheduled_at, service_name, status
     FROM appointments WHERE tenant_id = $1 AND external_id = $2`,
    [tenantId, externalId],
  );
  return result.rows[0] || null;
};

const findPriorAppointmentsByContact = async (tenantId, contactId) => {
  const result = await db.query(
    `SELECT id, scheduled_at, service_name, status
     FROM appointments
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status = ANY($3::text[])
       AND scheduled_at > NOW() - INTERVAL '180 days'
     ORDER BY scheduled_at DESC
     LIMIT 10`,
    [tenantId, contactId, ACTIVE_APPOINTMENT_STATUSES],
  );
  return result.rows;
};

const classifyBookingEvent = async (tenantId, contactId, incomingEventType, appointment) => {
  const priorByExternalId = await findPriorAppointmentByExternalId(
    tenantId,
    appointment?.externalId,
  );
  const priorByContact = priorByExternalId
    ? []
    : await findPriorAppointmentsByContact(tenantId, contactId);

  return resolveEventTypeFromExisting(incomingEventType, {
    scheduledAt: appointment?.scheduledAt,
    serviceName: appointment?.serviceName,
    priorByExternalId,
    priorByContact,
  });
};

/**
 * Upsert contact from booking event. Match by tenant_id + phone (or email if no phone).
 */
const findContactByName = async (tenantId, firstName, lastName) => {
  const fn = (firstName || '').trim().toLowerCase();
  const ln = (lastName || '').trim().toLowerCase();
  if (!fn) return null;

  let result;
  if (ln) {
    result = await db.query(
      `SELECT id FROM contacts
       WHERE tenant_id = $1
         AND LOWER(TRIM(COALESCE(first_name, ''))) = $2
         AND LOWER(TRIM(COALESCE(last_name, ''))) = $3
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, fn, ln],
    );
  } else {
    result = await db.query(
      `SELECT id FROM contacts
       WHERE tenant_id = $1
         AND LOWER(TRIM(COALESCE(first_name, ''))) = $2
         AND (last_name IS NULL OR TRIM(last_name) = '')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, fn],
    );
  }

  return result.rows[0]?.id || null;
};

const upsertContact = async (tenantId, contactData, source = 'calendly') => {
  const phone = contactData.phone ? normalizePhone(contactData.phone) : null;
  const email = (contactData.email || '').trim().toLowerCase() || null;

  if (!phone && !email) {
    throw Object.assign(new Error('Contact must have phone or email'), {
      statusCode: 400,
      isOperational: true,
    });
  }

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
          source = CASE WHEN source = 'import' THEN $5 ELSE source END,
          updated_at = NOW()
         WHERE id = $1`,
        [id, contactData.firstName || '', contactData.lastName || '', contactData.email || '', source],
      );
      return id;
    }
  }

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
          source = CASE WHEN source = 'import' THEN $5 ELSE source END,
          updated_at = NOW()
         WHERE id = $1`,
        [id, contactData.firstName || '', contactData.lastName || '', phone || '', source],
      );
      return id;
    }
  }

  const nameMatchId = await findContactByName(tenantId, contactData.firstName, contactData.lastName);
  if (nameMatchId) {
    await db.query(
      `UPDATE contacts SET
        first_name = COALESCE(NULLIF($2, ''), first_name),
        last_name = COALESCE(NULLIF($3, ''), last_name),
        email = COALESCE(NULLIF($4, ''), email),
        phone = COALESCE(NULLIF($5, ''), phone),
        source = CASE WHEN source = 'import' THEN $6 ELSE source END,
        updated_at = NOW()
       WHERE id = $1`,
      [
        nameMatchId,
        contactData.firstName || '',
        contactData.lastName || '',
        email || '',
        phone || '',
        source,
      ],
    );
    return nameMatchId;
  }

  const insertPhone = phone || (email ? `e-${email}` : `unknown-${Date.now()}`);
  const result = await db.query(
    `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, source)
     VALUES ($1, $2, $3, $4, $5, $6)
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
      source,
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

const updateAppointmentById = async (
  tenantId,
  appointmentId,
  contactId,
  appointmentData,
  status,
) => {
  const { scheduledAt, timezone, serviceName, durationMinutes, rawPayload } = appointmentData;

  await db.query(
    `UPDATE appointments SET
       contact_id = $2,
       status = $3,
       scheduled_at = $4,
       timezone = $5,
       service_name = COALESCE($6, service_name),
       duration_minutes = COALESCE($7, duration_minutes),
       raw_payload = COALESCE(raw_payload, '{}'::jsonb) || COALESCE($8::jsonb, '{}'::jsonb),
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $9`,
    [
      appointmentId,
      contactId,
      status,
      scheduledAt,
      timezone || 'America/New_York',
      serviceName || null,
      durationMinutes || 30,
      rawPayload ? JSON.stringify(rawPayload) : null,
      tenantId,
    ],
  );

  return { id: appointmentId, status };
};

const maybeSyncLastVisit = async (tenantId, contactId, scheduledAt) => {
  if (!scheduledAt) return;
  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime()) || when > new Date()) return;
  await db.query(
    `UPDATE contacts
     SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3), $3), updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [contactId, tenantId, when],
  );
};

/**
 * Process canonical event from adapter: upsert contact + appointment, return for workflow dispatch.
 */
const processBookingEvent = async (tenantId, { eventType: incomingEventType, contact, appointment, contactSource }) => {
  const contactId = await upsertContact(tenantId, contact, contactSource || appointment?.provider || 'calendly');

  const classification = await classifyBookingEvent(
    tenantId,
    contactId,
    incomingEventType,
    appointment,
  );
  const eventType = classification.eventType;

  let status = 'scheduled';
  if (eventType === 'booking.cancelled') status = 'cancelled';
  else if (eventType === 'booking.rescheduled') status = 'rescheduled';
  else if (eventType === 'booking.unchanged') status = classification.existingStatus || 'scheduled';

  let appointmentId;
  if (classification.existingAppointmentId && eventType === 'booking.rescheduled') {
    const updated = await updateAppointmentById(
      tenantId,
      classification.existingAppointmentId,
      contactId,
      appointment,
      status,
    );
    appointmentId = updated.id;
  } else {
    const upserted = await upsertAppointment(tenantId, contactId, appointment, status);
    appointmentId = upserted.id;
  }

  if (eventType !== incomingEventType) {
    console.log(
      `[APPT] Reclassified ${incomingEventType} → ${eventType} for contact ${contactId}`
      + (classification.existingAppointmentId ? ` (appointment ${classification.existingAppointmentId})` : ''),
    );
  }

  await maybeSyncLastVisit(tenantId, contactId, appointment?.scheduledAt);

  return {
    contactId,
    appointmentId,
    eventType,
    incomingEventType,
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
  resolveEventTypeFromExisting,
  classifyBookingEvent,
};
