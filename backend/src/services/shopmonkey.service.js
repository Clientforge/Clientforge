const crypto = require('crypto');
const config = require('../config');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { normalizePhone } = require('./lead.service');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const shopmonkeyDeferredService = require('./shopmonkey-deferred.service');
const {
  normalizeCustomerContact,
  orderIsComplete,
  normalizeShopmonkeyWebhook,
  normalizeOrderServiceList,
  buildOrderServiceContext,
} = require('../adapters/shopmonkey.adapter');

const API_BASE = 'https://api.shopmonkey.cloud/v3';

function webhookUrlForTenant(tenantId) {
  return `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/webhook/shopmonkey/${tenantId}`;
}

function formatConnection(row) {
  if (!row) {
    return { connected: false, configured: true };
  }
  return {
    connected: !!row.api_key_enc,
    locationId: row.location_id || null,
    companyId: row.company_id || null,
    shopName: row.shop_name || null,
    webhooksEnabled: row.webhooks_enabled !== false,
    lastWebhookAt: row.last_webhook_at || null,
    lastWebhookError: row.last_webhook_error || null,
    lastSyncAt: row.last_sync_at || null,
    webhookUrl: webhookUrlForTenant(row.tenant_id),
    hasWebhookSecret: !!row.webhook_secret,
    deferredFollowupEnabled: row.deferred_followup_enabled !== false,
    deferredFollowupDays: Number.isFinite(row.deferred_followup_days) && row.deferred_followup_days > 0
      ? row.deferred_followup_days
      : 3,
  };
}

async function getConnection(tenantId) {
  const result = await db.query(
    'SELECT * FROM tenant_shopmonkey_connections WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getStatus(tenantId) {
  const row = await getConnection(tenantId);
  return formatConnection(row);
}

async function shopmonkeyFetch(path, apiKey, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
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
    err.data = data;
    throw err;
  }
  return data;
}

async function verifyApiKey(apiKey) {
  const result = await shopmonkeyFetch('/auth/api_key/status', apiKey);
  return result?.success !== false;
}

