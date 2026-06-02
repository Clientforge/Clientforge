const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db/connection');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const { parseInstagramWebhook } = require('../adapters/instagram.adapter');

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  'instagram_basic',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_messaging',
].join(',');

function isConfigured() {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

function webhookVerifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN || '';
}

function redirectUri() {
  return (
    process.env.META_REDIRECT_URI
    || `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/integrations/instagram/callback`
  );
}

function appSettingsUrl(query = '') {
  const base = process.env.APP_URL || process.env.FRONTEND_URL || 'https://app.clientforge.ai';
  return `${base.replace(/\/$/, '')}/settings${query ? `?${query}` : ''}`;
}

function webhookUrl() {
  return `${process.env.BASE_URL || `http://localhost:${config.port}`}/api/v1/webhook/meta`;
}

async function graphFetch(path, { method = 'GET', token, body } = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  if (token) url.searchParams.set('access_token', token);

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!data || data.error) {
    const msg = data?.error?.message || res.statusText || 'Meta API error';
    const err = new Error(msg);
    err.statusCode = res.status;
    err.metaError = data?.error;
    throw err;
  }
  if (!res.ok) {
    throw Object.assign(new Error(res.statusText || 'Meta API error'), { statusCode: res.status });
  }
  return data;
}

function formatConnection(row) {
  if (!row) {
    return { connected: false, configured: isConfigured() };
  }
  return {
    connected: !!row.access_token_enc,
    pageId: row.page_id,
    pageName: row.page_name || null,
    instagramBusinessAccountId: row.instagram_business_account_id,
    instagramUsername: row.instagram_username || null,
    syncEnabled: row.sync_enabled !== false,
    lastWebhookError: row.last_webhook_error || null,
    webhookUrl: webhookUrl(),
    configured: isConfigured(),
  };
}

async function getConnection(tenantId) {
  const result = await db.query(
    'SELECT * FROM tenant_instagram_connections WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getConnectionByInstagramAccountId(instagramAccountId) {
  if (!instagramAccountId) return null;
  const result = await db.query(
    'SELECT * FROM tenant_instagram_connections WHERE instagram_business_account_id = $1 AND sync_enabled = true',
    [String(instagramAccountId)],
  );
  return result.rows[0] || null;
}

function buildOAuthState(tenantId) {
  return jwt.sign({ tenantId, purpose: 'instagram_oauth' }, config.jwt.secret, { expiresIn: '15m' });
}

function verifyOAuthState(state) {
  const decoded = jwt.verify(state, config.jwt.secret);
  if (decoded.purpose !== 'instagram_oauth' || !decoded.tenantId) {
    throw Object.assign(new Error('Invalid OAuth state'), { statusCode: 400 });
  }
  return decoded.tenantId;
}

function buildConnectUrl(tenantId) {
  if (!isConfigured()) {
    throw Object.assign(new Error('Instagram (Meta) OAuth is not configured on the server'), {
      statusCode: 503,
      isOperational: true,
    });
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: redirectUri(),
    scope: SCOPES,
    response_type: 'code',
    state: buildOAuthState(tenantId),
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    redirect_uri: redirectUri(),
    code,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw Object.assign(new Error(data.error?.message || 'Token exchange failed'), { statusCode: 400 });
  }
  return data;
}

async function exchangeForLongLivedToken(shortToken) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    fb_exchange_token: shortToken,
  });
  const res = await fetch(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw Object.assign(new Error(data.error?.message || 'Long-lived token exchange failed'), { statusCode: 400 });
  }
  return data;
}

async function resolveInstagramPage(userAccessToken) {
  const data = await graphFetch(
    '/me/accounts?fields=name,access_token,instagram_business_account{id,username}',
    { token: userAccessToken },
  );

  for (const page of data.data || []) {
    const ig = page.instagram_business_account;
    if (ig?.id) {
      return {
        pageId: String(page.id),
        pageName: page.name || null,
        pageAccessToken: page.access_token,
        instagramBusinessAccountId: String(ig.id),
        instagramUsername: ig.username || null,
      };
    }
  }

  throw Object.assign(
    new Error('No Facebook Page with a linked Instagram Business account was found. Connect Instagram to a Page in Meta Business Settings, then try again.'),
    { statusCode: 400, isOperational: true },
  );
}

async function subscribePageToWebhooks(pageId, pageAccessToken) {
  try {
    await graphFetch(`/${pageId}/subscribed_apps`, {
      method: 'POST',
      token: pageAccessToken,
      body: { subscribed_fields: ['messages', 'messaging_postbacks'] },
    });
    return true;
  } catch (err) {
    console.warn('[IG] Page webhook subscription failed (configure app webhook in Meta Developer Console):', err.message);
    return false;
  }
}

