const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const ecwJwks = require('../utils/ecwJwks');

const DEFAULT_SCOPES = [
  'openid',
  'fhirUser',
  'offline_access',
  'patient/Encounter.read',
  'patient/Patient.read',
].join(' ');

/** Backend Single Patient — no system/Group.read (bulk only). */
const DEFAULT_BACKEND_SCOPES = [
  'system/Encounter.read',
  'system/Patient.read',
].join(' ');

const DEFAULT_BACKEND_BULK_SCOPES = [
  'system/Group.read',
  'system/Patient.read',
  'system/Encounter.read',
  'system/Practitioner.read',
].join(' ');

const CONNECTION_MODE_SINGLE = 'single_patient';
const CONNECTION_MODE_BULK = 'bulk';

const tokenUrlMetadataCache = new Map();

function authMode() {
  const forced = (process.env.ECW_AUTH_MODE || '').trim().toLowerCase();
  if (forced === 'backend' || forced === 'oauth') return forced;
  if (ecwJwks.isJwksConfigured() && process.env.ECW_CLIENT_ID) return 'backend';
  if (process.env.ECW_CLIENT_SECRET) return 'oauth';
  return ecwJwks.isJwksConfigured() ? 'backend' : 'oauth';
}

function isOAuthConfigured() {
  return !!(process.env.ECW_CLIENT_ID && process.env.ECW_CLIENT_SECRET);
}

function isBackendConfigured() {
  return !!(process.env.ECW_CLIENT_ID && ecwJwks.isJwksConfigured());
}

function isConfigured() {
  return isOAuthConfigured() || isBackendConfigured();
}

function authorizeUrl() {
  return (
    process.env.ECW_AUTHORIZE_URL
    || 'https://oauthserver.eclinicalworks.com/oauth2/v1/authorize'
  );
}

function tokenUrl() {
  return (
    process.env.ECW_TOKEN_URL
    || 'https://oauthserver.eclinicalworks.com/oauth/oauth2/token'
  );
}

function backendScopes() {
  return (process.env.ECW_BACKEND_SCOPES || DEFAULT_BACKEND_SCOPES).trim();
}

function backendBulkScopes() {
  return (process.env.ECW_BACKEND_BULK_SCOPES || DEFAULT_BACKEND_BULK_SCOPES).trim();
}

function backendScopesForConnection(connection) {
  if (connection?.connection_mode === CONNECTION_MODE_BULK) {
    return backendBulkScopes();
  }
  return backendScopes();
}

function isBulkConnection(row) {
  return row?.connection_mode === CONNECTION_MODE_BULK;
}

async function resolveTokenUrl(fhirBaseUrl) {
  const override = (process.env.ECW_TOKEN_URL || '').trim();
  if (override) return override;

  const issuer = (fhirBaseUrl || defaultFhirBaseUrl() || '').trim().replace(/\/$/, '');
  if (!issuer) return tokenUrl();

  const cached = tokenUrlMetadataCache.get(issuer);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const metaUrl = `${issuer}/metadata?_format=json`;
    const res = await fetch(metaUrl, {
      headers: { Accept: 'application/fhir+json, application/json' },
    });
    if (!res.ok) throw new Error(`metadata ${res.status}`);
    const data = await res.json();
    const rest = Array.isArray(data.rest) ? data.rest[0] : null;
    const extensions = rest?.security?.extension || [];
    const oauthExt = extensions.find(
      (e) => e.url === 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
    );
    const tokenExt = oauthExt?.extension?.find((e) => e.url === 'token');
    const discovered = tokenExt?.valueUri;
    if (discovered) {
      tokenUrlMetadataCache.set(issuer, { url: discovered, expiresAt: Date.now() + 60 * 60 * 1000 });
      return discovered;
    }
  } catch (err) {
    console.warn('[ECW] Token URL metadata discovery failed:', err.message);
  }

  return tokenUrl();
}

