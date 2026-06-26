const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const {
  normalizeGoogleCalendarEvent,
  isPastGoogleEvent,
} = require('../adapters/googleCalendar.adapter');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');
const { normalizePhone } = require('./lead.service');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events.readonly',
  'openid',
  'email',
].join(' ');

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI
    || `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/integrations/google-calendar/callback`
  );
}

function appSettingsUrl(query = '') {
  const base = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.clientforge.ai';
  return `${base.replace(/\/$/, '')}/settings${query ? `?${query}` : ''}`;
}

function webhookUrl() {
  return `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/webhook/google-calendar`;
}

function canRegisterWatch() {
  const url = webhookUrl();
  return url.startsWith('https://') && !url.includes('localhost');
}

async function googleFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error_description || res.statusText || 'Google API error';
    const err = new Error(msg);
    err.statusCode = res.status;
    err.googleError = data?.error;
    throw err;
  }
  return data;
}

function formatConnection(row) {
  if (!row) {
    return { connected: false, configured: isConfigured() };
  }
  return {
    connected: !!(row.refresh_token_enc || row.access_token_enc),
    googleEmail: row.google_email || null,
    calendarId: row.calendar_id || 'primary',
    calendarSummary: row.calendar_summary || null,
    syncEnabled: row.sync_enabled !== false,
    lastSyncedAt: row.last_synced_at || null,
    lastSyncError: row.last_sync_error || null,
    watchActive: !!(row.watch_channel_id && row.watch_expiration && new Date(row.watch_expiration) > new Date()),
    configured: isConfigured(),
  };
}

async function getConnection(tenantId) {
  const result = await db.query(
    `SELECT * FROM tenant_google_calendar_connections WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getConnectionByChannelId(channelId) {
  if (!channelId) return null;
  const result = await db.query(
    `SELECT * FROM tenant_google_calendar_connections WHERE watch_channel_id = $1`,
    [channelId],
  );
  return result.rows[0] || null;
}

function buildOAuthState(tenantId) {
  return jwt.sign({ tenantId, purpose: 'google_calendar_oauth' }, config.jwt.secret, { expiresIn: '15m' });
}

function verifyOAuthState(state) {
  const decoded = jwt.verify(state, config.jwt.secret);
  if (decoded.purpose !== 'google_calendar_oauth' || !decoded.tenantId) {
    throw Object.assign(new Error('Invalid OAuth state'), { statusCode: 400 });
  }
  return decoded.tenantId;
}

function buildConnectUrl(tenantId) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Google Calendar OAuth is not configured on the server'), {
      statusCode: 503,
      isOperational: true,
    });
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: buildOAuthState(tenantId),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens(code) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(),
    grant_type: 'authorization_code',
  });

  return googleFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  return googleFetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

async function saveTokens(tenantId, tokenResponse, googleEmail) {
  const expiresAt = tokenResponse.expires_in
    ? new Date(Date.now() + tokenResponse.expires_in * 1000)
    : null;

  const existing = await getConnection(tenantId);

  const accessEnc = encrypt(tokenResponse.access_token);
  const refreshEnc = tokenResponse.refresh_token
    ? encrypt(tokenResponse.refresh_token)
    : existing?.refresh_token_enc || null;

  if (existing) {
    await db.query(
      `UPDATE tenant_google_calendar_connections SET
         google_email = COALESCE($2, google_email),
         access_token_enc = $3,
         refresh_token_enc = COALESCE($4, refresh_token_enc),
         token_expires_at = $5,
         sync_enabled = true,
         last_sync_error = NULL,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, googleEmail || null, accessEnc, refreshEnc, expiresAt],
    );
  } else {
    await db.query(
      `INSERT INTO tenant_google_calendar_connections
         (tenant_id, google_email, access_token_enc, refresh_token_enc, token_expires_at, calendar_id)
       VALUES ($1, $2, $3, $4, $5, 'primary')`,
      [tenantId, googleEmail || null, accessEnc, refreshEnc, expiresAt],
    );
  }
}

