const crypto = require('crypto');
const db = require('../db/connection');

function getPublicBaseUrl() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return base.replace(/\/$/, '');
}

function isAllowedDestination(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Create a tracked link row and return the token (opaque public id).
 */
async function createTrackedLink({
  tenantId,
  contactId,
  destinationUrl,
  campaignMessageId,
  metadata,
  expiresAt,
}) {
  if (!isAllowedDestination(destinationUrl)) {
    throw new Error('destinationUrl must be http(s)');
  }

  let token;
  for (let i = 0; i < 5; i += 1) {
    token = crypto.randomBytes(18).toString('base64url');
    const clash = await db.query('SELECT 1 FROM tracked_links WHERE token = $1', [token]);
    if (clash.rows.length === 0) break;
    token = null;
  }
  if (!token) {
    throw new Error('Could not generate unique token');
  }

  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const result = await db.query(
    `INSERT INTO tracked_links (tenant_id, token, destination_url, contact_id, campaign_message_id, metadata, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING id, token`,
    [
      tenantId,
      token,
      destinationUrl,
      contactId ?? null,
      campaignMessageId ?? null,
      JSON.stringify(meta),
      expiresAt ?? null,
    ],
  );

  return result.rows[0];
}

function publicUrlForToken(token) {
  return `${getPublicBaseUrl()}/r/${token}`;
}

/**
 * Replace each http(s) URL in body with a distinct tracked /r/:token URL.
 * No-op if contactId is missing (cannot attribute clicks).
 */
async function replaceHttpUrlsWithTracked(body, {
  tenantId,
  contactId,
  campaignMessageId,
}) {
  if (!body || !contactId) return body;

  const re = /https?:\/\/[^\s<>)]+/gi;
  const matches = [...body.matchAll(re)];
  if (matches.length === 0) return body;

  let out = body;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const m = matches[i];
    const dest = m[0];
    if (!isAllowedDestination(dest)) continue;
    try {
      const row = await createTrackedLink({
        tenantId,
        contactId,
        destinationUrl: dest,
        campaignMessageId,
        metadata: { source: 'sms_body_rewrite' },
      });
      const pub = publicUrlForToken(row.token);
      out = out.slice(0, m.index) + pub + out.slice(m.index + dest.length);
    } catch (err) {
      console.error('[TRACKED-LINK] create failed for URL in body:', err.message);
    }
  }
  return out;
}

function hashIp(ip) {
  const salt = process.env.LINK_TRACK_IP_SALT;
  if (!salt || !ip) return null;
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

async function handleRedirect(req, res, next) {
  try {
    const { token } = req.params;
    if (!token || token.length > 64) {
      return res.status(404).type('text/plain').send('Link not found');
    }

    const result = await db.query(
      `SELECT id, destination_url, expires_at FROM tracked_links WHERE token = $1`,
      [token],
    );
    const link = result.rows[0];
    if (!link) {
      return res.status(404).type('text/plain').send('Link not found');
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).type('text/plain').send('This link has expired');
    }

    const ua = (req.get('user-agent') || '').slice(0, 512);
    const ipHash = hashIp(req.ip);
    try {
      await db.query(
        `INSERT INTO link_clicks (tracked_link_id, user_agent, ip_hash)
         VALUES ($1, $2, $3)`,
        [link.id, ua || null, ipHash],
      );
    } catch (err) {
      console.error('[TRACKED-LINK] click insert failed:', err.message);
    }

    return res.redirect(302, link.destination_url);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createTrackedLink,
  publicUrlForToken,
  replaceHttpUrlsWithTracked,
  handleRedirect,
  getPublicBaseUrl,
};