function redirectUri() {
  return (
    process.env.ECW_REDIRECT_URI
    || `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/integrations/ecw/oauth/callback`
  );
}

function appSettingsUrl(query = '') {
  const base = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.clientforge.ai';
  return `${base.replace(/\/$/, '')}/settings${query ? `?${query}` : ''}`;
}

function defaultFhirBaseUrl() {
  return (process.env.ECW_FHIR_BASE_URL || '').trim().replace(/\/$/, '') || null;
}

function connectionUsesBackend(row) {
  if (!row) return authMode() === 'backend';
  if (row.refresh_token_enc) return false;
  if (authMode() === 'oauth' && row.access_token_enc && !row.ecw_patient_id) return false;
  return authMode() === 'backend' || !!(row.ecw_patient_id && row.fhir_base_url && isBackendConfigured());
}

function isConnectionActive(row) {
  if (!row) return false;
  if (row.refresh_token_enc || row.access_token_enc) return true;
  if (!connectionUsesBackend(row) || !row.fhir_base_url) return false;
  if (isBulkConnection(row)) {
    return !!row.ecw_group_id;
  }
  return !!row.ecw_patient_id;
}

function formatConnection(row, tenantFlags = {}) {
  const mode = authMode();
  if (!row) {
    return {
      connected: false,
      configured: isConfigured(),
      authMode: mode,
      backendConfigured: isBackendConfigured(),
      jwksUrl: ecwJwks.jwksPublicUrl(),
      pollEnabled: false,
      checkoutAutomations: !!tenantFlags.ecwCheckoutAutomations,
    };
  }
  return {
    connected: isConnectionActive(row),
    configured: isConfigured(),
    authMode: connectionUsesBackend(row) ? 'backend' : mode,
    backendConfigured: isBackendConfigured(),
    jwksUrl: ecwJwks.jwksPublicUrl(),
    fhirBaseUrl: row.fhir_base_url || null,
    connectionMode: row.connection_mode || CONNECTION_MODE_SINGLE,
    ecwPatientId: row.ecw_patient_id || null,
    ecwGroupId: row.ecw_group_id || null,
    pollEnabled: row.poll_enabled !== false,
    lastEncounterPollAt: row.last_encounter_poll_at || null,
    lastBulkExportAt: row.last_bulk_export_at || null,
    lastPollError: row.last_poll_error || null,
    connectedAt: row.connected_at || null,
    checkoutAutomations: !!tenantFlags.ecwCheckoutAutomations,
    redirectUri: mode === 'oauth' ? redirectUri() : null,
  };
}

async function getConnection(tenantId) {
  const result = await db.query('SELECT * FROM tenant_ecw_connections WHERE tenant_id = $1', [tenantId]);
  return result.rows[0] || null;
}

async function getTenantCheckoutFlag(tenantId) {
  const r = await db.query('SELECT ecw_checkout_automations FROM tenants WHERE id = $1', [tenantId]);
  return !!r.rows[0]?.ecw_checkout_automations;
}

function buildOAuthState(tenantId, fhirBaseUrl) {
  return jwt.sign(
    { tenantId, purpose: 'ecw_oauth', fhirBaseUrl: fhirBaseUrl || null },
    config.jwt.secret,
    { expiresIn: '15m' },
  );
}

function verifyOAuthState(state) {
  const decoded = jwt.verify(state, config.jwt.secret);
  if (decoded.purpose !== 'ecw_oauth' || !decoded.tenantId) {
    throw Object.assign(new Error('Invalid OAuth state'), { statusCode: 400 });
  }
  return { tenantId: decoded.tenantId, fhirBaseUrl: decoded.fhirBaseUrl || null };
}

