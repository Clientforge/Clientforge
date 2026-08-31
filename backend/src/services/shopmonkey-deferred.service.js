const db = require('../db/connection');
const { isShopmonkeyTenant } = require('../config/shopmonkeyTenant');
const { normalizeDeferredServiceList } = require('../adapters/shopmonkey.adapter');
const appointmentService = require('./appointment.service');

const API_BASE = 'https://api.shopmonkey.cloud/v3';

/** @deprecated legacy single-step job type */
const JOB_TYPE = 'deferred_service_followup';

const DEFAULT_FOLLOWUP_SCHEDULE = [7, 14, 30, 60];

const DEFAULT_FOLLOWUP_MESSAGES = [
  'Hi {firstName}! On your recent visit to {businessName}, we noted {serviceList} still needs attention. When you\'re ready to schedule: {bookingLink}',
  'Hi {firstName}, friendly reminder from {businessName} — {serviceList} is still on our recommended list from your last visit. Book here: {bookingLink}',
  'Hi {firstName}, checking in from {businessName}. We still have {serviceList} flagged from your visit. Schedule when it works for you: {bookingLink}',
  'Hi {firstName}, last reminder from {businessName} about {serviceList} from your recent visit. We\'d love to get this taken care of: {bookingLink}',
];

const DEFERRED_JOB_TYPE_SQL = `(job_type = 'deferred_service_followup' OR job_type LIKE 'deferred_service_followup_%')`;

function jobTypeForStep(stepIndex) {
  return `deferred_service_followup_${stepIndex + 1}`;
}

function isDeferredFollowupJobType(jobType) {
  if (!jobType) return false;
  if (jobType === JOB_TYPE) return true;
  return /^deferred_service_followup_\d+$/.test(String(jobType));
}

function isFinalDeferredFollowupJobType(jobType, scheduleLength = DEFAULT_FOLLOWUP_SCHEDULE.length) {
  if (jobType === JOB_TYPE) return true;
  return jobType === jobTypeForStep(scheduleLength - 1);
}

function normalizeFollowupSchedule(raw) {
  const source = Array.isArray(raw) ? raw : DEFAULT_FOLLOWUP_SCHEDULE;
  const days = source
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => Math.round(value));
  return days.length > 0 ? days : [...DEFAULT_FOLLOWUP_SCHEDULE];
}

async function shopmonkeyFetch(path, apiKey) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.code || res.statusText || 'Shopmonkey API error';
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

