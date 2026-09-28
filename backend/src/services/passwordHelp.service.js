const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/connection');
const { sendEmail, sendPasswordHelpNotifyEmail, sendTemporaryPasswordEmail } = require('./email.service');

const SALT_ROUNDS = 12;
const STATUSES = new Set(['pending', 'resolved', 'dismissed']);

function appBaseUrl() {
  const base = process.env.APP_URL || process.env.PUBLIC_APP_BASE_URL || 'https://app.clientforge-ai.com';
  return base.replace(/\/$/, '');
}

function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(14);
  let out = '';
  for (let i = 0; i < 14; i += 1) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findActiveUserByEmail(email) {
  const result = await db.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.active,
            t.id AS tenant_id, t.name AS tenant_name, t.active AS tenant_active
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1`,
    [email],
  );
  const row = result.rows[0];
  if (!row || !row.active || !row.tenant_active) return null;
  return row;
}

async function notifySuperAdmins(requestRow) {
  const notifyEmail = process.env.PASSWORD_HELP_NOTIFY_EMAIL?.trim();
  const recipients = [];

  if (notifyEmail) {
    recipients.push(notifyEmail);
  } else {
    const admins = await db.query(
      `SELECT email FROM users WHERE role = 'superadmin' AND active = true`,
    );
    for (const r of admins.rows) {
      if (r.email) recipients.push(r.email);
    }
  }

  if (recipients.length === 0) {
    console.warn('[password-help] No PASSWORD_HELP_NOTIFY_EMAIL or superadmin emails — skipping notify');
    return;
  }

  const queueUrl = `${appBaseUrl()}/admin/password-requests`;
  const matched = requestRow.user_id
    ? `${requestRow.tenant_name || 'Tenant'} — ${requestRow.user_email || requestRow.email}`
    : 'No matching active account';

  for (const to of recipients) {
    await sendPasswordHelpNotifyEmail({
      toEmail: to,
      requestEmail: requestRow.email,
      message: requestRow.message,
      matchedSummary: matched,
      queueUrl,
    }).catch((err) => console.error('[password-help] notify failed:', err.message));
  }
}

/**
 * Public: user asks for password help (no self-serve reset).
 */
async function submitPasswordHelpRequest({ email, message }) {
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes('@')) {
    throw Object.assign(new Error('Enter a valid email address.'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const msg = message != null ? String(message).trim().slice(0, 500) : null;
  const user = await findActiveUserByEmail(normalized);

  const insert = await db.query(
    `INSERT INTO password_help_requests (email, user_id, tenant_id, message, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, email, user_id, tenant_id, message, created_at`,
    [normalized, user?.id ?? null, user?.tenant_id ?? null, msg || null],
  );

  const row = insert.rows[0];
  const notifyPayload = {
    ...row,
    user_email: user?.email,
    tenant_name: user?.tenant_name,
  };

  notifySuperAdmins(notifyPayload).catch((err) => {
    console.error('[password-help] async notify error:', err.message);
  });

  return { ok: true };
}

function formatRequestRow(row) {
  return {
    id: row.id,
    email: row.email,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    userId: row.user_id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    userFirstName: row.first_name,
    userLastName: row.last_name,
    userEmail: row.user_email,
  };
}

async function listPasswordHelpRequests({ status = 'pending', page = 1, limit = 30 }) {
  const safeStatus = STATUSES.has(status) ? status : 'pending';
  const offset = (page - 1) * limit;

  const [countRes, dataRes] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS n FROM password_help_requests WHERE status = $1`,
      [safeStatus],
    ),
    db.query(
      `SELECT r.*, t.name AS tenant_name, u.email AS user_email, u.first_name, u.last_name
       FROM password_help_requests r
       LEFT JOIN tenants t ON t.id = r.tenant_id
       LEFT JOIN users u ON u.id = r.user_id
       WHERE r.status = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [safeStatus, limit, offset],
    ),
  ]);

  return {
    requests: dataRes.rows.map(formatRequestRow),
    pagination: {
      page,
      limit,
      total: countRes.rows[0].n,
      totalPages: Math.ceil(countRes.rows[0].n / limit) || 0,
    },
  };
}

async function countPendingPasswordHelpRequests() {
  const result = await db.query(
    `SELECT COUNT(*)::int AS n FROM password_help_requests WHERE status = 'pending'`,
  );
  return result.rows[0].n;
}

async function updatePasswordHelpRequestStatus(requestId, superadminUserId, status) {
  if (!STATUSES.has(status) || status === 'pending') {
    throw Object.assign(new Error('Invalid status'), { statusCode: 400, isOperational: true });
  }

  const result = await db.query(
    `UPDATE password_help_requests
     SET status = $1,
         resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END,
         resolved_by = $2
     WHERE id = $3 AND status = 'pending'
     RETURNING id`,
    [status, superadminUserId, requestId],
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Request not found or already handled'), {
      statusCode: 404,
      isOperational: true,
    });
  }

  return { ok: true };
}

async function resolvePendingRequestsForUser(userId, superadminUserId) {
  await db.query(
    `UPDATE password_help_requests
     SET status = 'resolved', resolved_at = NOW(), resolved_by = $2
     WHERE user_id = $1 AND status = 'pending'`,
    [userId, superadminUserId],
  );
}

/**
 * Superadmin: set new password and optionally email the user.
 */
async function resetUserPasswordByAdmin(userId, superadminUserId, { password, sendEmail: shouldSendEmail = true }) {
  const userRes = await db.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.active, t.name AS tenant_name, t.active AS tenant_active
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [userId],
  );

  if (userRes.rows.length === 0) {
    throw Object.assign(new Error('User not found'), { statusCode: 404, isOperational: true });
  }

  const user = userRes.rows[0];
  if (!user.active || !user.tenant_active) {
    throw Object.assign(new Error('User or organization is inactive'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  let plainPassword = password != null ? String(password).trim() : '';
  if (!plainPassword) {
    plainPassword = generateTemporaryPassword();
  }
  if (plainPassword.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const passwordHash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

  await resolvePendingRequestsForUser(userId, superadminUserId);

  let emailSent = false;
  if (shouldSendEmail) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there';
    const result = await sendTemporaryPasswordEmail({
      toEmail: user.email,
      recipientName: name,
      tenantName: user.tenant_name,
      temporaryPassword: plainPassword,
      loginUrl: `${appBaseUrl()}/login`,
    });
    emailSent = result.status === 'sent';
  }

  return {
    ok: true,
    emailSent,
    userId: user.id,
    email: user.email,
    /** Only returned once so admin can copy if email failed */
    temporaryPassword: shouldSendEmail && !emailSent ? plainPassword : undefined,
  };
}

module.exports = {
  submitPasswordHelpRequest,
  listPasswordHelpRequests,
  countPendingPasswordHelpRequests,
  updatePasswordHelpRequestStatus,
  resetUserPasswordByAdmin,
};
