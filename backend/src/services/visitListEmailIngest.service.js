const db = require('../db/connection');
const { inboxEmail } = require('./bookingEmailIngest.service');
const { parseVisitListCsv } = require('./visitListCsv.parse');
const { processVisitListRow } = require('./visit-list-checkout.service');
const {
  isVisitListEmailEnabled,
  isSenderAllowed,
} = require('../config/visitListEmail');

async function isDuplicateVisitListMessage(messageId) {
  const r = await db.query(
    'SELECT id FROM visit_list_email_messages WHERE message_id = $1',
    [messageId],
  );
  return r.rows.length > 0;
}

async function insertVisitListMessage({
  messageId,
  fromAddress,
  subject,
  receivedAt,
  parseStatus,
  tenantId,
  stats,
  errorMessage,
}) {
  const result = await db.query(
    `INSERT INTO visit_list_email_messages
      (message_id, inbox_email, from_address, subject, received_at, tenant_id, parse_status, stats, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING id`,
    [
      messageId,
      inboxEmail(),
      fromAddress || null,
      subject || null,
      receivedAt || new Date(),
      tenantId || null,
      parseStatus,
      stats ? JSON.stringify(stats) : null,
      errorMessage || null,
    ],
  );
  return result.rows[0]?.id || null;
}

async function resolveVisitListTenantId() {
  const enabled = await db.query(
    `SELECT id, timezone, visit_list_email_automations
     FROM tenants
     WHERE active = true AND visit_list_email_automations = true
     ORDER BY name ASC`,
  );
  if (enabled.rows.length === 1) {
    return { tenantId: enabled.rows[0].id, timezone: enabled.rows[0].timezone };
  }
  if (enabled.rows.length > 1) {
    const envId = (process.env.BAY_AREA_HEART_TENANT_ID || '').trim();
    if (envId) {
      const match = enabled.rows.find((r) => r.id === envId);
      if (match) return { tenantId: match.id, timezone: match.timezone };
    }
    return { tenantId: null, reason: 'ambiguous_tenant' };
  }

  const envId = (process.env.BAY_AREA_HEART_TENANT_ID || '').trim();
  if (envId) {
    const byEnv = await db.query(
      `SELECT id, timezone FROM tenants WHERE id = $1 AND active = true LIMIT 1`,
      [envId],
    );
    if (byEnv.rows[0]) {
      return { tenantId: byEnv.rows[0].id, timezone: byEnv.rows[0].timezone };
    }
  }

  return { tenantId: null, reason: 'no_tenant' };
}

function pickCsvAttachment(attachments = []) {
  for (const att of attachments) {
    const name = String(att.filename || att.name || '').toLowerCase();
    const contentType = String(att.contentType || att.type || '').toLowerCase();
    if (name.endsWith('.csv') || contentType.includes('csv')) {
      return att;
    }
  }
  return null;
}

function attachmentToBuffer(att) {
  if (!att) return null;
  if (Buffer.isBuffer(att.content)) return att.content;
  if (typeof att.content === 'string') {
    if (att.encoding === 'base64') return Buffer.from(att.content, 'base64');
    return Buffer.from(att.content, 'utf-8');
  }
  return null;
}

function hasCsvAttachment(attachments = []) {
  return Boolean(pickCsvAttachment(attachments));
}

/**
 * @param {{ messageId: string, fromAddress?: string, subject?: string, receivedAt?: Date, attachments?: Array }} email
 */
async function processVisitListEmail(email) {
  if (!isVisitListEmailEnabled()) {
    return { ok: false, skipped: true, reason: 'visit_list_disabled' };
  }

  const messageId = String(email.messageId || '').trim();
  if (!messageId) {
    throw Object.assign(new Error('messageId is required'), { statusCode: 400 });
  }

  if (await isDuplicateVisitListMessage(messageId)) {
    return { ok: true, duplicate: true, messageId };
  }

  if (!isSenderAllowed(email.fromAddress)) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'rejected',
      errorMessage: 'Sender not on VISIT_LIST_EMAIL_ALLOWED_FROM allowlist',
    });
    return { ok: false, messageId, parseStatus: 'rejected', reason: 'sender_not_allowed' };
  }

  const csvAtt = pickCsvAttachment(email.attachments || []);
  const csvBuffer = attachmentToBuffer(csvAtt);
  if (!csvBuffer || csvBuffer.length === 0) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      errorMessage: 'No CSV attachment found',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'missing_csv' };
  }

  const route = await resolveVisitListTenantId();
  if (!route.tenantId) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      errorMessage: route.reason || 'no_tenant',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: route.reason };
  }

  const tenantCheck = await db.query(
    'SELECT visit_list_email_automations FROM tenants WHERE id = $1',
    [route.tenantId],
  );
  if (!tenantCheck.rows[0]?.visit_list_email_automations) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      tenantId: route.tenantId,
      errorMessage: 'visit_list_email_automations off for tenant',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'tenant_automations_off' };
  }

  let rows;
  try {
    rows = parseVisitListCsv(csvBuffer);
  } catch (err) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      tenantId: route.tenantId,
      errorMessage: err.message || 'CSV parse error',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'csv_parse_error' };
  }

  if (rows.length === 0) {
    await insertVisitListMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      tenantId: route.tenantId,
      errorMessage: 'No valid rows (need phone + visit_date)',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'empty_csv' };
  }

  const timezone = route.timezone || 'America/Los_Angeles';
  const stats = {
    rowCount: rows.length,
    processed: 0,
    duplicates: 0,
    skipped: 0,
    jobsScheduled: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const result = await processVisitListRow(route.tenantId, row, { timezone });
      if (result.duplicate) stats.duplicates += 1;
      else if (result.skipped) stats.skipped += 1;
      else {
        stats.processed += 1;
        stats.jobsScheduled += result.jobsScheduled || 0;
      }
    } catch (err) {
      stats.errors.push({ phone: row.phone, visitDate: row.visitDate, message: err.message });
    }
  }

  await insertVisitListMessage({
    messageId,
    fromAddress: email.fromAddress,
    subject: email.subject,
    receivedAt: email.receivedAt,
    parseStatus: 'processed',
    tenantId: route.tenantId,
    stats,
  });

  return {
    ok: true,
    messageId,
    parseStatus: 'processed',
    tenantId: route.tenantId,
    stats,
  };
}

module.exports = {
  processVisitListEmail,
  hasCsvAttachment,
  pickCsvAttachment,
  attachmentToBuffer,
};