async function getValidAccessToken(connection) {
  if (!connection) {
    throw Object.assign(new Error('Google Calendar not connected'), { statusCode: 404, isOperational: true });
  }

  const accessToken = decrypt(connection.access_token_enc);
  const refreshToken = decrypt(connection.refresh_token_enc);
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const stillValid = accessToken && expiresAt && expiresAt.getTime() > Date.now() + 60_000;

  if (stillValid) return accessToken;

  if (!refreshToken) {
    throw Object.assign(new Error('Google Calendar connection expired — reconnect required'), {
      statusCode: 401,
      isOperational: true,
    });
  }

  const refreshed = await refreshAccessToken(refreshToken);
  await saveTokens(connection.tenant_id, refreshed, connection.google_email);
  return refreshed.access_token;
}

async function fetchGoogleEmail(accessToken) {
  try {
    const profile = await googleFetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return profile.email || null;
  } catch {
    return null;
  }
}

async function handleOAuthCallback(code, state) {
  const tenantId = verifyOAuthState(state);
  const tokens = await exchangeCodeForTokens(code);
  const googleEmail = await fetchGoogleEmail(tokens.access_token);
  await saveTokens(tenantId, tokens, googleEmail);

  const connection = await getConnection(tenantId);
  if (connection?.calendar_id) {
    try {
      const cal = await getCalendarMeta(connection.tenant_id, connection.calendar_id);
      await db.query(
        `UPDATE tenant_google_calendar_connections SET calendar_summary = $2, updated_at = NOW() WHERE tenant_id = $1`,
        [tenantId, cal.summary || null],
      );
    } catch (err) {
      console.warn('[GCAL] Could not load calendar metadata:', err.message);
    }
  }

  await syncTenantCalendar(tenantId);

  if (canRegisterWatch()) {
    try {
      await registerWatch(tenantId);
    } catch (err) {
      console.warn('[GCAL] Watch registration failed (poll sync will continue):', err.message);
    }
  }

  return { tenantId, googleEmail };
}

async function calendarApiGet(tenantId, path, query = {}) {
  const connection = await getConnection(tenantId);
  const accessToken = await getValidAccessToken(connection);
  const params = new URLSearchParams(query);
  const url = `${CALENDAR_API}${path}${params.toString() ? `?${params}` : ''}`;
  return googleFetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
}

async function listCalendars(tenantId) {
  const data = await calendarApiGet(tenantId, '/users/me/calendarList', { minAccessRole: 'reader' });
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
    accessRole: c.accessRole,
  }));
}

async function getCalendarMeta(tenantId, calendarId) {
  return calendarApiGet(tenantId, `/calendars/${encodeURIComponent(calendarId)}`);
}

async function updateConnectionSettings(tenantId, { calendarId, syncEnabled }) {
  const connection = await getConnection(tenantId);
  if (!connection) {
    throw Object.assign(new Error('Google Calendar not connected'), { statusCode: 404, isOperational: true });
  }

  let calendarSummary = connection.calendar_summary;
  if (calendarId && calendarId !== connection.calendar_id) {
    const cal = await getCalendarMeta(tenantId, calendarId);
    calendarSummary = cal.summary || null;
  }

  await db.query(
    `UPDATE tenant_google_calendar_connections SET
       calendar_id = COALESCE($2, calendar_id),
       calendar_summary = COALESCE($3, calendar_summary),
       sync_enabled = COALESCE($4, sync_enabled),
       sync_token = CASE WHEN $2 IS NOT NULL AND $2 <> calendar_id THEN NULL ELSE sync_token END,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [
      tenantId,
      calendarId || null,
      calendarSummary,
      syncEnabled === undefined ? null : !!syncEnabled,
    ],
  );

  if (calendarId && calendarId !== connection.calendar_id) {
    await syncTenantCalendar(tenantId);
  }

  return getStatus(tenantId);
}

async function disconnect(tenantId) {
  const connection = await getConnection(tenantId);
  if (!connection) return { disconnected: true };

  if (connection.watch_channel_id && connection.watch_resource_id) {
    try {
      const accessToken = await getValidAccessToken(connection);
      await googleFetch(`${CALENDAR_API}/channels/stop`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: connection.watch_channel_id,
          resourceId: connection.watch_resource_id,
        }),
      });
    } catch (err) {
      console.warn('[GCAL] Watch stop failed:', err.message);
    }
  }

  await db.query('DELETE FROM tenant_google_calendar_connections WHERE tenant_id = $1', [tenantId]);
  return { disconnected: true };
}

async function logSyncEvent(tenantId, googleEventId, patch) {
  await db.query(
    `INSERT INTO calendar_sync_events
       (tenant_id, google_event_id, sync_action, skip_reason, appointment_id, event_type, error_message, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId,
      googleEventId,
      patch.syncAction,
      patch.skipReason || null,
      patch.appointmentId || null,
      patch.eventType || null,
      patch.errorMessage || null,
      patch.rawPayload ? JSON.stringify(patch.rawPayload) : null,
    ],
  );
}

