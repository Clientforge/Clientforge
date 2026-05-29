const db = require('../db/connection');
const { parseBookingEmail, normalizeBusinessName } = require('./bookingEmailParse.service');
const { normalizeEmailBooking } = require('../adapters/emailBooking.adapter');
const appointmentService = require('./appointment.service');
const appointmentWorkflowService = require('./appointment-workflow.service');

const DEFAULT_INBOX = 'info@clientforge-ai.com';
const MIN_AUTO_CONFIDENCE = Number(process.env.BOOKING_EMAIL_MIN_CONFIDENCE || 0.55);

function inboxEmail() {
  return (process.env.BOOKING_INBOX_EMAIL || DEFAULT_INBOX).trim().toLowerCase();
}

async function isDuplicateMessage(messageId) {
  const r = await db.query('SELECT id FROM booking_email_messages WHERE message_id = $1', [messageId]);
  return r.rows.length > 0;
}

async function insertRawMessage({
  messageId,
  fromAddress,
  subject,
  bodyText,
  bodyHtml,
  receivedAt,
  parseStatus,
  tenantId,
  parsed,
  appointmentId,
  errorMessage,
}) {
  const result = await db.query(
    `INSERT INTO booking_email_messages
      (message_id, inbox_email, from_address, subject, body_text, body_html, received_at,
       parse_status, tenant_id, parsed, appointment_id, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (message_id) DO NOTHING
     RETURNING id`,
    [
      messageId,
      inboxEmail(),
      fromAddress || null,
      subject || null,
      bodyText || null,
      bodyHtml || null,
      receivedAt || new Date(),
      parseStatus,
      tenantId || null,
      parsed ? JSON.stringify(parsed) : null,
      appointmentId || null,
      errorMessage || null,
    ],
  );
  return result.rows[0]?.id || null;
}

async function updateMessageStatus(messageId, patch) {
  await db.query(
    `UPDATE booking_email_messages SET
       parse_status = COALESCE($2, parse_status),
       tenant_id = COALESCE($3, tenant_id),
       parsed = COALESCE($4::jsonb, parsed),
       appointment_id = COALESCE($5, appointment_id),
       error_message = COALESCE($6, error_message)
     WHERE message_id = $1`,
    [
      messageId,
      patch.parseStatus || null,
      patch.tenantId || null,
      patch.parsed ? JSON.stringify(patch.parsed) : null,
      patch.appointmentId || null,
      patch.errorMessage || null,
    ],
  );
}

async function loadTenantRoutingIndex() {
  const [tenants, aliases] = await Promise.all([
    db.query('SELECT id, name, timezone, active FROM tenants WHERE active = true'),
    db.query(
      `SELECT tenant_id, alias, match_type, priority
       FROM tenant_booking_email_aliases
       WHERE active = true
       ORDER BY priority DESC, alias ASC`,
    ),
  ]);

  const tenantById = new Map();
  for (const t of tenants.rows) {
    tenantById.set(t.id, t);
  }

  const aliasRows = [
    ...aliases.rows,
    ...tenants.rows.map((t) => ({
      tenant_id: t.id,
      alias: normalizeBusinessName(t.name),
      match_type: 'contains',
      priority: 0,
    })),
  ].filter((r) => r.alias);

  return { tenantById, aliasRows };
}

function scoreAliasMatch(businessNorm, aliasRow) {
  const aliasNorm = normalizeBusinessName(aliasRow.alias);
  if (!businessNorm || !aliasNorm) return 0;
  if (aliasRow.match_type === 'exact') {
    return businessNorm === aliasNorm ? 100 + aliasRow.priority : 0;
  }
  if (businessNorm.includes(aliasNorm) || aliasNorm.includes(businessNorm)) {
    return 50 + aliasRow.priority + Math.min(aliasNorm.length, businessNorm.length);
  }
  return 0;
}