async function connect(tenantId, { apiKey, locationId, webhookSecret, shopName }) {
  const trimmedKey = String(apiKey || '').trim();
  if (!trimmedKey) {
    throw Object.assign(new Error('API key is required'), { statusCode: 400, isOperational: true });
  }

  await verifyApiKey(trimmedKey);

  const encrypted = encrypt(trimmedKey);
  const existing = await getConnection(tenantId);

  if (existing) {
    await db.query(
      `UPDATE tenant_shopmonkey_connections SET
         api_key_enc = $2,
         location_id = COALESCE($3, location_id),
         webhook_secret = COALESCE($4, webhook_secret),
         shop_name = COALESCE($5, shop_name),
         webhooks_enabled = true,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [
        tenantId,
        encrypted,
        locationId || null,
        webhookSecret || null,
        shopName || null,
      ],
    );
  } else {
    await db.query(
      `INSERT INTO tenant_shopmonkey_connections
         (tenant_id, api_key_enc, location_id, webhook_secret, shop_name, webhooks_enabled)
       VALUES ($1, $2, $3, $4, $5, true)`,
      [tenantId, encrypted, locationId || null, webhookSecret || null, shopName || null],
    );
  }

  return getStatus(tenantId);
}

async function disconnect(tenantId) {
  await db.query('DELETE FROM tenant_shopmonkey_connections WHERE tenant_id = $1', [tenantId]);
  return { connected: false, configured: true };
}

async function updateSettings(tenantId, {
  webhooksEnabled,
  webhookSecret,
  locationId,
  deferredFollowupEnabled,
  deferredFollowupDays,
}) {
  const row = await getConnection(tenantId);
  if (!row) {
    throw Object.assign(new Error('Shopmonkey is not connected'), { statusCode: 400, isOperational: true });
  }

  const sets = ['updated_at = NOW()'];
  const params = [tenantId];
  let idx = 2;

  if (webhooksEnabled !== undefined) {
    sets.push(`webhooks_enabled = $${idx++}`);
    params.push(!!webhooksEnabled);
  }
  if (webhookSecret !== undefined) {
    sets.push(`webhook_secret = $${idx++}`);
    params.push(webhookSecret || null);
  }
  if (locationId !== undefined) {
    sets.push(`location_id = $${idx++}`);
    params.push(locationId || null);
  }
  if (deferredFollowupEnabled !== undefined) {
    sets.push(`deferred_followup_enabled = $${idx++}`);
    params.push(!!deferredFollowupEnabled);
  }
  if (deferredFollowupDays !== undefined) {
    const days = Number(deferredFollowupDays);
    sets.push(`deferred_followup_days = $${idx++}`);
    params.push(Number.isFinite(days) && days > 0 ? Math.round(days) : 3);
  }

  await db.query(
    `UPDATE tenant_shopmonkey_connections SET ${sets.join(', ')} WHERE tenant_id = $1`,
    params,
  );

  return getStatus(tenantId);
}

async function getApiKey(tenantId) {
  const row = await getConnection(tenantId);
  if (!row?.api_key_enc) return null;
  return decrypt(row.api_key_enc);
}

function verifyWebhookSignature(rawBody, headers, secret) {
  if (!secret) return true;

  const msgId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signatureHeader = headers['webhook-signature'];
  if (!msgId || !timestamp || !signatureHeader) return false;

  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('base64');

  const parts = String(signatureHeader).split(/\s+/);
  for (const part of parts) {
    const [, sig] = part.includes(',') ? part.split(',') : ['v1', part.replace(/^v1,/, '')];
    const candidate = (sig || part).trim();
    try {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      // continue
    }
  }
  return false;
}

async function recordWebhookEvent(webhookId, tenantId, tableName, operation, recordId) {
  if (!webhookId) return false;
  const result = await db.query(
    `INSERT INTO shopmonkey_webhook_events (webhook_id, tenant_id, table_name, operation, record_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (webhook_id) DO NOTHING
     RETURNING webhook_id`,
    [webhookId, tenantId, tableName || null, operation || null, recordId || null],
  );
  return result.rows.length > 0;
}

async function findContactByShopmonkeyId(tenantId, shopmonkeyCustomerId) {
  if (!shopmonkeyCustomerId) return null;
  const result = await db.query(
    'SELECT id, phone, email, first_name, last_name FROM contacts WHERE tenant_id = $1 AND shopmonkey_customer_id = $2',
    [tenantId, shopmonkeyCustomerId],
  );
  return result.rows[0] || null;
}

async function upsertContactFromShopmonkey(tenantId, customerPayload) {
  const normalized = normalizeCustomerContact(customerPayload);
  if (!normalized) return null;

  const existingBySm = await findContactByShopmonkeyId(tenantId, normalized.shopmonkeyCustomerId);
  if (existingBySm) {
    await db.query(
      `UPDATE contacts SET
         first_name = COALESCE(NULLIF($2, ''), first_name),
         last_name = COALESCE(NULLIF($3, ''), last_name),
         email = COALESCE(NULLIF($4, ''), email),
         phone = COALESCE(NULLIF($5, ''), phone),
         source = CASE WHEN source = 'import' THEN 'shopmonkey' ELSE source END,
         updated_at = NOW()
       WHERE id = $1`,
      [
        existingBySm.id,
        normalized.firstName || '',
        normalized.lastName || '',
        normalized.email || '',
        normalized.phone ? normalizePhone(normalized.phone) : '',
      ],
    );
    return existingBySm.id;
  }

  const contactId = await appointmentService.upsertContact(tenantId, {
    firstName: normalized.firstName,
    lastName: normalized.lastName,
    phone: normalized.phone,
    email: normalized.email,
  }, 'shopmonkey');

  await db.query(
    'UPDATE contacts SET shopmonkey_customer_id = $2, updated_at = NOW() WHERE id = $1',
    [contactId, normalized.shopmonkeyCustomerId],
  );

  return contactId;
}

async function resolveContactForShopmonkeyRecord(tenantId, customerId, apiKey) {
  if (!customerId) return null;

  const existing = await findContactByShopmonkeyId(tenantId, customerId);
  if (existing) return existing.id;

  if (!apiKey) return null;

  try {
    const result = await shopmonkeyFetch(`/customer/${customerId}`, apiKey);
    const customer = result?.data || result;
    return upsertContactFromShopmonkey(tenantId, customer);
  } catch (err) {
    console.warn('[SHOPMONKEY] Failed to fetch customer', customerId, err.message);
    return null;
  }
}

async function syncCustomerFromWebhook(tenantId, customer) {
  const contactId = await upsertContactFromShopmonkey(tenantId, customer);
  return { action: 'customer_synced', contactId };
}

async function fetchOrderServices(apiKey, orderId) {
  const result = await shopmonkeyFetch(`/order/${orderId}/service`, apiKey);
  return normalizeOrderServiceList(result);
}

async function enrichOrderWithServices(order, apiKey) {
  if (!apiKey || !order?.orderId) return order;

  try {
    const services = await fetchOrderServices(apiKey, order.orderId);
    const context = buildOrderServiceContext(order.rawPayload || order, services);
    return {
      ...order,
      serviceName: context.serviceName,
      vehicleLabel: context.vehicleLabel,
      performedServices: context.performedServices,
      rawPayload: context.rawPayload,
    };
  } catch (err) {
    console.warn('[SHOPMONKEY] Failed to fetch order services', order.orderId, err.message);
    const vehicleLabel = order.vehicleLabel || null;
    return {
      ...order,
      rawPayload: {
        ...(order.rawPayload || {}),
        shopmonkeyVehicleLabel: vehicleLabel,
      },
    };
  }
}

async function upsertCompletedOrderAppointment(tenantId, contactId, order) {
  const contactRow = await db.query(
    'SELECT first_name, last_name, phone, email FROM contacts WHERE id = $1',
    [contactId],
  );
  const c = contactRow.rows[0] || {};

  const result = await appointmentService.processBookingEvent(tenantId, {
    eventType: 'booking.created',
    contact: {
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      email: c.email,
    },
    appointment: {
      externalId: order.externalId,
      provider: 'shopmonkey',
      scheduledAt: order.scheduledAt,
      serviceName: order.serviceName,
      rawPayload: order.rawPayload,
    },
    contactSource: 'shopmonkey',
    existingContactId: contactId,
  });

  if (result.appointmentId) {
    await db.query(
      `UPDATE appointments SET status = 'completed', completed_at = COALESCE(completed_at, $3), updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [result.appointmentId, tenantId, order.scheduledAt || new Date().toISOString()],
    );
  }

  return result;
}

async function getTenantName(tenantId) {
  const result = await db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]);
  return result.rows[0]?.name || '';
}

