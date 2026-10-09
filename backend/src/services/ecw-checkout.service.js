const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const { normalizeEcwCheckout, patientIdFromEncounter } = require('../adapters/ecw.adapter');

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

module.exports = {
  processEcwEncounterCheckout,
};