async function resolveTenantId(businessName) {
  const businessNorm = normalizeBusinessName(businessName);
  if (!businessNorm) return { tenantId: null, reason: 'missing_business_name' };

  const { tenantById, aliasRows } = await loadTenantRoutingIndex();
  const scored = [];

  for (const row of aliasRows) {
    const score = scoreAliasMatch(businessNorm, row);
    if (score > 0) scored.push({ tenantId: row.tenant_id, score });
  }

  if (scored.length === 0) return { tenantId: null, reason: 'unroutable' };

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  const second = scored[1];
  if (second && second.score === top.score) {
    return { tenantId: null, reason: 'ambiguous', candidates: scored.slice(0, 3) };
  }

  if (!tenantById.has(top.tenantId)) return { tenantId: null, reason: 'unroutable' };
  return { tenantId: top.tenantId, reason: 'matched' };
}

/**
 * Process one inbound booking email (from IMAP, webhook, or test POST).
 * @param {{ messageId: string, fromAddress?: string, subject?: string, bodyText?: string, bodyHtml?: string, receivedAt?: Date }} email
 */
async function processInboundBookingEmail(email) {
  const messageId = String(email.messageId || '').trim();
  if (!messageId) {
    throw Object.assign(new Error('messageId is required'), { statusCode: 400 });
  }

  if (await isDuplicateMessage(messageId)) {
    return { ok: true, duplicate: true, messageId };
  }

  const parsed = parseBookingEmail(email);
  const normalized = normalizeEmailBooking({
    parsed,
    messageId,
    rawEmail: email,
  });

  if (!normalized.appointment.scheduledAt) {
    await insertRawMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      parsed,
      errorMessage: 'Could not parse appointment date/time from email.',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'missing_datetime' };
  }

  const route = await resolveTenantId(normalized.businessName);
  if (!route.tenantId) {
    await insertRawMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.receivedAt,
      parseStatus: route.reason === 'ambiguous' ? 'ambiguous' : 'unroutable',
      parsed: { ...parsed, routing: route },
      errorMessage: route.reason,
    });
    return { ok: false, messageId, parseStatus: route.reason, parsed };
  }

  if (normalized.confidence < MIN_AUTO_CONFIDENCE) {
    await insertRawMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.receivedAt,
      parseStatus: 'needs_review',
      tenantId: route.tenantId,
      parsed,
      errorMessage: `Low parse confidence (${normalized.confidence.toFixed(2)})`,
    });
    return { ok: false, messageId, parseStatus: 'needs_review', tenantId: route.tenantId };
  }

  if (!normalized.contact.phone && !normalized.contact.email) {
    await insertRawMessage({
      messageId,
      fromAddress: email.fromAddress,
      subject: email.subject,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      receivedAt: email.receivedAt,
      parseStatus: 'failed',
      tenantId: route.tenantId,
      parsed,
      errorMessage: 'No customer phone or email found in message.',
    });
    return { ok: false, messageId, parseStatus: 'failed', reason: 'missing_contact' };
  }

  const tenantRow = await db.query('SELECT timezone FROM tenants WHERE id = $1', [route.tenantId]);
  if (tenantRow.rows[0]?.timezone && !parsed.timezone) {
    normalized.appointment.timezone = tenantRow.rows[0].timezone;
  }

  const result = await appointmentService.processBookingEvent(route.tenantId, {
    eventType: normalized.eventType,
    contact: normalized.contact,
    appointment: normalized.appointment,
    contactSource: normalized.appointment.provider,
  });

  await appointmentWorkflowService.dispatchWorkflows(route.tenantId, result);

  await insertRawMessage({
    messageId,
    fromAddress: email.fromAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    receivedAt: email.receivedAt,
    parseStatus: 'parsed',
    tenantId: route.tenantId,
    parsed,
    appointmentId: result.appointmentId,
  });

  return {
    ok: true,
    messageId,
    parseStatus: 'parsed',
    tenantId: route.tenantId,
    appointmentId: result.appointmentId,
    contactId: result.contactId,
    eventType: result.eventType,
    parsedEventType: normalized.eventType,
  };
}

module.exports = {
  processInboundBookingEmail,
  resolveTenantId,
  inboxEmail,
  MIN_AUTO_CONFIDENCE,
};