async function getTenantContext(tenantId) {
  const result = await db.query(
    `SELECT name, booking_link FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getDeferredSettings(tenantId) {
  const result = await db.query(
    `SELECT deferred_followup_enabled, deferred_followup_schedule
     FROM tenant_shopmonkey_connections
     WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  const schedule = normalizeFollowupSchedule(row?.deferred_followup_schedule);
  return {
    enabled: row?.deferred_followup_enabled !== false,
    followupSchedule: schedule,
  };
}

function isDeferredFollowupEnabled(tenantId, tenantName) {
  return isShopmonkeyTenant(tenantId, tenantName);
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

async function fetchDeferredServicesForCustomer(apiKey, customerId, { orderId } = {}) {
  const response = await shopmonkeyFetch(`/customer/${customerId}/deferred_service`, apiKey);
  return normalizeDeferredServiceList(response, { orderId });
}

async function upsertDeferredServiceRow({
  tenantId,
  contactId,
  appointmentId,
  customerId,
  item,
}) {
  const result = await db.query(
    `INSERT INTO shopmonkey_deferred_services (
       tenant_id, contact_id, appointment_id,
       shopmonkey_customer_id, shopmonkey_order_id, shopmonkey_deferred_id,
       service_name, vehicle_label, deferred_at, deferred_reason, total_cents,
       status, raw_payload, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', $12, NOW())
     ON CONFLICT (tenant_id, shopmonkey_deferred_id) DO UPDATE SET
       appointment_id = COALESCE(EXCLUDED.appointment_id, shopmonkey_deferred_services.appointment_id),
       service_name = EXCLUDED.service_name,
       vehicle_label = COALESCE(EXCLUDED.vehicle_label, shopmonkey_deferred_services.vehicle_label),
       deferred_at = COALESCE(EXCLUDED.deferred_at, shopmonkey_deferred_services.deferred_at),
       deferred_reason = COALESCE(EXCLUDED.deferred_reason, shopmonkey_deferred_services.deferred_reason),
       total_cents = COALESCE(EXCLUDED.total_cents, shopmonkey_deferred_services.total_cents),
       raw_payload = EXCLUDED.raw_payload,
       updated_at = NOW()
     WHERE shopmonkey_deferred_services.status IN ('pending', 'followup_scheduled')
     RETURNING id, shopmonkey_deferred_id, service_name, status`,
    [
      tenantId,
      contactId,
      appointmentId || null,
      customerId,
      item.shopmonkeyOrderId,
      item.shopmonkeyDeferredId,
      item.serviceName,
      item.vehicleLabel,
      item.deferredAt || null,
      item.deferredReason,
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

async function scheduleDeferredFollowup({
  tenantId,
  contactId,
  appointmentId,
  orderId,
  services,
  referenceAt,
  followupSchedule,
}) {
  if (!appointmentId || !services?.length) {
    return { scheduled: false, reason: 'missing_context' };
  }

  const schedule = normalizeFollowupSchedule(followupSchedule);
  const alreadyScheduled = await hasPendingFollowupJobs(tenantId, contactId, appointmentId);
  if (alreadyScheduled) {
    return { scheduled: false, reason: 'already_scheduled' };
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

  const businessName = tenant?.name || 'our shop';
  const bookingLink = (tenant?.booking_link || '').trim();
  const serviceList = formatServiceList(services);
  const firstName = contact.first_name || 'there';

  const vars = {
    firstName,
    businessName,
    serviceList,
    bookingLink: bookingLink || businessName,
  };

  const base = referenceAt ? new Date(referenceAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { scheduled: false, reason: 'invalid_reference_date' };
  }

  await cancelDeferredFollowupJobs(tenantId, contactId, appointmentId);

  const scheduledJobs = [];
  for (let stepIndex = 0; stepIndex < schedule.length; stepIndex += 1) {
    const days = schedule[stepIndex];
    const scheduledAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
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

    scheduledJobs.push({
      step: stepIndex + 1,
      daysAfterVisit: days,
      scheduledAt: scheduledAt.toISOString(),
      jobType: jobTypeForStep(stepIndex),
    });
  }

  if (scheduledJobs.length === 0) {
    return { scheduled: false, reason: 'all_steps_in_past' };
  }

  await db.query(
    `UPDATE shopmonkey_deferred_services
     SET status = 'followup_scheduled', updated_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND shopmonkey_order_id = $3
       AND status = 'pending'`,
    [tenantId, contactId, orderId || services[0]?.shopmonkeyOrderId || null],
  );

  return {
    scheduled: true,
    serviceCount: services.length,
    stepsScheduled: scheduledJobs.length,
    schedule,
    jobs: scheduledJobs,
  };
}

/**
 * Pull deferred lines for this completed RO and schedule follow-up SMS steps (Southlake only).
 */
async function syncDeferredServicesForCompletedOrder({
  tenantId,
  tenantName,
  contactId,
  customerId,
  orderId,
  appointmentId,
  apiKey,
  completedAt,
}) {
  if (!isDeferredFollowupEnabled(tenantId, tenantName)) {
    return { action: 'deferred_skipped', reason: 'not_shopmonkey_tenant' };
  }

  const settings = await getDeferredSettings(tenantId);
  if (!settings.enabled) {
    return { action: 'deferred_skipped', reason: 'followup_disabled' };
  }

  if (!customerId || !orderId || !apiKey) {
    return { action: 'deferred_skipped', reason: 'missing_ids' };
  }

  let items;
  try {
    items = await fetchDeferredServicesForCustomer(apiKey, customerId, { orderId });
  } catch (err) {
    console.warn('[SHOPMONKEY][DEFERRED] API fetch failed:', err.message);
    return { action: 'deferred_error', error: err.message };
  }

  if (items.length === 0) {
    return { action: 'deferred_none', orderId };
  }

  const stored = [];
  for (const item of items) {
    const row = await upsertDeferredServiceRow({
      tenantId,
      contactId,
      appointmentId,
      customerId,
      item,
    });
    if (row) stored.push({ ...item, rowId: row.id, status: row.status });
  }

  const pendingForOrder = stored.filter((s) => s.status === 'pending');
  if (pendingForOrder.length === 0) {
    return {
      action: 'deferred_already_handled',
      orderId,
      deferredCount: items.length,
    };
  }

  const followup = await scheduleDeferredFollowup({
    tenantId,
    contactId,
    appointmentId,
    orderId,
    services: pendingForOrder,
    referenceAt: completedAt,
    followupSchedule: settings.followupSchedule,
  });

  return {
    action: 'deferred_synced',
    orderId,
    deferredCount: items.length,
    followup,
  };
}

const STATUS_LABELS = {
  pending: 'Detected',
  followup_scheduled: 'Follow-up scheduled',
  followup_sent: 'Sequence complete',
};

function formatDeferredRow(row) {
  const contactName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.phone || 'Unknown';
  return {
    id: row.id,
    contactId: row.contact_id,
    contactName,
    phone: row.phone || null,
    serviceName: row.service_name,
    vehicleLabel: row.vehicle_label || null,
    deferredAt: row.deferred_at || null,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    followupScheduledAt: row.followup_scheduled_at || null,
    followupJobStatus: row.followup_job_status || null,
    followupMessage: row.followup_message || null,
    shopmonkeyOrderId: row.shopmonkey_order_id || null,
    createdAt: row.created_at,
  };
}

async function listDeferredServices(tenantId, {
  contactId,
  status,
  page = 1,
  limit = 25,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const conditions = ['d.tenant_id = $1'];
  const params = [tenantId];
  let idx = 2;

  if (contactId) {
    conditions.push(`d.contact_id = $${idx++}`);
    params.push(contactId);
  }

  if (status) {
    conditions.push(`d.status = $${idx++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');

  const [rowsResult, countResult] = await Promise.all([
    db.query(
      `SELECT d.*,
              c.first_name, c.last_name, c.phone,
              j.scheduled_at AS followup_scheduled_at,
              j.status AS followup_job_status,
              j.message_body AS followup_message
       FROM shopmonkey_deferred_services d
       JOIN contacts c ON c.id = d.contact_id
       LEFT JOIN LATERAL (
         SELECT scheduled_at, status, message_body
         FROM appointment_workflow_jobs
         WHERE tenant_id = d.tenant_id
           AND contact_id = d.contact_id
           AND appointment_id = d.appointment_id
           AND ${DEFERRED_JOB_TYPE_SQL}
           AND status = 'pending'
         ORDER BY scheduled_at ASC
         LIMIT 1
       ) j ON true
       WHERE ${where}
       ORDER BY COALESCE(d.deferred_at, d.created_at) DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, safeLimit, offset],
    ),
    db.query(
      `SELECT COUNT(*)::int AS total FROM shopmonkey_deferred_services d WHERE ${where}`,
      params,
    ),
  ]);

  const total = countResult.rows[0]?.total || 0;

  return {
    items: rowsResult.rows.map(formatDeferredRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

async function getDeferredSummary(tenantId) {
  const [countsResult, settings] = await Promise.all([
    db.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status IN ('pending', 'followup_scheduled'))::int AS active,
         COUNT(*) FILTER (WHERE status = 'followup_scheduled')::int AS scheduled,
         COUNT(*) FILTER (WHERE status = 'followup_sent')::int AS sent
       FROM shopmonkey_deferred_services
       WHERE tenant_id = $1`,
      [tenantId],
    ),
    getDeferredSettings(tenantId),
  ]);

  const row = countsResult.rows[0] || {};

  return {
    total: row.total || 0,
    active: row.active || 0,
    scheduled: row.scheduled || 0,
    sent: row.sent || 0,
    followupEnabled: settings.enabled,
    followupSchedule: settings.followupSchedule,
  };
}

async function markFollowupStepSent(tenantId, contactId, appointmentId, jobType) {
  const settings = await getDeferredSettings(tenantId);
  if (!isFinalDeferredFollowupJobType(jobType, settings.followupSchedule.length)) {
    return { completed: false };
  }

  await db.query(
    `UPDATE shopmonkey_deferred_services
     SET status = 'followup_sent', updated_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status IN ('pending', 'followup_scheduled')
       AND ($3::uuid IS NULL OR appointment_id = $3)`,
    [tenantId, contactId, appointmentId || null],
  );

  return { completed: true };
}

module.exports = {
  JOB_TYPE,
  DEFAULT_FOLLOWUP_SCHEDULE,
  DEFAULT_FOLLOWUP_MESSAGES,
  STATUS_LABELS,
  jobTypeForStep,
  isDeferredFollowupJobType,
  isFinalDeferredFollowupJobType,
  normalizeFollowupSchedule,
  isDeferredFollowupEnabled,
  fetchDeferredServicesForCustomer,
  syncDeferredServicesForCompletedOrder,
  listDeferredServices,
  getDeferredSummary,
  cancelDeferredFollowupJobs,
  markFollowupStepSent,
  formatServiceList,
  renderTemplate,
  messageForStep,
};