function buildConnectUrl(tenantId, { fhirBaseUrl } = {}) {
  if (!isConfigured()) {
    throw Object.assign(new Error('eClinicalWorks OAuth is not configured on the server'), {
      statusCode: 503,
      isOperational: true,
    });
  }
  const aud = (fhirBaseUrl || defaultFhirBaseUrl() || '').trim();
  if (!aud) {
    throw Object.assign(
      new Error('FHIR base URL is required. Set ECW_FHIR_BASE_URL on the server or pass fhirBaseUrl when connecting.'),
      { statusCode: 400, isOperational: true },
    );
  }
  const state = buildOAuthState(tenantId, aud.replace(/\/$/, ''));
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ECW_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: process.env.ECW_SCOPES || DEFAULT_SCOPES,
    state,
    aud,
  });
  return `${authorizeUrl()}?${params.toString()}`;
}

async function exchangeOAuthCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    client_id: process.env.ECW_CLIENT_ID,
    client_secret: process.env.ECW_CLIENT_SECRET,
  });
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error_description || data.error || 'eCW token exchange failed'),
      { statusCode: res.status },
    );
  }
  return data;
}

async function fetchBackendAccessToken(fhirBaseUrl, { scope } = {}) {
  const clientId = process.env.ECW_CLIENT_ID;
  const aud = await resolveTokenUrl(fhirBaseUrl);
  const clientAssertion = ecwJwks.signClientAssertion({ clientId, tokenUrl: aud });
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: (scope || backendScopes()).trim(),
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  });
  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error_description || data.error || 'eCW backend token request failed'),
      { statusCode: res.status },
    );
  }
  return data;
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: process.env.ECW_CLIENT_ID,
    client_secret: process.env.ECW_CLIENT_SECRET,
  });
  const res = await fetch(tokenUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(
      new Error(data.error_description || data.error || 'eCW token refresh failed'),
      { statusCode: res.status },
    );
  }
  return data;
}

async function saveTokens(
  tenantId,
  tokenData,
  {
    fhirBaseUrl,
    ecwPatientId,
    ecwGroupId,
    connectionMode,
  } = {},
) {
  const expiresIn = Number(tokenData.expires_in) || 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const mode = connectionMode === CONNECTION_MODE_BULK ? CONNECTION_MODE_BULK : CONNECTION_MODE_SINGLE;

  await db.query(
    `INSERT INTO tenant_ecw_connections
       (tenant_id, fhir_base_url, connection_mode, ecw_patient_id, ecw_group_id, scope,
        access_token_enc, refresh_token_enc, token_expires_at,
        poll_enabled, connected_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       fhir_base_url = COALESCE(EXCLUDED.fhir_base_url, tenant_ecw_connections.fhir_base_url),
       connection_mode = COALESCE(EXCLUDED.connection_mode, tenant_ecw_connections.connection_mode),
       ecw_patient_id = EXCLUDED.ecw_patient_id,
       ecw_group_id = EXCLUDED.ecw_group_id,
       scope = COALESCE(EXCLUDED.scope, tenant_ecw_connections.scope),
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = COALESCE(EXCLUDED.refresh_token_enc, tenant_ecw_connections.refresh_token_enc),
       token_expires_at = EXCLUDED.token_expires_at,
       connected_at = COALESCE(tenant_ecw_connections.connected_at, NOW()),
       updated_at = NOW()`,
    [
      tenantId,
      fhirBaseUrl || null,
      mode,
      ecwPatientId || null,
      ecwGroupId || null,
      tokenData.scope || null,
      encrypt(tokenData.access_token),
      encrypt(tokenData.refresh_token || ''),
      expiresAt,
    ],
  );
}

