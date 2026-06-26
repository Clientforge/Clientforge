const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { normalizeSquareBooking } = require('../adapters/square.adapter');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');

const SCOPES = [
  'APPOINTMENTS_READ',
  'APPOINTMENTS_ALL_READ',
  'CUSTOMERS_READ',
  'ITEMS_READ',
  'MERCHANT_PROFILE_READ',
].join(' ');

function isSandbox() {
  return String(process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase() === 'sandbox';
}

function connectBaseUrl() {
  return isSandbox()
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';
}

function apiVersion() {
  return process.env.SQUARE_API_VERSION || '2024-11-20';
}

function isConfigured() {
  return !!(process.env.SQUARE_APPLICATION_ID && process.env.SQUARE_APPLICATION_SECRET);
}

function redirectUri() {
  return (
    process.env.SQUARE_REDIRECT_URI
    || `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/integrations/square/callback`
  );
}

function webhookNotificationUrl() {
  return `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/webhook/square`;
}

function appSettingsUrl(query = '') {
  const base = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.clientforge.ai';
  return `${base.replace(/\/$/, '')}/settings${query ? `?${query}` : ''}`;
}

function formatConnection(row) {
  if (!row) {
    return { connected: false, configured: isConfigured() };
  }
  return {
    connected: !!(row.refresh_token_enc || row.access_token_enc),
    merchantId: row.square_merchant_id || null,
    locationId: row.square_location_id || null,
    businessName: row.business_name || null,
    webhooksEnabled: row.webhooks_enabled !== false,
    lastWebhookAt: row.last_webhook_at || null,
    lastWebhookError: row.last_webhook_error || null,
    webhookUrl: webhookNotificationUrl(),
    configured: isConfigured(),
    environment: isSandbox() ? 'sandbox' : 'production',
  };
}

async function getConnection(tenantId) {
  const result = await db.query(
    'SELECT * FROM tenant_square_connections WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getConnectionByMerchantId(merchantId) {
  if (!merchantId) return null;
  const result = await db.query(
    'SELECT * FROM tenant_square_connections WHERE square_merchant_id = $1',
    [merchantId],
  );
  return result.rows[0] || null;
}

function buildOAuthState(tenantId) {
  return jwt.sign({ tenantId, purpose: 'square_oauth' }, config.jwt.secret, { expiresIn: '15m' });
}

function verifyOAuthState(state) {
  const decoded = jwt.verify(state, config.jwt.secret);
  if (decoded.purpose !== 'square_oauth' || !decoded.tenantId) {
    throw Object.assign(new Error('Invalid OAuth state'), { statusCode: 400 });
  }
  return decoded.tenantId;
}

async function squareFetch(path, accessToken, options = {}) {
  const url = `${connectBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Square-Version': apiVersion(),
      Authorization: `Bearer ${accessToken}`,
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
    const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || res.statusText || 'Square API error';
    const err = new Error(msg);
    err.statusCode = res.status;
    err.squareErrors = data?.errors;
    throw err;
  }
  return data;
}

async function exchangeOAuthCode(code) {
  const body = {
    client_id: process.env.SQUARE_APPLICATION_ID,
    client_secret: process.env.SQUARE_APPLICATION_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri(),
  };
  const res = await fetch(`${connectBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': apiVersion() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || data?.errors?.[0]?.detail || 'Square token exchange failed'), {
      statusCode: res.status,
    });
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = {
    client_id: process.env.SQUARE_APPLICATION_ID,
    client_secret: process.env.SQUARE_APPLICATION_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  const res = await fetch(`${connectBaseUrl()}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Square-Version': apiVersion() },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data?.message || 'Square token refresh failed'), { statusCode: res.status });
  }
  return data;
}

async function saveTokens(tenantId, tokenData, merchantId) {
  const expiresAt = tokenData.expires_at
    ? new Date(tokenData.expires_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO tenant_square_connections
       (tenant_id, square_merchant_id, access_token_enc, refresh_token_enc, token_expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       square_merchant_id = COALESCE(EXCLUDED.square_merchant_id, tenant_square_connections.square_merchant_id),
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, tenant_square_connections.refresh_token_enc),
       token_expires_at = EXCLUDED.token_expires_at,
       updated_at = NOW()`,
    [
      tenantId,
      merchantId || null,
      encrypt(tokenData.access_token),
      encrypt(tokenData.refresh_token),
      expiresAt,
    ],
  );
}

async function getValidAccessToken(connection) {
  if (!connection) {
    throw Object.assign(new Error('Square not connected for tenant'), { statusCode: 400 });
  }
  let accessToken = decrypt(connection.access_token_enc);
  const refreshToken = decrypt(connection.refresh_token_enc);
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const needsRefresh = !accessToken || (expiresAt && expiresAt.getTime() < Date.now() + 60_000);

  if (needsRefresh) {
    if (!refreshToken) {
      throw Object.assign(new Error('Square access token expired and no refresh token'), { statusCode: 401 });
    }
    const refreshed = await refreshAccessToken(refreshToken);
    await saveTokens(connection.tenant_id, refreshed, connection.square_merchant_id);
    accessToken = refreshed.access_token;
  }

  return accessToken;
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  const signatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim();
  if (!signatureKey) return true;

  if (!signatureHeader || !rawBody) return false;

  const notificationUrl = webhookNotificationUrl();
  const hmac = crypto.createHmac('sha256', signatureKey);
  hmac.update(notificationUrl + rawBody);
  const expected = hmac.digest('base64');

  if (signatureHeader === expected) return true;

  // Square may send multiple signatures separated by commas
  return signatureHeader.split(',').some((sig) => sig.trim() === expected);
}

async function fetchCustomer(accessToken, customerId) {
  if (!customerId) return null;
  try {
    const data = await squareFetch(`/v2/customers/${customerId}`, accessToken);
    return data?.customer || null;
  } catch (err) {
    console.warn('[SQUARE] Customer fetch failed:', customerId, err.message);
    return null;
  }
}

async function fetchServiceName(accessToken, serviceVariationId) {
  if (!serviceVariationId) return null;
  try {
    const data = await squareFetch(`/v2/catalog/object/${serviceVariationId}`, accessToken);
    const obj = data?.object;
    if (!obj) return null;
    if (obj.item_variation_data?.name) return obj.item_variation_data.name;
    if (obj.item_data?.name) return obj.item_data.name;
    return obj.type || null;
  } catch (err) {
    console.warn('[SQUARE] Catalog fetch failed:', serviceVariationId, err.message);
    return null;
  }
}

async function enrichBookingContext(accessToken, booking) {
  const customer = await fetchCustomer(accessToken, booking?.customer_id);
  const segments = Array.isArray(booking?.appointment_segments) ? booking.appointment_segments : [];
  const serviceNames = [];
  for (const seg of segments) {
    if (!seg?.service_variation_id) continue;
    const name = await fetchServiceName(accessToken, seg.service_variation_id);
    if (name) serviceNames.push(name);
  }
  return { customer, serviceNames };
}

async function recordWebhookEvent(eventId, tenantId, eventType, bookingId, appointmentId) {
  await db.query(
    `INSERT INTO square_webhook_events (event_id, tenant_id, event_type, booking_id, appointment_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, tenantId, eventType, bookingId || null, appointmentId || null],
  );
}

async function isEventProcessed(eventId) {
  const result = await db.query(
    'SELECT 1 FROM square_webhook_events WHERE event_id = $1',
    [eventId],
  );
  return result.rows.length > 0;
}

async function updateWebhookStatus(tenantId, { error = null } = {}) {
  if (error) {
    await db.query(
      `UPDATE tenant_square_connections SET last_webhook_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, error],
    );
    return;
  }
  await db.query(
    `UPDATE tenant_square_connections SET last_webhook_at = NOW(), last_webhook_error = NULL, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId],
  );
}

async function handleWebhookNotification(rawBody, headers = {}) {
  const signature = headers['x-square-hmacsha256-signature'];
  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn('[WEBHOOK][SQUARE] Invalid signature');
    return { status: 401, body: { error: 'Invalid webhook signature' } };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { error: 'Invalid JSON' } };
  }

  const eventType = payload?.type;
  if (!eventType || !['booking.created', 'booking.updated'].includes(eventType)) {
    return { status: 200, body: { received: true, skipped: 'Unsupported event type' } };
  }

  const eventId = payload?.event_id;
  if (eventId && await isEventProcessed(eventId)) {
    return { status: 200, body: { received: true, skipped: 'Duplicate event' } };
  }

  const merchantId = payload?.merchant_id;
  const connection = await getConnectionByMerchantId(merchantId);
  if (!connection) {
    console.warn('[WEBHOOK][SQUARE] No tenant for merchant_id', merchantId);
    return { status: 200, body: { received: true, skipped: 'Unknown merchant' } };
  }

  if (connection.webhooks_enabled === false) {
    return { status: 200, body: { received: true, skipped: 'Webhooks disabled' } };
  }

  const booking = payload?.data?.object?.booking;
  if (!booking?.id) {
    return { status: 200, body: { received: true, skipped: 'No booking in payload' } };
  }

  try {
    const accessToken = await getValidAccessToken(connection);
    const { customer, serviceNames } = await enrichBookingContext(accessToken, booking);
    const normalized = normalizeSquareBooking({
      raw: payload,
      booking,
      customer,
      serviceNames,
    });

    if (!normalized) {
      await updateWebhookStatus(connection.tenant_id, { error: 'No contact identity in booking' });
      return { status: 200, body: { received: true, skipped: 'No contact info' } };
    }

    const result = await appointmentService.processBookingEvent(connection.tenant_id, {
      eventType: normalized.eventType,
      contact: normalized.contact,
      appointment: normalized.appointment,
      contactSource: 'square',
    });

    await appointmentWorkflowService.dispatchWorkflows(connection.tenant_id, result);

    if (eventId) {
      await recordWebhookEvent(eventId, connection.tenant_id, eventType, booking.id, result.appointmentId);
    }

    await updateWebhookStatus(connection.tenant_id);

    console.log(
      '[WEBHOOK][SQUARE] Processed',
      eventType,
      'booking',
      booking.id,
      'tenant',
      connection.tenant_id,
    );

    return {
      status: 200,
      body: {
        success: true,
        eventType: result.eventType,
        appointmentId: result.appointmentId,
        contactId: result.contactId,
      },
    };
  } catch (err) {
    console.error('[WEBHOOK][SQUARE] Error:', err.message);
    await updateWebhookStatus(connection.tenant_id, { error: err.message });
    throw err;
  }
}

function buildConnectUrl(tenantId) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Square OAuth is not configured on the server'), {
      statusCode: 503,
      isOperational: true,
    });
  }
  const state = buildOAuthState(tenantId);
  const params = new URLSearchParams({
    client_id: process.env.SQUARE_APPLICATION_ID,
    scope: SCOPES,
    session: 'false',
    state,
    redirect_uri: redirectUri(),
  });
  return `${connectBaseUrl()}/oauth2/authorize?${params.toString()}`;
}

async function handleOAuthCallback(code, state) {
  const tenantId = verifyOAuthState(state);
  const tokenData = await exchangeOAuthCode(code);
  const merchantId = tokenData.merchant_id;
  await saveTokens(tenantId, tokenData, merchantId);

  let businessName = null;
  let locationId = null;
  try {
    const accessToken = tokenData.access_token;
    if (merchantId) {
      const merchant = await squareFetch(`/v2/merchants/${merchantId}`, accessToken);
      businessName = merchant?.merchant?.business_name || null;
    }
    const locations = await squareFetch('/v2/locations', accessToken);
    locationId = locations?.locations?.[0]?.id || null;
  } catch (err) {
    console.warn('[SQUARE] Post-OAuth merchant fetch failed:', err.message);
  }

  await db.query(
    `UPDATE tenant_square_connections SET
       business_name = COALESCE($2, business_name),
       square_location_id = COALESCE($3, square_location_id),
       square_merchant_id = COALESCE($4, square_merchant_id),
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, businessName, locationId, merchantId],
  );

  return { tenantId, merchantId, businessName };
}

async function getStatus(tenantId) {
  const row = await getConnection(tenantId);
  return formatConnection(row);
}

async function disconnect(tenantId) {
  await db.query('DELETE FROM tenant_square_connections WHERE tenant_id = $1', [tenantId]);
  return { disconnected: true };
}

async function setWebhooksEnabled(tenantId, enabled) {
  await db.query(
    `UPDATE tenant_square_connections SET webhooks_enabled = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, !!enabled],
  );
  return getStatus(tenantId);
}

module.exports = {
  isConfigured,
  isSandbox,
  webhookNotificationUrl,
  appSettingsUrl,
  buildConnectUrl,
  handleOAuthCallback,
  handleWebhookNotification,
  verifyWebhookSignature,
  getStatus,
  disconnect,
  setWebhooksEnabled,
  getConnectionByMerchantId,
};
