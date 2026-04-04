const db = require('../db/connection');
const config = require('../config');
const { normalizePhone } = require('./lead.service');
const trackedLinkService = require('./trackedLink.service');

/**
 * Send an SMS message — mock or live depending on SMS_MODE.
 *
 * Regardless of mode, every message is logged to the messages table.
 * In mock mode, the message is printed to console.
 * In live mode, it's sent via Twilio or Telnyx (SMS_PROVIDER).
 */
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

  const provider = config.sms.provider || 'twilio';
  const fromNumber = from || (provider === 'telnyx' ? config.telnyx.defaultFrom : config.twilio.defaultFrom);
  let messageId = null;
  let deliveryStatus = 'sent';

  if (config.sms.mode === 'live') {
    try {
      if (provider === 'telnyx') {
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
        messageId = data.data?.id;
        deliveryStatus = data.data?.status || 'queued';
      } else {
        const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
        const message = await twilio.messages.create({
          body: finalBody,
          from: fromNumber,
          to,
          statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/sms/status`,
        });
        messageId = message.sid;
        deliveryStatus = message.status;
      }
    } catch (err) {
      console.error(`[SMS][LIVE] Failed to send to ${to}: ${err.message}`);
      deliveryStatus = 'failed';
    }
  } else {
    // Mock mode
    messageId = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n[SMS][MOCK] ─────────────────────────────────`);
    console.log(`  To:   ${to}`);
    console.log(`  From: ${fromNumber}`);
    console.log(`  Type: ${messageType}`);
    console.log(`  Body: ${finalBody}`);
    console.log(`[SMS][MOCK] ─────────────────────────────────\n`);
  }

  // Log to messages table regardless of mode (twilio_sid stores provider message id for both Twilio and Telnyx)
  const result = await db.query(
    `INSERT INTO messages (tenant_id, lead_id, contact_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
     VALUES ($1, $2, $3, 'outbound', $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [tenantId, leadId ?? null, contactId ?? null, finalBody, fromNumber, to, messageId, deliveryStatus, messageType],
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
    from: tenant.phone_number || (config.sms.provider === 'telnyx' ? config.telnyx.defaultFrom : config.twilio.defaultFrom),
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
  const toNorm = to ? normalizePhone(to) : null;

  // Match tenant by Twilio "To" (our number) — raw or normalized.
  const tenantResult = await db.query(
    'SELECT id FROM tenants WHERE phone_number = $1 OR ($2::text IS NOT NULL AND phone_number = $2)',
    [to, toNorm],
  );

  let tenantId;

  if (tenantResult.rows.length > 0) {
    tenantId = tenantResult.rows[0].id;
  } else {
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

  console.warn(`[SMS][INBOUND] No lead or contact found for tenant ${tenantId}, phone ${from} (normalized ${fromNorm})`);
  return null;
};

module.exports = {
  sendSms,
  sendInitialContact,
  handleInbound,
};
