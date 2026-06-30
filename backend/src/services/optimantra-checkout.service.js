const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const tenantService = require('./tenant-service.service');
const appointmentWorkflowService = require('./appointment-workflow.service');

const TYPE_PRIORITY = {
  Procedure: 1,
  'Office Visit': 2,
  'Lab Work': 3,
  Other: 4,
};

function pickPrimaryService(services) {
  if (!services?.length) return null;
  const sorted = [...services].sort((a, b) => {
    const pa = TYPE_PRIORITY[a.serviceType] || 99;
    const pb = TYPE_PRIORITY[b.serviceType] || 99;
    return pa - pb;
  });
  return sorted[0];
}

async function findCheckoutByExternalId(tenantId, externalId) {
  const result = await db.query(
    'SELECT id, appointment_id FROM visit_checkouts WHERE tenant_id = $1 AND external_id = $2',
    [tenantId, externalId],
  );
  return result.rows[0] || null;
}

async function findAppointmentForCheckout(tenantId, contactId, { appointmentExternalId, checkedOutAt }) {
  if (appointmentExternalId) {
    const byExternal = await db.query(
      `SELECT id, service_name, status, scheduled_at
       FROM appointments
       WHERE tenant_id = $1 AND external_id = $2
       LIMIT 1`,
      [tenantId, appointmentExternalId],
    );
    if (byExternal.rows[0]) return byExternal.rows[0];
  }

  const checkoutDate = new Date(checkedOutAt);
  if (!Number.isNaN(checkoutDate.getTime())) {
    const dayStart = new Date(checkoutDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(checkoutDate);
    dayEnd.setHours(23, 59, 59, 999);

    const sameDay = await db.query(
      `SELECT id, service_name, status, scheduled_at
       FROM appointments
       WHERE tenant_id = $1
         AND contact_id = $2
         AND provider = 'optimantra'
         AND status IN ('scheduled', 'confirmed', 'rescheduled', 'completed')
         AND scheduled_at >= $3
         AND scheduled_at <= $4
       ORDER BY ABS(EXTRACT(EPOCH FROM (scheduled_at - $5::timestamptz))) ASC
       LIMIT 1`,
      [tenantId, contactId, dayStart.toISOString(), dayEnd.toISOString(), checkedOutAt],
    );
    if (sameDay.rows[0]) return sameDay.rows[0];
  }

  const recent = await db.query(
    `SELECT id, service_name, status, scheduled_at
     FROM appointments
     WHERE tenant_id = $1
       AND contact_id = $2
       AND provider = 'optimantra'
       AND status IN ('scheduled', 'confirmed', 'rescheduled')
       AND scheduled_at <= $3
     ORDER BY scheduled_at DESC
     LIMIT 1`,
    [tenantId, contactId, checkedOutAt],
  );
  return recent.rows[0] || null;
}

async function upsertContactFromCheckout(tenantId, contactData) {
  const contactId = await appointmentService.upsertContact(tenantId, contactData, 'optimantra');

  if (contactData.optimantraPatientId) {
    await db.query(
      `UPDATE contacts
       SET optimantra_patient_id = $2, updated_at = NOW()
       WHERE id = $1 AND (optimantra_patient_id IS NULL OR optimantra_patient_id = $2)`,
      [contactId, String(contactData.optimantraPatientId)],
    );
  }

  return contactId;
}

async function insertCheckoutServices(checkoutId, tenantId, services) {
  let sortOrder = 0;
  for (const item of services) {
    const matched = await tenantService.matchService(tenantId, item.serviceName);
    await db.query(
      `INSERT INTO visit_checkout_services
         (checkout_id, service_name, service_type, matched_service_id, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        checkoutId,
        item.serviceName,
        item.serviceType || 'Other',
        matched?.id || null,
        sortOrder++,
      ],
    );
  }
}

/**
 * Process OptiMantra Superbill Checkout webhook.
 */
async function processSuperbillCheckout(tenantId, normalized) {
  const { contact, checkout, services } = normalized;

  const existing = await findCheckoutByExternalId(tenantId, checkout.externalId);
  if (existing) {
    return {
      duplicate: true,
      checkoutId: existing.id,
      appointmentId: existing.appointment_id,
    };
  }

  const contactId = await upsertContactFromCheckout(tenantId, contact);

  const matchedAppointment = await findAppointmentForCheckout(tenantId, contactId, {
    appointmentExternalId: checkout.appointmentExternalId,
    checkedOutAt: checkout.checkedOutAt,
  });

  const primary = pickPrimaryService(services);
  const primaryServiceName = primary?.serviceName || null;

  const checkoutResult = await db.query(
    `INSERT INTO visit_checkouts
       (tenant_id, contact_id, appointment_id, external_id, provider, checked_out_at, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      tenantId,
      contactId,
      matchedAppointment?.id || null,
      checkout.externalId,
      checkout.provider,
      checkout.checkedOutAt,
      JSON.stringify(checkout.rawPayload),
    ],
  );
  const checkoutId = checkoutResult.rows[0].id;

  await insertCheckoutServices(checkoutId, tenantId, services);

  let appointmentId = matchedAppointment?.id || null;

  if (appointmentId) {
    await db.query(
      `UPDATE appointments SET
         status = 'completed',
         completed_at = $2,
         service_name = COALESCE($3, service_name),
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $4`,
      [appointmentId, checkout.checkedOutAt, primaryServiceName, tenantId],
    );

    if (primaryServiceName) {
      const matched = await tenantService.matchService(tenantId, primaryServiceName);
      if (matched) {
        await tenantService.setAppointmentMatchedService(appointmentId, matched.id);
      }
    }
  }

  const when = new Date(checkout.checkedOutAt);
  if (!Number.isNaN(when.getTime())) {
    await db.query(
      `UPDATE contacts
       SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3), $3), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [contactId, tenantId, when],
    );
  }

  const workflowResult = appointmentId
    ? await appointmentWorkflowService.dispatchCheckoutWorkflows(tenantId, {
      contactId,
      appointmentId,
      checkedOutAt: checkout.checkedOutAt,
      primaryServiceName,
    })
    : { jobsScheduled: 0, skipped: 'no_matching_appointment' };

  return {
    duplicate: false,
    checkoutId,
    contactId,
    appointmentId,
    servicesRecorded: services.length,
    primaryServiceName,
    ...workflowResult,
  };
}

module.exports = {
  processSuperbillCheckout,
  pickPrimaryService,
  findAppointmentForCheckout,
};