function hasValidImportPhone(contact) {
  const raw = contact?.phone;
  if (!raw || String(raw).startsWith('gcal-')) return false;
  const digits = normalizePhone(raw).replace(/\D/g, '');
  return digits.length >= 10;
}

/** Auto-create Contacts when calendar event includes client first name + phone (e.g. Square). */
function canAutoCreateGoogleCalendarContact(contact) {
  return !!(contact?.firstName?.trim() && hasValidImportPhone(contact));
}

async function processGoogleEvent(tenantId, googleEvent, ownerEmail) {
  if (isPastGoogleEvent(googleEvent)) {
    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'skipped',
      skipReason: 'past_event',
      rawPayload: {
        id: googleEvent.id,
        summary: googleEvent.summary,
        end: googleEvent.end?.dateTime || googleEvent.end?.date || null,
      },
    });
    return { skipped: true, reason: 'past_event' };
  }

  const normalized = normalizeGoogleCalendarEvent(googleEvent, { ownerEmail });
  if (!normalized) {
    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'skipped',
      skipReason: 'no_contact_identity',
      rawPayload: { id: googleEvent.id, summary: googleEvent.summary },
    });
    return { skipped: true, reason: 'no_contact_identity' };
  }

  if (!normalized.contact.email && !normalized.contact.firstName) {
    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'skipped',
      skipReason: 'missing_contact_identity',
      rawPayload: { id: googleEvent.id, summary: googleEvent.summary },
    });
    return { skipped: true, reason: 'missing_contact_identity' };
  }

  const existingContactId = await appointmentService.findExistingContact(
    tenantId,
    normalized.contact,
  );

  if (!existingContactId && !canAutoCreateGoogleCalendarContact(normalized.contact)) {
    const skipReason = normalized.contact.firstName && !hasValidImportPhone(normalized.contact)
      ? 'missing_phone'
      : 'contact_not_in_list';
    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'skipped',
      skipReason,
      rawPayload: {
        id: googleEvent.id,
        summary: googleEvent.summary,
        firstName: normalized.contact.firstName,
        lastName: normalized.contact.lastName,
        email: normalized.contact.email,
        phone: normalized.contact.phone,
      },
    });
    return { skipped: true, reason: skipReason };
  }

  try {
    const result = await appointmentService.processBookingEvent(tenantId, {
      eventType: normalized.eventType,
      contact: normalized.contact,
      appointment: normalized.appointment,
      contactSource: 'google_calendar',
      existingContactId: existingContactId || undefined,
    });

    await appointmentWorkflowService.dispatchWorkflows(tenantId, result);

    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'processed',
      appointmentId: result.appointmentId,
      eventType: result.eventType,
    });

    return { processed: true, ...result };
  } catch (err) {
    await logSyncEvent(tenantId, googleEvent.id, {
      syncAction: 'failed',
      errorMessage: err.message,
      rawPayload: { id: googleEvent.id },
    });
    throw err;
  }
}

