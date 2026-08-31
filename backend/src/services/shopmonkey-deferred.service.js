const db = require('../db/connection');
const { isShopmonkeyTenant } = require('../config/shopmonkeyTenant');
const { normalizeDeferredServiceList } = require('../adapters/shopmonkey.adapter');
const appointmentService = require('./appointment.service');

const API_BASE = 'https://api.shopmonkey.cloud/v3';
const JOB_TYPE = 'deferred_service_followup';

const DEFAULT_FOLLOWUP_MESSAGE =
  'Hi {firstName}! On your recent visit to {businessName}, we noted {serviceList} still needs attention. Schedule when you\'re ready: {bookingLink}';

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
    `SELECT deferred_followup_enabled, deferred_followup_days
     FROM tenant_shopmonkey_connections
     WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = result.rows[0];
  return {
    enabled: row?.deferred_followup_enabled !== false,
    followupDays: Number.isFinite(row?.deferred_followup_days) && row.deferred_followup_days > 0
      ? row.deferred_followup_days
      : 3,
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

async function cancelPendingFollowupJobs(tenantId, contactId, appointmentId) {
  await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND appointment_id = $3
       AND job_type = $4
       AND status = 'pending'`,
    [tenantId, contactId, appointmentId, JOB_TYPE],
  );
}

async function hasPendingFollowupJob(tenantId, contactId, appointmentId) {
  const result = await db.query(
    `SELECT id FROM appointment_workflow_jobs
     WHERE tenant_id = $1
       AND contact_id = $2
       AND appointment_id = $3
       AND job_type = $4
       AND status = 'pending'
     LIMIT 1`,
    [tenantId, contactId, appointmentId, JOB_TYPE],
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
  followupDays,
}) {
  if (!appointmentId || !services?.length) {
    return { scheduled: false, reason: 'missing_context' };
  }

  const alreadyScheduled = await hasPendingFollowupJob(tenantId, contactId, appointmentId);
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

  const messageBody = renderTemplate(DEFAULT_FOLLOWUP_MESSAGE, vars);

  const base = referenceAt ? new Date(referenceAt) : new Date();
  const scheduledAt = new Date(base.getTime() + followupDays * 24 * 60 * 60 * 1000);

  await cancelPendingFollowupJobs(tenantId, contactId, appointmentId);

  await appointmentService.scheduleWorkflowJob(
    tenantId,
    appointmentId,
    contactId,
    JOB_TYPE,
    {
      scheduledAt: scheduledAt.toISOString(),
      channel: 'sms',
      messageBody,
    },
  );

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
    scheduledAt: scheduledAt.toISOString(),
    serviceCount: services.length,
  };
}

/**
 * Pull deferred lines for this completed RO and schedule a follow-up SMS (Southlake only).
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
    followupDays: settings.followupDays,
  });

  return {
    action: 'deferred_synced',
    orderId,
    deferredCount: items.length,
    followup,
  };
}

async function markFollowupSent(tenantId, contactId, appointmentId) {
  await db.query(
    `UPDATE shopmonkey_deferred_services
     SET status = 'followup_sent', updated_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status IN ('pending', 'followup_scheduled')
       AND ($3::uuid IS NULL OR appointment_id = $3)`,
    [tenantId, contactId, appointmentId || null],
  );
}

module.exports = {
  JOB_TYPE,
  DEFAULT_FOLLOWUP_MESSAGE,
  isDeferredFollowupEnabled,
  fetchDeferredServicesForCustomer,
  syncDeferredServicesForCompletedOrder,
  markFollowupSent,
  formatServiceList,
  renderTemplate,
};
