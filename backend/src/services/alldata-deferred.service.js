const db = require('../db/connection');
const { isAlldataTenant } = require('../config/alldataTenant');
const appointmentService = require('./appointment.service');
const { buildAutoShopBookingTemplateExtras } = require('../utils/autoShopBookingCta');

const JOB_TYPE_PREFIX = 'alldata_deferred_service_followup';
const DEFAULT_FOLLOWUP_SCHEDULE = [7, 14, 30, 60];
const DEFAULT_FOLLOWUP_MESSAGES = [
  'Hi {firstName}! On your recent visit to {businessName}, we noted {serviceList} still needs attention. {bookingCta}',
  'Hi {firstName}, friendly reminder from {businessName} — {serviceList} is still on our recommended list from your last visit. {bookingCta}',
  'Hi {firstName}, checking in from {businessName}. We still have {serviceList} flagged from your visit. {bookingCta}',
  'Hi {firstName}, last reminder from {businessName} about {serviceList} from your recent visit. {bookingCta}',
];
const DEFERRED_JOB_TYPE_SQL = `(job_type LIKE 'alldata_deferred_service_followup%')`;

function jobTypeForStep(stepIndex) {
  return `${JOB_TYPE_PREFIX}_${stepIndex + 1}`;
}

function normalizeFollowupSchedule(raw) {
  const source = Array.isArray(raw) ? raw : DEFAULT_FOLLOWUP_SCHEDULE;
  const days = source
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));
  return days.length > 0 ? days : [...DEFAULT_FOLLOWUP_SCHEDULE];
}