async function getValidAccessToken(connection) {
  if (!connection) {
    throw Object.assign(new Error('eClinicalWorks not connected for tenant'), { statusCode: 400 });
  }

  const useBackend = connectionUsesBackend(connection);
  let accessToken = connection.access_token_enc ? decrypt(connection.access_token_enc) : null;
  const refreshToken = connection.refresh_token_enc ? decrypt(connection.refresh_token_enc) : null;
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at) : null;
  const needsRefresh = !accessToken || (expiresAt && expiresAt.getTime() < Date.now() + 60_000);

  if (needsRefresh) {
    if (useBackend) {
      const fhirBase = connection.fhir_base_url || defaultFhirBaseUrl();
      if (!fhirBase) {
        throw Object.assign(new Error('FHIR base URL not configured for tenant'), { statusCode: 400 });
      }
      const refreshed = await fetchBackendAccessToken(fhirBase, {
        scope: backendScopesForConnection(connection),
      });
      await saveTokens(connection.tenant_id, refreshed, {
        fhirBaseUrl: connection.fhir_base_url,
        ecwPatientId: connection.ecw_patient_id,
        ecwGroupId: connection.ecw_group_id,
        connectionMode: connection.connection_mode,
      });
      accessToken = refreshed.access_token;
    } else if (refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      await saveTokens(connection.tenant_id, refreshed, {
        fhirBaseUrl: connection.fhir_base_url,
        ecwPatientId: connection.ecw_patient_id,
      });
      accessToken = refreshed.access_token;
    } else {
      throw Object.assign(new Error('eCW access token expired and no refresh token'), { statusCode: 401 });
    }
  }

  return accessToken;
}

async function fhirRequest(connection, pathAndQuery, options = {}) {
  const {
    method = 'GET',
    headers: extraHeaders = {},
    body,
    returnResponse = false,
  } = options;

  const accessToken = await getValidAccessToken(connection);
  const base = (connection.fhir_base_url || defaultFhirBaseUrl() || '').replace(/\/$/, '');
  if (!base && !pathAndQuery.startsWith('http')) {
    throw Object.assign(new Error('FHIR base URL not configured for tenant'), { statusCode: 400 });
  }
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${base}/${pathAndQuery.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/fhir+json',
      ...extraHeaders,
    },
    body,
  });

  if (returnResponse) return res;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.issue?.[0]?.diagnostics || data?.message || res.statusText || 'FHIR request failed';
    const err = new Error(msg);
    err.statusCode = res.status;
    throw err;
  }
  return data;
}

async function fhirGet(connection, pathAndQuery) {
  return fhirRequest(connection, pathAndQuery);
}

async function fetchPatient(connection, patientId) {
  if (!patientId) return null;
  return fhirGet(connection, `Patient/${encodeURIComponent(patientId)}`);
}

async function fetchPractitioner(connection, practitionerId) {
  if (!practitionerId) return null;
  return fhirGet(connection, `Practitioner/${encodeURIComponent(practitionerId)}`);
}

const ECW_ENCOUNTER_SEARCH_MAX_PAGES = 10;

/**
 * eCW Encounter search supports patient (and date/page) — not status/_lastUpdated/_sort/_count.
 * Finished status and poll window are applied in ecwEncounter.worker.
 */
async function searchFinishedEncountersSince(connection, _sinceIso) {
  const pid = String(connection.ecw_patient_id || '').trim();
  if (!pid) {
    throw Object.assign(
      new Error('eCW Patient ID is required for Encounter search'),
      { statusCode: 400, isOperational: true },
    );
  }
  const patientRef = pid.startsWith('Patient/') ? pid : `Patient/${pid}`;
  const params = new URLSearchParams({ patient: patientRef });

  let bundle = await fhirGet(connection, `Encounter?${params.toString()}`);
  const allEntries = [...(bundle.entry || [])];
  let pages = 1;

  while (pages < ECW_ENCOUNTER_SEARCH_MAX_PAGES) {
    const nextLink = (bundle.link || []).find((l) => l.relation === 'next');
    if (!nextLink?.url) break;
    bundle = await fhirGet(connection, nextLink.url);
    allEntries.push(...(bundle.entry || []));
    pages += 1;
  }

  return {
    ...bundle,
    resourceType: 'Bundle',
    type: bundle.type || 'searchset',
    entry: allEntries,
  };
}