async function syncTenantCalendar(tenantId, { fullResync = false } = {}) {
  const connection = await getConnection(tenantId);
  if (!connection || connection.sync_enabled === false) {
    return { skipped: true, reason: 'not_connected_or_disabled' };
  }

  if (fullResync) {
    await db.query(
      `UPDATE tenant_google_calendar_connections SET sync_token = NULL, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId],
    );
    connection.sync_token = null;
  }

  const calendarId = connection.calendar_id || 'primary';
  const ownerEmail = (connection.google_email || '').toLowerCase();

  try {
    const accessToken = await getValidAccessToken(connection);
    let pageToken = null;
    let syncToken = connection.sync_token || null;
    let processed = 0;
    let skipped = 0;
    let newSyncToken = syncToken;

    do {
      const params = {
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '250',
      };

      if (pageToken) {
        params.pageToken = pageToken;
      } else if (syncToken) {
        params.syncToken = syncToken;
      } else {
        const timeMin = new Date().toISOString();
        const timeMax = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
        params.timeMin = timeMin;
        params.timeMax = timeMax;
        params.orderBy = 'startTime';
      }

      let data;
      try {
        const qs = new URLSearchParams(params);
        data = await googleFetch(
          `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${qs}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
      } catch (err) {
        if (err.statusCode === 410 && syncToken) {
          await db.query(
            `UPDATE tenant_google_calendar_connections SET sync_token = NULL, updated_at = NOW() WHERE tenant_id = $1`,
            [tenantId],
          );
          return syncTenantCalendar(tenantId);
        }
        throw err;
      }

      for (const event of data.items || []) {
        const outcome = await processGoogleEvent(tenantId, event, ownerEmail);
        if (outcome.skipped) skipped += 1;
        else processed += 1;
      }

      pageToken = data.nextPageToken || null;
      if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
    } while (pageToken);

    await db.query(
      `UPDATE tenant_google_calendar_connections SET
         sync_token = $2,
         last_synced_at = NOW(),
         last_sync_error = NULL,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, newSyncToken],
    );

    return { processed, skipped, syncToken: !!newSyncToken };
  } catch (err) {
    await db.query(
      `UPDATE tenant_google_calendar_connections SET
         last_sync_error = $2,
         updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId, err.message],
    );
    throw err;
  }
}