async function handleOAuthCallback(code, state) {
  const tenantId = verifyOAuthState(state);
  const short = await exchangeCodeForToken(code);
  let accessToken = short.access_token;
  let expiresIn = short.expires_in;

  try {
    const long = await exchangeForLongLivedToken(accessToken);
    accessToken = long.access_token;
    expiresIn = long.expires_in;
  } catch (err) {
    console.warn('[IG] Long-lived token exchange failed, using short-lived token:', err.message);
  }

  const page = await resolveInstagramPage(accessToken);
  await subscribePageToWebhooks(page.pageId, page.pageAccessToken);

  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + Number(expiresIn) * 1000)
    : null;

  await db.query(
    `INSERT INTO tenant_instagram_connections
       (tenant_id, page_id, page_name, instagram_business_account_id, instagram_username,
        access_token_enc, token_expires_at, sync_enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       page_id = EXCLUDED.page_id,
       page_name = EXCLUDED.page_name,
       instagram_business_account_id = EXCLUDED.instagram_business_account_id,
       instagram_username = EXCLUDED.instagram_username,
       access_token_enc = EXCLUDED.access_token_enc,
       token_expires_at = EXCLUDED.token_expires_at,
       sync_enabled = true,
       last_webhook_error = NULL,
       updated_at = NOW()`,
    [
      tenantId,
      page.pageId,
      page.pageName,
      page.instagramBusinessAccountId,
      page.instagramUsername,
      encrypt(page.pageAccessToken),
      tokenExpiresAt,
    ],
  );

  return { tenantId, instagramUsername: page.instagramUsername };
}

async function getStatus(tenantId) {
  const row = await getConnection(tenantId);
  return formatConnection(row);
}

async function disconnect(tenantId) {
  await db.query('DELETE FROM tenant_instagram_connections WHERE tenant_id = $1', [tenantId]);
  return { disconnected: true };
}

function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!process.env.META_APP_SECRET) return true;
  if (!signatureHeader || !rawBody) return false;

  const expected = `sha256=${crypto
    .createHmac('sha256', process.env.META_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

async function fetchInstagramUserProfile(instagramUserId, pageAccessToken) {
  try {
    const data = await graphFetch(
      `/${instagramUserId}?fields=name,username`,
      { token: pageAccessToken },
    );
    return {
      displayName: data.name || data.username || null,
      username: data.username || null,
    };
  } catch {
    return { displayName: null, username: null };
  }
}

async function upsertConversation(tenantId, instagramUserId, profile = {}) {
  const existing = await db.query(
    `SELECT id FROM instagram_conversations
     WHERE tenant_id = $1 AND instagram_user_id = $2`,
    [tenantId, instagramUserId],
  );

  if (existing.rows[0]) {
    await db.query(
      `UPDATE instagram_conversations SET
         instagram_username = COALESCE(NULLIF($2, ''), instagram_username),
         display_name = COALESCE(NULLIF($3, ''), display_name),
         updated_at = NOW()
       WHERE id = $1`,
      [existing.rows[0].id, profile.username || '', profile.displayName || ''],
    );
    return existing.rows[0].id;
  }

  const inserted = await db.query(
    `INSERT INTO instagram_conversations
       (tenant_id, instagram_user_id, instagram_username, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [tenantId, instagramUserId, profile.username || null, profile.displayName || null],
  );
  return inserted.rows[0].id;
}

async function recordInboundMessage({
  tenantId,
  conversationId,
  text,
  metaMessageId,
  createdAt,
}) {
  if (metaMessageId) {
    const dup = await db.query(
      'SELECT id FROM instagram_messages WHERE tenant_id = $1 AND meta_message_id = $2',
      [tenantId, metaMessageId],
    );
    if (dup.rows[0]) return { duplicate: true, id: dup.rows[0].id };
  }

  const result = await db.query(
    `INSERT INTO instagram_messages
       (tenant_id, conversation_id, direction, body, meta_message_id, message_type, delivery_status, created_at)
     VALUES ($1, $2, 'inbound', $3, $4, 'inbound', 'received', $5)
     RETURNING id`,
    [tenantId, conversationId, text, metaMessageId, createdAt || new Date()],
  );

  await db.query(
    `UPDATE instagram_conversations SET last_message_at = $2, updated_at = NOW() WHERE id = $1`,
    [conversationId, createdAt || new Date()],
  );

  return { duplicate: false, id: result.rows[0].id };
}