async function getDeferredSettings(tenantId) {
  const result = await db.query(
    `SELECT deferred_followup_enabled, deferred_followup_schedule
     FROM tenant_alldata_connections
     WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  return {
    enabled: row?.deferred_followup_enabled !== false,
    followupSchedule: normalizeFollowupSchedule(row?.deferred_followup_schedule),
  };
}

function formatServiceList(services) {
  const names = services.map((s) => s.serviceName).filter(Boolean);
  if (names.length === 0) return 'recommended service';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names[1]}, and others`;
}

function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function messageForStep(stepIndex, vars) {
  const template = DEFAULT_FOLLOWUP_MESSAGES[stepIndex] || DEFAULT_FOLLOWUP_MESSAGES[0];
  return renderTemplate(template, vars);
}

async function getTenantContext(tenantId) {
  const result = await db.query(
    'SELECT name, booking_link, call_phone FROM tenants WHERE id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function upsertDeferredServiceRow({
  tenantId,
  contactId,
  appointmentId,
  customerId,
  item,
  vehicleLabel,
}) {
  const result = await db.query(
    `INSERT INTO alldata_deferred_services (
       tenant_id, contact_id, appointment_id,
       alldata_customer_id, alldata_repair_order_id, alldata_deferred_id,
       service_name, vehicle_label, deferred_at, due_at, deferred_reason, total_cents,
       status, raw_payload, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13, NOW())
     ON CONFLICT (tenant_id, alldata_deferred_id) DO UPDATE SET
       appointment_id = COALESCE(EXCLUDED.appointment_id, alldata_deferred_services.appointment_id),
       alldata_repair_order_id = COALESCE(EXCLUDED.alldata_repair_order_id, alldata_deferred_services.alldata_repair_order_id),
       service_name = EXCLUDED.service_name,
       vehicle_label = COALESCE(EXCLUDED.vehicle_label, alldata_deferred_services.vehicle_label),
       deferred_at = COALESCE(EXCLUDED.deferred_at, alldata_deferred_services.deferred_at),
       due_at = COALESCE(EXCLUDED.due_at, alldata_deferred_services.due_at),
       deferred_reason = COALESCE(EXCLUDED.deferred_reason, alldata_deferred_services.deferred_reason),
       total_cents = COALESCE(EXCLUDED.total_cents, alldata_deferred_services.total_cents),
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()
     WHERE alldata_deferred_services.status IN ('pending', 'followup_scheduled')
     RETURNING id, alldata_deferred_id, service_name, status`,
    [
      tenantId,
      contactId,
      appointmentId || null,
      customerId,
      item.alldataRepairOrderId || null,
      item.alldataDeferredId,
      item.serviceName,
      vehicleLabel || item.vehicleLabel || null,
      item.deferredAt || null,
      item.dueAt || null,
      item.deferredReason || null,
      item.totalCents,
      JSON.stringify(item.rawPayload || {}),
    ],
  );
  return result.rows[0] || null;
}

async function cancelDeferredFollowupJobs(tenantId, contactId, appointmentId) {
  await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND appointment_id = $3
       AND ${DEFERRED_JOB_TYPE_SQL}
       AND status = 'pending'`,
    [tenantId, contactId, appointmentId],
  );
}

async function hasPendingFollowupJobs(tenantId, contactId, appointmentId) {
  const result = await db.query(
    `SELECT id FROM appointment_workflow_jobs
     WHERE tenant_id = $1
       AND contact_id = $2
       AND appointment_id = $3
       AND ${DEFERRED_JOB_TYPE_SQL}
       AND status = 'pending'
     LIMIT 1`,
    [tenantId, contactId, appointmentId],
  );
  return !!result.rows[0];
}

async function loadDeferredServicesForOrder(tenantId, contactId, orderId, appointmentId = null) {
  if (!orderId && !appointmentId) return [];

  const result = await db.query(
    `SELECT service_name, alldata_repair_order_id, status
     FROM alldata_deferred_services
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status IN ('pending', 'followup_scheduled')
       AND (
         ($3::text IS NOT NULL AND alldata_repair_order_id = $3)
         OR (
           $4::uuid IS NOT NULL
           AND appointment_id = $4
           AND ($3::text IS NULL OR alldata_repair_order_id IS NULL OR alldata_repair_order_id = $3)
         )
       )
     ORDER BY service_name ASC`,
    [tenantId, contactId, orderId ? String(orderId) : null, appointmentId || null],
  );

  return result.rows.map((row) => ({
    serviceName: row.service_name,
    alldataRepairOrderId: row.alldata_repair_order_id,
    status: row.status,
  }));
}

async function markDeferredServicesScheduled(tenantId, contactId, orderId, appointmentId = null) {
  const result = await db.query(
    `UPDATE alldata_deferred_services
     SET status = 'followup_scheduled', updated_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status IN ('pending', 'followup_scheduled')
       AND (
         ($3::text IS NOT NULL AND alldata_repair_order_id = $3)
         OR (
           $4::uuid IS NOT NULL
           AND appointment_id = $4
           AND ($3::text IS NULL OR alldata_repair_order_id IS NULL OR alldata_repair_order_id = $3)
         )
       )`,
    [tenantId, contactId, orderId ? String(orderId) : null, appointmentId || null],
  );
  return result.rowCount;
}

async function scheduleDeferredFollowup({
  tenantId,
  contactId,
  appointmentId,
  orderId,
  services,
  referenceAt,
  followupSchedule,
  forceReschedule = false,
}) {
  if (!appointmentId || !services?.length) {
    return { scheduled: false, reason: 'missing_context' };
  }

  const schedule = normalizeFollowupSchedule(followupSchedule);
  if (!forceReschedule) {
    const alreadyScheduled = await hasPendingFollowupJobs(tenantId, contactId, appointmentId);
    if (alreadyScheduled) {
      return { scheduled: false, reason: 'already_scheduled' };
    }
  }

  const [tenant, contactRow] = await Promise.all([
    getTenantContext(tenantId),
    db.query(
      'SELECT first_name, phone FROM contacts WHERE id = $1 AND tenant_id = $2',
      [contactId, tenantId],
    ),
  ]);

  const contact = contactRow.rows[0];
  if (!contact?.phone) {
    return { scheduled: false, reason: 'no_phone' };
  }

  const serviceList = formatServiceList(services);
  const vars = {
    firstName: contact.first_name || 'there',
    businessName: tenant?.name || 'our shop',
    serviceList,
    ...buildAutoShopBookingTemplateExtras(tenant),
  };

  const base = referenceAt ? new Date(referenceAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { scheduled: false, reason: 'invalid_reference_date' };
  }

  await cancelDeferredFollowupJobs(tenantId, contactId, appointmentId);

  let stepsScheduled = 0;
  for (let stepIndex = 0; stepIndex < schedule.length; stepIndex += 1) {
    const scheduledAt = new Date(base.getTime() + schedule[stepIndex] * 24 * 60 * 60 * 1000);
    if (scheduledAt <= new Date()) continue;

    await appointmentService.scheduleWorkflowJob(
      tenantId,
      appointmentId,
      contactId,
      jobTypeForStep(stepIndex),
      {
        scheduledAt: scheduledAt.toISOString(),
        channel: 'sms',
        messageBody: messageForStep(stepIndex, vars),
      },
    );
    stepsScheduled += 1;
  }

  if (stepsScheduled === 0) {
    return { scheduled: false, reason: 'all_steps_in_past' };
  }

  await markDeferredServicesScheduled(tenantId, contactId, orderId, appointmentId);
  return { scheduled: true, stepsScheduled, serviceList };
}

async function upsertDeferredRows({
  tenantId,
  contactId,
  appointmentId,
  customerId,
  items,
  vehicleLabel,
}) {
  const stored = [];
  for (const item of items || []) {
    const row = await upsertDeferredServiceRow({
      tenantId,
      contactId,
      appointmentId,
      customerId,
      item,
      vehicleLabel,
    });
    if (row) stored.push(row);
  }
  return stored;
}

/**
 * After a completed repair order, schedule deferred SMS for lines tied to that RO.
 */
async function syncDeferredForCompletedOrder({
  tenantId,
  tenantName,
  contactId,
  customerId,
  orderId,
  appointmentId,
  completedAt,
  vehicleLabel,
}) {
  if (!isAlldataTenant(tenantId, tenantName)) {
    return { action: 'deferred_skipped', reason: 'not_alldata_tenant' };
  }

  const settings = await getDeferredSettings(tenantId);
  if (!settings.enabled) {
    return { action: 'deferred_skipped', reason: 'followup_disabled' };
  }

  if (!orderId) {
    return { action: 'deferred_skipped', reason: 'missing_order_id' };
  }

  const pendingRows = await db.query(
    `SELECT alldata_deferred_id, service_name, deferred_at, raw_payload
     FROM alldata_deferred_services
     WHERE tenant_id = $1
       AND contact_id = $2
       AND alldata_repair_order_id = $3
       AND status IN ('pending', 'followup_scheduled')`,
    [tenantId, contactId, String(orderId)],
  );

  if (pendingRows.rows.length === 0) {
    return { action: 'deferred_none', orderId };
  }

  await db.query(
    `UPDATE alldata_deferred_services
     SET appointment_id = COALESCE(appointment_id, $4), updated_at = NOW()
     WHERE tenant_id = $1 AND contact_id = $2 AND alldata_repair_order_id = $3
       AND status IN ('pending', 'followup_scheduled')`,
    [tenantId, contactId, String(orderId), appointmentId || null],
  );

  const services = await loadDeferredServicesForOrder(tenantId, contactId, orderId, appointmentId);
  const followup = await scheduleDeferredFollowup({
    tenantId,
    contactId,
    appointmentId,
    orderId,
    services,
    referenceAt: completedAt,
    followupSchedule: settings.followupSchedule,
    forceReschedule: false,
  });

  return {
    action: 'deferred_synced',
    orderId,
    deferredCount: services.length,
    followup,
    vehicleLabel: vehicleLabel || null,
    customerId,
  };
}

module.exports = {
  getDeferredSettings,
  upsertDeferredRows,
  upsertDeferredServiceRow,
  syncDeferredForCompletedOrder,
  normalizeFollowupSchedule,
  jobTypeForStep,
};