async function syncOrderFromWebhook(tenantId, order, apiKey) {
  const contactId = await resolveContactForShopmonkeyRecord(tenantId, order.customerId, apiKey);
  if (!contactId) {
    return { action: 'order_skipped', reason: 'no_contact' };
  }

  if (order.isComplete && order.scheduledAt) {
    const when = new Date(order.scheduledAt);
    if (!Number.isNaN(when.getTime())) {
      await db.query(
        `UPDATE contacts
         SET last_visit_at = GREATEST(COALESCE(last_visit_at, $3), $3), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [contactId, tenantId, when],
      );
    }
  }

  if (!order.isComplete) {
    return { action: 'order_recorded', contactId, complete: false };
  }

  const enrichedOrder = await enrichOrderWithServices(order, apiKey);
  const result = await upsertCompletedOrderAppointment(tenantId, contactId, enrichedOrder);

  const tenantName = await getTenantName(tenantId);
  const deferred = await shopmonkeyDeferredService.syncDeferredServicesForCompletedOrder({
    tenantId,
    tenantName,
    contactId,
    customerId: enrichedOrder.customerId,
    orderId: enrichedOrder.orderId,
    appointmentId: result.appointmentId,
    apiKey,
    completedAt: enrichedOrder.scheduledAt,
  });

  return {
    action: 'order_completed',
    contactId,
    appointmentId: result.appointmentId,
    eventType: result.eventType,
    serviceName: enrichedOrder.serviceName,
    vehicleLabel: enrichedOrder.vehicleLabel || null,
    performedServiceCount: enrichedOrder.performedServices?.length || 0,
    deferred,
  };
}

async function syncAppointmentFromWebhook(tenantId, appointment, apiKey) {
  const contactId = await resolveContactForShopmonkeyRecord(tenantId, appointment.customerId, apiKey);
  if (!contactId) {
    return { action: 'appointment_skipped', reason: 'no_contact' };
  }

  const contactRow = await db.query(
    'SELECT first_name, last_name, phone, email FROM contacts WHERE id = $1',
    [contactId],
  );
  const c = contactRow.rows[0] || {};

  const result = await appointmentService.processBookingEvent(tenantId, {
    eventType: appointment.eventType,
    contact: {
      firstName: c.first_name,
      lastName: c.last_name,
      phone: c.phone,
      email: c.email,
    },
    appointment: {
      externalId: appointment.externalId,
      provider: 'shopmonkey',
      scheduledAt: appointment.scheduledAt,
      timezone: appointment.timezone,
      serviceName: appointment.serviceName,
      durationMinutes: appointment.durationMinutes,
      rawPayload: appointment.rawPayload,
    },
    contactSource: 'shopmonkey',
    existingContactId: contactId,
  });

  await appointmentWorkflowService.dispatchWorkflows(tenantId, result);

  return {
    action: 'appointment_synced',
    contactId,
    appointmentId: result.appointmentId,
    eventType: result.eventType,
  };
}

async function handleWebhook(tenantId, rawBody, headers, body) {
  const connection = await getConnection(tenantId);
  if (!connection?.api_key_enc) {
    return { status: 404, body: { error: 'Shopmonkey not connected for this tenant' } };
  }
  if (connection.webhooks_enabled === false) {
    return { status: 200, body: { received: true, skipped: 'webhooks_disabled' } };
  }

  if (!verifyWebhookSignature(rawBody, headers, connection.webhook_secret)) {
    console.warn('[WEBHOOK][SHOPMONKEY] Invalid signature for tenant', tenantId);
    return { status: 401, body: { error: 'Invalid webhook signature' } };
  }

  const webhookId = headers['webhook-id'];
  const normalized = normalizeShopmonkeyWebhook(body);
  if (!normalized) {
    return { status: 200, body: { received: true, skipped: 'unrecognized_payload' } };
  }

  const recordId = normalized.customer?.id
    || normalized.order?.orderId
    || normalized.appointment?.externalId?.split(':').pop()
    || null;

  const isNew = await recordWebhookEvent(
    webhookId,
    tenantId,
    normalized.table,
    normalized.operation,
    recordId,
  );
  if (!isNew && webhookId) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  const apiKey = decrypt(connection.api_key_enc);
  let outcome;

  try {
    if (normalized.table === 'customer' && normalized.customer) {
      outcome = await syncCustomerFromWebhook(tenantId, normalized.customer);
    } else if (normalized.table === 'order' && normalized.order) {
      outcome = await syncOrderFromWebhook(tenantId, normalized.order, apiKey);
    } else if (normalized.table === 'appointment' && normalized.appointment) {
      outcome = await syncAppointmentFromWebhook(tenantId, normalized.appointment, apiKey);
    } else {
      outcome = { action: 'ignored', table: normalized.table };
    }

    await db.query(
      `UPDATE tenant_shopmonkey_connections
       SET last_webhook_at = NOW(), last_webhook_error = NULL, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId],
    );

    return { status: 200, body: { success: true, ...outcome } };
  } catch (err) {
    console.error('[WEBHOOK][SHOPMONKEY] Handler error:', err.message);
    await db.query(
      `UPDATE tenant_shopmonkey_connections
       SET last_webhook_error = $2, updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, err.message.slice(0, 500)],
    );
    throw err;
  }
}

async function refreshAppointmentServiceNames(tenantId) {
  const apiKey = await getApiKey(tenantId);
  if (!apiKey) {
    throw Object.assign(new Error('Shopmonkey is not connected'), { statusCode: 400, isOperational: true });
  }

  const result = await db.query(
    `SELECT id, external_id, raw_payload, service_name
     FROM appointments
     WHERE tenant_id = $1 AND provider = 'shopmonkey' AND status = 'completed'
     ORDER BY scheduled_at DESC`,
    [tenantId],
  );

  let updated = 0;
  for (const row of result.rows) {
    const orderId = String(row.external_id || '').replace(/^shopmonkey:order:/, '');
    if (!orderId) continue;

    try {
      const services = await fetchOrderServices(apiKey, orderId);
      const orderPayload = row.raw_payload && typeof row.raw_payload === 'object'
        ? row.raw_payload
        : {};
      const context = buildOrderServiceContext(orderPayload, services);

      await db.query(
        `UPDATE appointments
         SET service_name = $2,
             raw_payload = $3::jsonb,
             updated_at = NOW()
         WHERE id = $1`,
        [row.id, context.serviceName, JSON.stringify(context.rawPayload)],
      );

      if (context.serviceName !== row.service_name) updated += 1;
    } catch (err) {
      console.warn('[SHOPMONKEY] Refresh failed for appointment', row.id, err.message);
    }
  }

  return { scanned: result.rows.length, updated };
}

async function testConnection(tenantId) {
  const apiKey = await getApiKey(tenantId);
  if (!apiKey) {
    throw Object.assign(new Error('Shopmonkey is not connected'), { statusCode: 400, isOperational: true });
  }
  const status = await shopmonkeyFetch('/auth/api_key/status', apiKey);
  return { ok: true, status };
}

module.exports = {
  webhookUrlForTenant,
  getStatus,
  connect,
  disconnect,
  updateSettings,
  handleWebhook,
  testConnection,
  verifyApiKey,
  orderIsComplete,
  refreshAppointmentServiceNames,
  fetchOrderServices,
  enrichOrderWithServices,
};
