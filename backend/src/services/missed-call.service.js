const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const tenantPhoneService = require('./tenant-phone.service');

const DEFAULT_MISSED_CALL_MESSAGE = "Sorry we missed your call! How can we help? Reply to this message.";
const DEDUP_WINDOW_MINUTES = 30;

/**
 * Upsert contact by phone for missed-call. Creates if not exists.
 */
const upsertContactByPhone = async (tenantId, phone) => {
  const normalized = normalizePhone(phone);

  const result = await db.query(
    `INSERT INTO contacts (tenant_id, first_name, last_name, phone, email, source)
     VALUES ($1, NULL, NULL, $2, NULL, 'missed_call')
     ON CONFLICT (tenant_id, phone) DO UPDATE SET updated_at = NOW()
     RETURNING id, unsubscribed`,
    [tenantId, normalized],
  );

  return result.rows[0];
};

/**
 * Check if we sent a missed-call follow-up to this contact in the last N minutes.
 */
const wasRecentlySent = async (tenantId, callerPhone) => {
  const result = await db.query(
    `SELECT 1 FROM messages
     WHERE tenant_id = $1 AND to_number = $2 AND message_type = 'missed_call_followup'
       AND created_at > NOW() - INTERVAL '1 minute' * $3
     LIMIT 1`,
    [tenantId, normalizePhone(callerPhone), DEDUP_WINDOW_MINUTES],
  );

  return result.rows.length > 0;
};

/**
 * Process an inbound voice call (forwarded missed call).
 * 1. Find tenant by To (Twilio number)
 * 2. Upsert contact
 * 3. Log missed call
 * 4. Send SMS if allowed (opt-out, dedup)
 */
const processMissedCall = async ({ from, to, callSid }) => {
  const callerPhone = normalizePhone(from);
  const twilioTo = to ? normalizePhone(to) : null;

  if (!callerPhone || !twilioTo) {
    console.warn('[MISSED-CALL] Missing From or To');
    return { action: 'skipped', reason: 'missing_params' };
  }

  // Find tenant by the Twilio number that received the call
  const tenantId = await tenantPhoneService.findTenantIdByInboundSmsNumber(twilioTo);
  if (!tenantId) {
    console.warn(`[MISSED-CALL] No tenant found for number ${twilioTo}`);
    return { action: 'skipped', reason: 'tenant_not_found' };
  }

  const tenantResult = await db.query(
    'SELECT id, name, phone_number, followup_config FROM tenants WHERE id = $1 AND active = true',
    [tenantId],
  );
  if (tenantResult.rows.length === 0) {
    console.warn(`[MISSED-CALL] Tenant ${tenantId} not active`);
    return { action: 'skipped', reason: 'tenant_not_found' };
  }

  const tenant = tenantResult.rows[0];

  // Upsert contact
  const contact = await upsertContactByPhone(tenantId, callerPhone);

  if (contact.unsubscribed) {
    await db.query(
      `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
    );
    return { action: 'skipped', reason: 'opt_out', contactId: contact.id };
  }

  // Deduplication
  const recentlySent = await wasRecentlySent(tenantId, callerPhone);
  if (recentlySent) {
    await db.query(
      `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
    );
    return { action: 'skipped', reason: 'dedup', contactId: contact.id };
  }

  // Double-check compliance
  const canSend = await compliance.canSendToContact(contact.id);
  if (!canSend) {
    await db.query(
      `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
    );
    return { action: 'skipped', reason: 'opt_out', contactId: contact.id };
  }

  const config = tenant.followup_config || {};
  if (config.missed_call_text_back_enabled === false) {
    await db.query(
      `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
    );
    return { action: 'skipped', reason: 'feature_disabled', contactId: contact.id };
  }

  // Get message template (from followup_config or default)
  const messageBody = (config.missed_call_message || '').trim() || DEFAULT_MISSED_CALL_MESSAGE;

  // Send SMS
  try {
    await smsService.sendSms({
      tenantId,
      leadId: null,
      contactId: contact.id,
      to: callerPhone,
      from: tenantPhoneService.resolveEffectiveSmsFrom(tenant.phone_number).from,
      body: messageBody,
      messageType: 'missed_call_followup',
    });
  } catch (err) {
    console.error(`[MISSED-CALL] SMS failed for ${callerPhone}:`, err.message);
    await db.query(
      `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
    );
    return { action: 'error', reason: err.message, contactId: contact.id };
  }

  // Log missed call with sms_sent_at
  await db.query(
    `INSERT INTO missed_calls (tenant_id, contact_id, caller_phone, twilio_call_sid, twilio_to_number, sms_sent_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [tenantId, contact.id, callerPhone, callSid || null, twilioTo],
  );

  return { action: 'sms_sent', contactId: contact.id };
};

module.exports = {
  processMissedCall,
  upsertContactByPhone,
};