async function registerWatch(tenantId) {
  if (!canRegisterWatch()) {
    return { skipped: true, reason: 'webhook_requires_https' };
  }

  const connection = await getConnection(tenantId);
  if (!connection) {
    throw Object.assign(new Error('Google Calendar not connected'), { statusCode: 404, isOperational: true });
  }

  const accessToken = await getValidAccessToken(connection);
  const channelId = uuidv4();
  const channelToken = jwt.sign({ tenantId }, config.jwt.secret, { expiresIn: '7d' });
  const expirationMs = Date.now() + 6 * 24 * 60 * 60 * 1000; // 6 days (renew before 7-day limit)

  const body = {
    id: channelId,
    type: 'web_hook',
    address: webhookUrl(),
    token: channelToken,
    expiration: String(expirationMs),
  };

  const calendarId = connection.calendar_id || 'primary';
  const data = await googleFetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  await db.query(
    `UPDATE tenant_google_calendar_connections SET
       watch_channel_id = $2,
       watch_resource_id = $3,
       watch_expiration = $4,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, data.id || channelId, data.resourceId, new Date(Number(data.expiration || expirationMs))],
  );

  return { channelId: data.id || channelId, expiration: data.expiration };
}

async function handlePushNotification(headers) {
  const channelId = headers['x-goog-channel-id'];
  const resourceState = headers['x-goog-resource-state'];
  const channelToken = headers['x-goog-channel-token'];

  if (resourceState === 'sync') {
    return { ok: true, action: 'sync_handshake' };
  }

  const connection = await getConnectionByChannelId(channelId);
  if (!connection) {
    return { ok: true, action: 'unknown_channel' };
  }

  if (channelToken) {
    try {
      jwt.verify(channelToken, config.jwt.secret);
    } catch {
      console.warn('[GCAL] Invalid watch channel token');
      return { ok: false, action: 'invalid_token' };
    }
  }

  await syncTenantCalendar(connection.tenant_id);
  return { ok: true, action: 'synced', tenantId: connection.tenant_id };
}

async function renewExpiringWatches() {
  if (!canRegisterWatch() || !isConfigured()) return { renewed: 0 };

  const result = await db.query(
    `SELECT tenant_id FROM tenant_google_calendar_connections
     WHERE sync_enabled = true
       AND refresh_token_enc IS NOT NULL
       AND (watch_expiration IS NULL OR watch_expiration < NOW() + INTERVAL '24 hours')`,
  );

  let renewed = 0;
  for (const row of result.rows) {
    try {
      await registerWatch(row.tenant_id);
      renewed += 1;
    } catch (err) {
      console.warn(`[GCAL] Watch renewal failed for tenant ${row.tenant_id}:`, err.message);
    }
  }
  return { renewed };
}

async function syncAllEnabledConnections() {
  if (!isConfigured()) return { tenants: 0 };

  const result = await db.query(
    `SELECT tenant_id FROM tenant_google_calendar_connections
     WHERE sync_enabled = true AND refresh_token_enc IS NOT NULL`,
  );

  let ok = 0;
  let failed = 0;
  for (const row of result.rows) {
    try {
      await syncTenantCalendar(row.tenant_id);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`[GCAL] Sync failed for tenant ${row.tenant_id}:`, err.message);
    }
  }

  return { tenants: result.rows.length, ok, failed };
}

async function clearGoogleCalendarAppointments(tenantId) {
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count FROM appointments WHERE tenant_id = $1 AND provider = 'google_calendar'`,
    [tenantId],
  );
  const deletedCount = countResult.rows[0]?.count || 0;

  await db.query(
    `DELETE FROM appointments WHERE tenant_id = $1 AND provider = 'google_calendar'`,
    [tenantId],
  );

  await db.query(
    `DELETE FROM calendar_sync_events WHERE tenant_id = $1`,
    [tenantId],
  );

  await db.query(
    `UPDATE tenant_google_calendar_connections SET sync_token = NULL, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId],
  );

  return { deletedCount };
}

async function clearAndResyncTenantCalendar(tenantId) {
  const connection = await getConnection(tenantId);
  if (!connection) {
    throw Object.assign(new Error('Google Calendar not connected'), { statusCode: 404, isOperational: true });
  }

  const { deletedCount } = await clearGoogleCalendarAppointments(tenantId);
  const sync = await syncTenantCalendar(tenantId, { fullResync: true });

  return {
    deletedCount,
    processed: sync.processed ?? 0,
    skipped: sync.skipped ?? 0,
  };
}

async function getStatus(tenantId) {
  const connection = await getConnection(tenantId);
  return formatConnection(connection);
}

const SKIP_REASON_LABELS = {
  past_event: 'Past event (already ended)',
  no_contact_identity: 'Could not identify client from calendar event',
  missing_contact_identity: 'Missing client name or email',
  missing_phone: 'Missing valid phone (required to create contact)',
  contact_not_in_list: 'Client not in Contacts and missing phone or name',
};

function mapSyncLogRow(row) {
  const payload = typeof row.raw_payload === 'string'
    ? JSON.parse(row.raw_payload)
    : (row.raw_payload || {});

  return {
    id: row.id,
    googleEventId: row.google_event_id,
    syncAction: row.sync_action,
    skipReason: row.skip_reason,
    skipReasonLabel: SKIP_REASON_LABELS[row.skip_reason] || row.skip_reason || null,
    eventType: row.event_type,
    errorMessage: row.error_message,
    summary: payload.summary || null,
    firstName: payload.firstName || null,
    lastName: payload.lastName || null,
    email: payload.email || null,
    phone: payload.phone || null,
    eventEnd: payload.end || null,
    createdAt: row.created_at,
  };
}

async function listSyncLog(tenantId, { limit = 50, action = 'skipped' } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const params = [tenantId];
  const filters = ['tenant_id = $1'];

  if (action && action !== 'all') {
    params.push(action);
    filters.push(`sync_action = $${params.length}`);
  }

  params.push(safeLimit);
  const limitIdx = params.length;

  const result = await db.query(
    `WITH ranked AS (
       SELECT
         id,
         google_event_id,
         sync_action,
         skip_reason,
         event_type,
         error_message,
         raw_payload,
         created_at,
         ROW_NUMBER() OVER (PARTITION BY google_event_id ORDER BY created_at DESC) AS rn
       FROM calendar_sync_events
       WHERE ${filters.join(' AND ')}
     )
     SELECT id, google_event_id, sync_action, skip_reason, event_type, error_message, raw_payload, created_at
     FROM ranked
     WHERE rn = 1
     ORDER BY created_at DESC
     LIMIT $${limitIdx}`,
    params,
  );

  return {
    events: result.rows.map(mapSyncLogRow),
  };
}

module.exports = {
  isConfigured,
  buildConnectUrl,
  handleOAuthCallback,
  getStatus,
  listCalendars,
  updateConnectionSettings,
  disconnect,
  syncTenantCalendar,
  clearGoogleCalendarAppointments,
  clearAndResyncTenantCalendar,
  listSyncLog,
  syncAllEnabledConnections,
  registerWatch,
  renewExpiringWatches,
  handlePushNotification,
  appSettingsUrl,
};
