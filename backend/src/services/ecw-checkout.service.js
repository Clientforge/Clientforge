const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const ecwService = require('./ecw.service');
const contactService = require('./contact.service');
const {
  normalizeEcwCheckout,
  normalizeEcwUpcomingEncounter,
  patientIdFromEncounter,
  practitionerIdFromEncounter,
  pickPractitionerName,
} = require('../adapters/ecw.adapter');

async function findCheckoutByExternalId(tenantId, externalId) {
  const result = await db.query(
    'SELECT id, appointment_id FROM visit_checkouts WHERE tenant_id = $1 AND external_id = $2',
    [tenantId, externalId],
  );
  return result.rows[0] || null;
}

async function upsertContactFromEcw(tenantId, contactData) {
  return appointmentService.upsertContact(tenantId, contactData, 'ecw');
}

/**
 * Process a finished eCW Encounter (+ Patient) into contact, appointment, checkout, post-visit jobs.
 */
async function processEcwEncounterCheckout(tenantId, encounter, patient) {
  const normalized = normalizeEcwCheckout(encounter, patient);

  if (!normalized.contact.phone) {
    return { skipped: 'no_phone', encounterId: encounter.id };
  }

  const existing = await findCheckoutByExternalId(tenantId, normalized.checkout.externalId);
  if (existing) {
    return {
      duplicate: true,
      checkoutId: existing.id,
      appointmentId: existing.appointment_id,
    };
  }

  const contactId = await upsertContactFromEcw(tenantId, normalized.contact);

  const upserted = await appointmentService.upsertAppointment(
    tenantId,
    contactId,
    normalized.appointment,
    'completed',
  );
  const appointmentId = upserted.id;

  await db.query(
    `UPDATE appointments SET completed_at = $2, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $3`,
    [appointmentId, normalized.checkout.checkedOutAt, tenantId],
  );

  const checkoutResult = await db.query(
    `INSERT INTO visit_checkouts
       (tenant_id, contact_id, appointment_id, external_id, provider, checked_out_at, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      tenantId,
      contactId,
      appointmentId,
      normalized.checkout.externalId,
      normalized.checkout.provider,
      normalized.checkout.checkedOutAt,
      JSON.stringify(normalized.checkout.rawPayload),
    ],
  );

  const when = new Date(normalized.checkout.checkedOutAt);
  if (!Number.isNaN(when.getTime())) {
    await db.query(
      `UPDATE contacts
       SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3), $3), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [contactId, tenantId, when],
    );
  }

  let practitionerName = null;
  const practitionerId = practitionerIdFromEncounter(encounter);
  if (practitionerId) {
    try {
      const connection = await ecwService.getConnection(tenantId);
      if (connection) {
        const practitioner = await ecwService.fetchPractitioner(connection, practitionerId);
        practitionerName = pickPractitionerName(practitioner);
      }
    } catch (err) {
      console.warn(
        `[ECW] Practitioner fetch failed tenant=${tenantId} encounter=${encounter.id}:`,
        err.message,
      );
    }
  }

  if (normalized.primaryServiceName || practitionerName) {
    await contactService.applyEcwEncounterTags(tenantId, contactId, {
      serviceLabel: normalized.primaryServiceName || undefined,
      practitionerName: practitionerName || undefined,
    });
  }

  const workflowResult = await appointmentWorkflowService.dispatchPostVisitWorkflows(tenantId, {
    contactId,
    appointmentId,
    checkedOutAt: normalized.checkout.checkedOutAt,
    primaryServiceName: normalized.primaryServiceName,
    scheduleRebooking: true,
    requireOptimantraCheckout: false,
  });

  return {
    duplicate: false,
    checkoutId: checkoutResult.rows[0].id,
    contactId,
    appointmentId,
    encounterId: encounter.id,
    patientId: patient?.id || patientIdFromEncounter(encounter),
    ...workflowResult,
  };
}

/**
 * Save a future eCW encounter as a scheduled appointment. Does not check out or send post-visit messages.
 * A completed checkout for the same encounter id is left as-is.
 */
async function processEcwUpcomingEncounter(tenantId, encounter, patient) {
  const normalized = normalizeEcwUpcomingEncounter(encounter, patient);
  if (!normalized.contact.phone) {
    return { skipped: 'no_phone', encounterId: encounter.id };
  }

  const contactId = await upsertContactFromEcw(tenantId, normalized.contact);
  const appt = normalized.appointment;
  const result = await db.query(
    `INSERT INTO appointments
       (tenant_id, contact_id, external_id, provider, status, scheduled_at, timezone, service_name, duration_minutes, raw_payload)
     VALUES ($1, $2, $3, 'ecw', 'scheduled', $4, $5, $6, $7, $8)
     ON CONFLICT (tenant_id, external_id) DO UPDATE SET
       contact_id = CASE
         WHEN appointments.status = 'completed' THEN appointments.contact_id
         ELSE EXCLUDED.contact_id
       END,
       scheduled_at = CASE
         WHEN appointments.status = 'completed' THEN appointments.scheduled_at
         ELSE EXCLUDED.scheduled_at
       END,
       timezone = CASE
         WHEN appointments.status = 'completed' THEN appointments.timezone
         ELSE EXCLUDED.timezone
       END,
       service_name = CASE
         WHEN appointments.status = 'completed' THEN appointments.service_name
         ELSE EXCLUDED.service_name
       END,
       duration_minutes = CASE
         WHEN appointments.status = 'completed' THEN appointments.duration_minutes
         ELSE EXCLUDED.duration_minutes
       END,
       raw_payload = CASE
         WHEN appointments.status = 'completed' THEN appointments.raw_payload
         ELSE EXCLUDED.raw_payload
       END,
       status = CASE
         WHEN appointments.status = 'completed' THEN appointments.status
         ELSE 'scheduled'
       END,
       updated_at = NOW()
     RETURNING id`,
    [
      tenantId,
      contactId,
      appt.externalId,
      appt.scheduledAt,
      appt.timezone || 'America/New_York',
      appt.serviceName || null,
      appt.durationMinutes,
      appt.rawPayload ? JSON.stringify(appt.rawPayload) : null,
    ],
  );

  return {
    upcoming: true,
    contactId,
    appointmentId: result.rows[0].id,
    encounterId: encounter.id,
  };
}

/** Drop a previously saved upcoming visit when eCW marks that encounter cancelled. */
async function cancelEcwEncounterAppointment(tenantId, encounter) {
  if (!encounter?.id) return { skipped: 'no_id' };
  const externalId = `ecw:encounter:${encounter.id}`;
  const result = await db.query(
    `UPDATE appointments
     SET status = 'cancelled', updated_at = NOW()
     WHERE tenant_id = $1 AND external_id = $2 AND status <> 'completed'
     RETURNING id`,
    [tenantId, externalId],
  );
  return result.rows[0]
    ? { cancelled: true, appointmentId: result.rows[0].id, encounterId: encounter.id }
    : { skipped: 'no_appointment', encounterId: encounter.id };
}

module.exports = {
  processEcwEncounterCheckout,
  processEcwUpcomingEncounter,
  cancelEcwEncounterAppointment,
};