async function connectBackend(
  tenantId,
  {
    fhirBaseUrl,
    ecwPatientId,
    ecwGroupId,
    connectionMode,
    testToken = true,
  } = {},
) {
  if (!isBackendConfigured()) {
    throw Object.assign(
      new Error('eCW Backend auth is not configured (ECW_CLIENT_ID + ECW_PRIVATE_KEY)'),
      { statusCode: 503, isOperational: true },
    );
  }
  const aud = (fhirBaseUrl || defaultFhirBaseUrl() || '').trim().replace(/\/$/, '');
  if (!aud) {
    throw Object.assign(
      new Error('FHIR base URL is required (practice issuer URL from eCW dev portal).'),
      { statusCode: 400, isOperational: true },
    );
  }

  const mode = connectionMode === CONNECTION_MODE_BULK ? CONNECTION_MODE_BULK : CONNECTION_MODE_SINGLE;
  const patientId = (ecwPatientId || '').trim();
  const groupId = (ecwGroupId || '').trim();

  if (mode === CONNECTION_MODE_BULK) {
    if (!groupId) {
      throw Object.assign(
        new Error('eCW Group ID is required for Backend Bulk API.'),
        { statusCode: 400, isOperational: true },
      );
    }
  } else if (!patientId) {
    throw Object.assign(
      new Error('eCW Patient ID is required for Backend Single Patient API.'),
      { statusCode: 400, isOperational: true },
    );
  }

  const scope = mode === CONNECTION_MODE_BULK ? backendBulkScopes() : backendScopes();

  if (testToken) {
    const tokenData = await fetchBackendAccessToken(aud, { scope });
    await saveTokens(tenantId, tokenData, {
      fhirBaseUrl: aud,
      ecwPatientId: mode === CONNECTION_MODE_SINGLE ? patientId : null,
      ecwGroupId: mode === CONNECTION_MODE_BULK ? groupId : null,
      connectionMode: mode,
    });
  } else {
    await db.query(
      `INSERT INTO tenant_ecw_connections
         (tenant_id, fhir_base_url, connection_mode, ecw_patient_id, ecw_group_id, poll_enabled, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (tenant_id) DO UPDATE SET
         fhir_base_url = EXCLUDED.fhir_base_url,
         connection_mode = EXCLUDED.connection_mode,
         ecw_patient_id = EXCLUDED.ecw_patient_id,
         ecw_group_id = EXCLUDED.ecw_group_id,
         refresh_token_enc = NULL,
         poll_enabled = true,
         connected_at = COALESCE(tenant_ecw_connections.connected_at, NOW()),
         updated_at = NOW()`,
      [tenantId, aud, mode, mode === CONNECTION_MODE_SINGLE ? patientId : null, mode === CONNECTION_MODE_BULK ? groupId : null],
    );
  }

  return getStatus(tenantId);
}

async function handleOAuthCallback(code, state) {
  const { tenantId, fhirBaseUrl } = verifyOAuthState(state);
  const tokenData = await exchangeOAuthCode(code);
  const patientFromToken = tokenData.patient || null;
  await saveTokens(tenantId, tokenData, {
    fhirBaseUrl: fhirBaseUrl || defaultFhirBaseUrl(),
    ecwPatientId: patientFromToken,
  });
  return { tenantId, patientId: patientFromToken };
}

async function getStatus(tenantId) {
  const row = await getConnection(tenantId);
  const checkoutAutomations = await getTenantCheckoutFlag(tenantId);
  return formatConnection(row, { ecwCheckoutAutomations: checkoutAutomations });
}

async function disconnect(tenantId) {
  await db.query('DELETE FROM tenant_ecw_connections WHERE tenant_id = $1', [tenantId]);
  return { disconnected: true };
}

async function setPollEnabled(tenantId, enabled) {
  await db.query(
    `UPDATE tenant_ecw_connections SET poll_enabled = $2, updated_at = NOW() WHERE tenant_id = $1`,
    [tenantId, !!enabled],
  );
  return getStatus(tenantId);
}

