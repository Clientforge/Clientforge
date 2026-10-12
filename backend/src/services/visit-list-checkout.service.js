const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const { appointmentExternalId } = require('./visitListCsv.parse');

async function findCheckoutByExternalId(tenantId, externalId) {
  const result = await db.query(
    'SELECT id, appointment_id FROM visit_checkouts WHERE tenant_id = $1 AND external_id = $2',
    [tenantId, externalId],
  );
  return result.rows[0] || null;
}

/**
 * One CSV row → contact, completed appointment, checkout, post-visit jobs.
 */
async function processVisitListRow(tenantId, row, { timezone = 'America/Los_Angeles' } = {}) {
  if (!row?.phone) {
    return { skipped: 'no_phone' };
  }

  const externalId = row.externalId || appointmentExternalId(row.phone, row.visitDate);
  const existing = await findCheckoutByExternalId(tenantId, externalId);
  if (existing) {
    return {
      duplicate: true,
      checkoutId: existing.id,
      appointmentId: existing.appointment_id,
    };
  }

  const contactId = await appointmentService.upsertContact(
    tenantId,
    {
      firstName: row.firstName,
      lastName: row.lastName,
      phone: row.phone,
    },
    'visit_list',
  );

  const checkedOutAt = row.checkedOutAt || `${row.visitDate}T17:00:00.000Z`;

  const upserted = await appointmentService.upsertAppointment(
    tenantId,
    contactId,
    {
      externalId,
      provider: 'visit_list',
      scheduledAt: checkedOutAt,
      timezone,
      serviceName: 'Office visit',
      durationMinutes: 30,
      rawPayload: { source: 'visit_list_email', visitDate: row.visitDate },
    },
    'completed',
  );
  const appointmentId = upserted.id;

  await db.query(
    `UPDATE appointments SET completed_at = $2, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $3`,
    [appointmentId, checkedOutAt, tenantId],
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
      externalId,
      'visit_list',
      checkedOutAt,
      JSON.stringify({ visitDate: row.visitDate, phone: row.phone }),
    ],
  );

  const when = new Date(checkedOutAt);
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
    checkedOutAt,
    primaryServiceName: 'Office visit',
    scheduleRebooking: false,
    requireOptimantraCheckout: false,
  });

  return {
    duplicate: false,
    checkoutId: checkoutResult.rows[0].id,
    contactId,
    appointmentId,
    ...workflowResult,
  };
}

module.exports = {
  processVisitListRow,
};
