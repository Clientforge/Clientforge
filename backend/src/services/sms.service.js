const db = require('../db/connection');
const config = require('../config');
const compliance = require('./compliance.service');
const { normalizePhone } = require('./lead.service');
const tenantPhoneService = require('./tenant-phone.service');
const smsProviderService = require('./sms-provider.service');
const trackedLinkService = require('./trackedLink.service');
const { resolveSmsDestination } = require('./automation-test-mode.service');

/**
 * New sender texts a configured keyword → contact, inbound log, welcome SMS (new contacts only).
 */
const trySmsKeywordOptIn = async ({
  tenantId,
  fromNorm,
  fromRaw,
  toRaw,
  body,
  twilioSid,
}) => {
  const tenantRes = await db.query(
    `SELECT id, name, phone_number, sms_provider, sms_keyword_opt_in_enabled,
            sms_keyword_opt_in_phrases, sms_keyword_welcome_message
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const t = tenantRes.rows[0];
  if (!t || !t.sms_keyword_opt_in_enabled) return null;

  let phrases = t.sms_keyword_opt_in_phrases;
  if (typeof phrases === 'string') {
    try {
      phrases = JSON.parse(phrases);
    } catch {
      phrases = [];
    }
  }
  if (!Array.isArray(phrases) || phrases.length === 0) return null;

  const welcomeTemplate = (t.sms_keyword_welcome_message || '').trim();
  if (!welcomeTemplate) return null;

  const normalized = (body || '').trim().toLowerCase();
  const firstToken = normalized.split(/\s+/).filter(Boolean)[0] || '';
  const phraseSet = phrases.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
  const matched = phraseSet.some((ph) => normalized === ph || firstToken === ph);
  if (!matched) return null;

  const ins = await db.query(
    `INSERT INTO contacts (tenant_id, phone, source, tags)
     VALUES ($1, $2, 'sms_keyword', $3::jsonb)
     ON CONFLICT (tenant_id, phone) DO NOTHING
     RETURNING id`,
    [tenantId, fromNorm, JSON.stringify(['sms-opt-in'])],
  );

  const isNew = ins.rows.length > 0;
  let contactId = ins.rows[0]?.id;
  if (!contactId) {
    const ex = await db.query(
      'SELECT id FROM contacts WHERE tenant_id = $1 AND phone = $2',
      [tenantId, fromNorm],
    );
    if (!ex.rows[0]) return null;
    contactId = ex.rows[0].id;
  }

  await db.query(
    `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
     VALUES ($1, NULL, $2, 'inbound', $3, $4, $5, $6, 'received', 'keyword_opt_in')`,
    [tenantId, contactId, body, fromRaw, toRaw, twilioSid || null],
  );
  await db.query('UPDATE contacts SET updated_at = NOW() WHERE id = $1', [contactId]);

  let welcomeSent = false;
  if (isNew) {
    const ok = await compliance.canSendToContact(contactId);
    if (ok) {
      const personalized = welcomeTemplate.replace(/\{businessName\}/gi, t.name || '');
      const fromNumber = tenantPhoneService.resolveEffectiveSmsFrom(t.phone_number, t.sms_provider).from;
      await sendSms({
        tenantId,
        leadId: null,
        contactId,
        to: fromRaw,
        from: fromNumber,
        body: personalized,
        messageType: 'keyword_welcome',
      });
      welcomeSent = true;
    }
  }

  return { contactId, welcomeSent };
};

/**
 * Send an SMS message — mock or live depending on SMS_MODE.
 *
 * Regardless of mode, every message is logged to the messages table.
 * In mock mode, the message is printed to console.
 * In live mode, it's sent via Twilio or Telnyx based on per-tenant sms_provider.
 */
const sendViaTelnyx = async (fromNumber, to, finalBody) => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.telnyx.apiKey}`,
    },
    body: JSON.stringify({
      from: fromNumber,
      to,
      text: finalBody,
      ...(config.telnyx.messagingProfileId && { messaging_profile_id: config.telnyx.messagingProfileId }),
      webhook_url: `${baseUrl}/api/v1/sms/status`,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.detail || data.message || 'Telnyx API error');
  }
  return { messageId: data.data?.id, deliveryStatus: data.data?.status || 'queued' };
};