async function updatePollCursor(tenantId, { lastPollAt, error }) {
  if (error) {
    await db.query(
      `UPDATE tenant_ecw_connections SET last_poll_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, String(error).slice(0, 2000)],
    );
    return;
  }
  await db.query(
    `UPDATE tenant_ecw_connections SET
       last_encounter_poll_at = $2,
       last_poll_error = NULL,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, lastPollAt || new Date()],
  );
}

async function updateBulkExportCursor(tenantId, { lastExportAt, error, clearPollError }) {
  if (clearPollError) {
    await db.query(
      `UPDATE tenant_ecw_connections SET last_poll_error = NULL, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId],
    );
    return;
  }
  if (error) {
    await db.query(
      `UPDATE tenant_ecw_connections SET last_poll_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
      [tenantId, String(error).slice(0, 2000)],
    );
    return;
  }
  await db.query(
    `UPDATE tenant_ecw_connections SET
       last_bulk_export_at = $2,
       last_poll_error = NULL,
       bulk_export_status_url = NULL,
       bulk_export_job_started_at = NULL,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, lastExportAt || new Date()],
  );
}

async function setBulkExportJob(tenantId, { statusUrl, startedAt }) {
  const url = String(statusUrl || '').trim();
  if (!url) return;
  await db.query(
    `UPDATE tenant_ecw_connections SET
       bulk_export_status_url = $2,
       bulk_export_job_started_at = COALESCE($3, bulk_export_job_started_at, NOW()),
       last_poll_error = NULL,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId, url.slice(0, 4000), startedAt || null],
  );
}

async function clearBulkExportJob(tenantId) {
  await db.query(
    `UPDATE tenant_ecw_connections SET
       bulk_export_status_url = NULL,
       bulk_export_job_started_at = NULL,
       updated_at = NOW()
     WHERE tenant_id = $1`,
    [tenantId],
  );
}

async function listPollableConnections() {
  const result = await db.query(
    `SELECT c.*, t.ecw_checkout_automations, t.automation_test_mode
     FROM tenant_ecw_connections c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.poll_enabled = true
       AND t.active = true
       AND COALESCE(c.connection_mode, 'single_patient') = 'single_patient'
       AND (
         c.refresh_token_enc IS NOT NULL
         OR c.access_token_enc IS NOT NULL
         OR (c.fhir_base_url IS NOT NULL AND c.ecw_patient_id IS NOT NULL)
       )`,
  );
  if (!isBackendConfigured()) {
    return result.rows.filter((row) => row.refresh_token_enc || row.access_token_enc);
  }
  return result.rows.filter((row) => isConnectionActive(row) && !isBulkConnection(row));
}

async function listBulkExportConnections() {
  const result = await db.query(
    `SELECT c.*, t.ecw_checkout_automations, t.automation_test_mode
     FROM tenant_ecw_connections c
     JOIN tenants t ON t.id = c.tenant_id
     WHERE c.poll_enabled = true
       AND t.active = true
       AND c.connection_mode = 'bulk'
       AND c.fhir_base_url IS NOT NULL
       AND c.ecw_group_id IS NOT NULL`,
  );
  if (!isBackendConfigured()) {
    return result.rows.filter((row) => row.refresh_token_enc || row.access_token_enc);
  }
  return result.rows.filter((row) => isConnectionActive(row) && isBulkConnection(row));
}

module.exports = {
  authMode,
  isConfigured,
  isBackendConfigured,
  isOAuthConfigured,
  redirectUri,
  appSettingsUrl,
  buildConnectUrl,
  connectBackend,
  handleOAuthCallback,
  getStatus,
  disconnect,
  setPollEnabled,
  getConnection,
  searchFinishedEncountersSince,
  fetchPatient,
  fetchPractitioner,
  updatePollCursor,
  updateBulkExportCursor,
  setBulkExportJob,
  clearBulkExportJob,
  listPollableConnections,
  listBulkExportConnections,
  fhirGet,
  fhirRequest,
  fetchBackendAccessToken,
  resolveTokenUrl,
  backendBulkScopes,
  CONNECTION_MODE_BULK,
  CONNECTION_MODE_SINGLE,
};