async function processInboundEvent(connection, event) {
  const pageToken = decrypt(connection.access_token_enc);
  if (!pageToken) {
    throw new Error('Missing page access token');
  }

  const profile = await fetchInstagramUserProfile(event.senderId, pageToken);
  const conversationId = await upsertConversation(connection.tenant_id, event.senderId, profile);

  const createdAt = event.timestamp ? new Date(event.timestamp) : new Date();
  return recordInboundMessage({
    tenantId: connection.tenant_id,
    conversationId,
    text: event.text,
    metaMessageId: event.messageId,
    createdAt,
  });
}

async function handleWebhook(body, { signature, rawBody } = {}) {
  if (process.env.META_APP_SECRET && !verifyWebhookSignature(rawBody, signature)) {
    throw Object.assign(new Error('Invalid webhook signature'), { statusCode: 403 });
  }

  const events = parseInstagramWebhook(body);
  if (events.length === 0) {
    return { processed: 0, skipped: 0 };
  }

  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    const connection = await getConnectionByInstagramAccountId(event.instagramAccountId);
    if (!connection) {
      skipped += 1;
      continue;
    }

    try {
      const result = await processInboundEvent(connection, event);
      if (result.duplicate) skipped += 1;
      else processed += 1;
    } catch (err) {
      console.error('[IG][WEBHOOK] Inbound processing failed:', err.message);
      await db.query(
        `UPDATE tenant_instagram_connections SET last_webhook_error = $2, updated_at = NOW() WHERE tenant_id = $1`,
        [connection.tenant_id, err.message],
      );
    }
  }

  return { processed, skipped };
}

async function getConversationById(tenantId, conversationId) {
  const result = await db.query(
    `SELECT * FROM instagram_conversations WHERE tenant_id = $1 AND id = $2`,
    [tenantId, conversationId],
  );
  return result.rows[0] || null;
}

async function listConversationRows(tenantId) {
  const result = await db.query(
    `SELECT c.*,
            (
              SELECT row_to_json(m)
              FROM (
                SELECT id, direction, body, message_type, created_at
                FROM instagram_messages
                WHERE conversation_id = c.id
                ORDER BY created_at DESC
                LIMIT 1
              ) m
            ) AS last_message
     FROM instagram_conversations c
     WHERE c.tenant_id = $1
     ORDER BY c.last_message_at DESC NULLS LAST, c.updated_at DESC`,
    [tenantId],
  );
  return result.rows;
}

async function getThreadMessages(tenantId, conversationId) {
  const result = await db.query(
    `SELECT id, direction, body, message_type, delivery_status, created_at
     FROM instagram_messages
     WHERE tenant_id = $1 AND conversation_id = $2
     ORDER BY created_at ASC`,
    [tenantId, conversationId],
  );
  return result.rows;
}

async function sendReply(tenantId, conversationId, text) {
  const connection = await getConnection(tenantId);
  if (!connection || !connection.access_token_enc) {
    throw Object.assign(new Error('Instagram is not connected'), { statusCode: 400, isOperational: true });
  }

  const conversation = await getConversationById(tenantId, conversationId);
  if (!conversation) {
    throw Object.assign(new Error('Conversation not found'), { statusCode: 404, isOperational: true });
  }

  const pageToken = decrypt(connection.access_token_enc);
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    throw Object.assign(new Error('Message body is required'), { statusCode: 400, isOperational: true });
  }

  let metaMessageId = null;
  let deliveryStatus = 'sent';

  try {
    const data = await graphFetch(`/${connection.page_id}/messages`, {
      method: 'POST',
      token: pageToken,
      body: {
        recipient: { id: conversation.instagram_user_id },
        message: { text: trimmed },
      },
    });
    metaMessageId = data.message_id || data.id || null;
  } catch (err) {
    deliveryStatus = 'failed';
    throw Object.assign(new Error(err.message || 'Failed to send Instagram message'), {
      statusCode: err.statusCode || 502,
      isOperational: true,
    });
  }

  const result = await db.query(
    `INSERT INTO instagram_messages
       (tenant_id, conversation_id, direction, body, meta_message_id, message_type, delivery_status)
     VALUES ($1, $2, 'outbound', $3, $4, 'manual', $5)
     RETURNING id, created_at`,
    [tenantId, conversationId, trimmed, metaMessageId, deliveryStatus],
  );

  await db.query(
    `UPDATE instagram_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [conversationId],
  );

  return {
    id: result.rows[0].id,
    direction: 'outbound',
    body: trimmed,
    messageType: 'manual',
    deliveryStatus,
    createdAt: result.rows[0].created_at,
  };
}

module.exports = {
  isConfigured,
  webhookVerifyToken,
  webhookUrl,
  appSettingsUrl,
  buildConnectUrl,
  handleOAuthCallback,
  getStatus,
  disconnect,
  handleWebhook,
  verifyWebhookSignature,
  listConversationRows,
  getConversationById,
  getThreadMessages,
  sendReply,
};