const sendViaTwilio = async (fromNumber, to, finalBody) => {
  const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
  const message = await twilio.messages.create({
    body: finalBody,
    from: fromNumber,
    to,
    statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/sms/status`,
  });
  return { messageId: message.sid, deliveryStatus: message.status };
};

const sendSms = async ({
  tenantId,
  leadId,
  contactId,
  to,
  from,
  body,
  messageType,
  trackHttpLinks,
  campaignMessageId,
}) => {
  let finalBody = body;
  if (trackHttpLinks && contactId && body) {
    finalBody = await trackedLinkService.replaceHttpUrlsWithTracked(body, {
      tenantId,
      contactId,
      campaignMessageId: campaignMessageId ?? null,
    });
  }

  let tenantSmsProvider = null;
  if (tenantId) {
    const tenantRow = await db.query('SELECT sms_provider FROM tenants WHERE id = $1', [tenantId]);
    tenantSmsProvider = tenantRow.rows[0]?.sms_provider ?? null;
  }

  const effective = tenantPhoneService.resolveEffectiveSmsFrom(from, tenantSmsProvider);
  const fromNumber = effective.from;
  const provider = smsProviderService.resolveSmsProviderFromContext({
    tenantSmsProvider,
    fromNumber,
  });

  let destinationTo = to;
  if (tenantId && messageType !== 'manual') {
    const routed = await resolveSmsDestination(tenantId, {
      contactId,
      leadId,
      to,
      body: finalBody,
    });
    if (routed.skipped) {
      const blocked = await db.query(
        `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
         VALUES ($1, $2, $3, 'outbound', $4, $5, $6, NULL, 'blocked', $7)
         RETURNING *`,
        [tenantId, leadId ?? null, contactId ?? null, finalBody, fromNumber, to, messageType],
      );
      return blocked.rows[0];
    }
    destinationTo = routed.to;
    finalBody = routed.body;
    if (routed.testMode) {
      console.log(`[TEST-MODE] SMS rerouted from ${routed.intendedTo} → ${destinationTo}`);
    }
  }

  let messageId = null;
  let deliveryStatus = 'sent';

  if (config.sms.mode === 'live') {
    try {
      const result = provider === 'telnyx'
        ? await sendViaTelnyx(fromNumber, destinationTo, finalBody)
        : await sendViaTwilio(fromNumber, destinationTo, finalBody);
      messageId = result.messageId;
      deliveryStatus = result.deliveryStatus;
    } catch (err) {
      console.error(`[SMS][LIVE][${provider}] Failed to send to ${destinationTo}: ${err.message}`);
      deliveryStatus = 'failed';
    }
  } else {
    // Mock mode
    messageId = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n[SMS][MOCK] ─────────────────────────────────`);
    console.log(`  To:   ${destinationTo}`);
    console.log(`  From: ${fromNumber}`);
    console.log(`  Provider: ${provider}`);
    console.log(`  Body: ${finalBody}`);
    console.log(`[SMS][MOCK] ─────────────────────────────────\n`);
  }

  // Log to messages table regardless of mode (twilio_sid stores provider message id for both Twilio and Telnyx)
  const result = await db.query(
    `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
     VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [tenantId, leadId ?? null, contactId ?? null, finalBody, fromNumber, destinationTo, messageId, deliveryStatus, messageType],
  );

  return result.rows[0];
};

/**
 * Send the instant first SMS when a lead is created.
 * This is the Speed-to-Lead trigger.
 *
 * Updates the lead with: status → CONTACTED, first_contact_at, speed_to_lead_ms
 */
const sendInitialContact = async (tenantId, lead) => {
  // Get tenant for phone number
  const tenantResult = await db.query(
    'SELECT phone_number, name FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantResult.rows[0];

  const firstName = lead.firstName || 'there';
  const body = `Hi ${firstName}! Thanks for reaching out to ${tenant.name}. We got your info and would love to help. Are you available for a quick chat? Reply YES to get started.`;

  const message = await sendSms({
    tenantId,
    leadId: lead.id,
    to: lead.phone,
    from: tenant.phone_number,
    body,
    messageType: 'initial',
  });

  // Calculate speed-to-lead
  const now = new Date();
  const createdAt = new Date(lead.createdAt);
  const speedToLeadMs = now.getTime() - createdAt.getTime();

  // Update lead: NEW → CONTACTED
  await db.query(
    `UPDATE leads
     SET status = 'CONTACTED',
         first_contact_at = $1,
         speed_to_lead_ms = $2,
         last_activity_at = $1,
         updated_at = $1
     WHERE id = $3`,
    [now, speedToLeadMs, lead.id],
  );

  console.log(`[SPEED-TO-LEAD] Lead ${lead.id} contacted in ${speedToLeadMs}ms`);

  return { message, speedToLeadMs };
};

/**
 * Handle an inbound SMS from a lead or contact.
 * Looks up participant by phone (lead first, then contact), logs the message,
 * and returns the participant for further processing.
 */
const handleInbound = async ({ from, to, body, twilioSid }) => {
  if (!from) {
    console.warn('[SMS][INBOUND] Missing From');
    return null;
  }

  // Twilio may send E.164 or other shapes; DB stores normalizePhone() output for leads/contacts.
  const fromNorm = normalizePhone(from);

  // Match tenant by Twilio "To" (our number).
  let tenantId = await tenantPhoneService.findTenantIdByInboundSmsNumber(to);

  if (!tenantId) {
    // Fallback: find by phone across leads or contacts
    const leadLookup = await db.query(
      'SELECT tenant_id FROM leads WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [fromNorm],
    );
    if (leadLookup.rows.length > 0) {
      tenantId = leadLookup.rows[0].tenant_id;
    } else {
      const contactLookup = await db.query(
        'SELECT tenant_id FROM contacts WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
        [fromNorm],
      );
      if (contactLookup.rows.length === 0) {
        console.warn(`[SMS][INBOUND] No lead or contact found for phone ${from} (normalized ${fromNorm})`);
        return null;
      }
      tenantId = contactLookup.rows[0].tenant_id;
    }
  }

  const [leadResult, contactResult] = await Promise.all([
    db.query('SELECT * FROM leads WHERE tenant_id = $1 AND phone = $2', [tenantId, fromNorm]),
    db.query('SELECT * FROM contacts WHERE tenant_id = $1 AND phone = $2', [tenantId, fromNorm]),
  ]);

  const lead = leadResult.rows[0];
  const contact = contactResult.rows[0];

  // Same phone as lead + contact: store both IDs so lead and contact conversation UIs show the reply.
  if (lead && contact) {
    await db.query(
      `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
       VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, 'received', 'reply')`,
      [tenantId, lead.id, contact.id, body, from, to, twilioSid || null],
    );
    await db.query(
      'UPDATE leads SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [lead.id],
    );
    await db.query('UPDATE contacts SET updated_at = NOW() WHERE id = $1', [contact.id]);
    return { tenantId, participantType: 'lead', lead, contact, messageBody: body };
  }

  if (lead) {
    await db.query(
      `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
       VALUES ($1, $2, NULL, 'inbound', $3, $4, $5, $6, 'received', 'reply')`,
      [tenantId, lead.id, body, from, to, twilioSid || null],
    );
    await db.query(
      'UPDATE leads SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
      [lead.id],
    );
    return { tenantId, participantType: 'lead', lead, contact: null, messageBody: body };
  }

  if (contact) {
    await db.query(
      `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
       VALUES ($1, NULL, $2, 'inbound', $3, $4, $5, $6, 'received', 'reply')`,
      [tenantId, contact.id, body, from, to, twilioSid || null],
    );
    await db.query('UPDATE contacts SET updated_at = NOW() WHERE id = $1', [contact.id]);
    return { tenantId, participantType: 'contact', lead: null, contact, messageBody: body };
  }

  const keywordResult = await trySmsKeywordOptIn({
    tenantId,
    fromNorm,
    fromRaw: from,
    toRaw: to,
    body,
    twilioSid,
  });
  if (keywordResult) {
    const contactRow = await db.query('SELECT * FROM contacts WHERE id = $1', [keywordResult.contactId]);
    const contact = contactRow.rows[0];
    return {
      tenantId,
      participantType: 'contact',
      lead: null,
      contact,
      messageBody: body,
      keywordWelcomeSent: keywordResult.welcomeSent,
    };
  }

  console.warn(`[SMS][INBOUND] No lead or contact found for tenant ${tenantId}, phone ${from} (normalized ${fromNorm})`);
  return null;
};

module.exports = {
  sendSms,
  sendInitialContact,
  handleInbound,
};
