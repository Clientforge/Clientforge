const db = require('../db/connection');
const config = require('../config');

/**
 * Send an SMS message — mock or live depending on SMS_MODE.
 *
 * Regardless of mode, every message is logged to the messages table.
 * In mock mode, the message is printed to console.
 * In live mode, it's sent via Twilio.
 */
const sendSms = async ({ tenantId, leadId, to, from, body, messageType }) => {
  const fromNumber = from || config.twilio.defaultFrom;
  let twilioSid = null;
  let deliveryStatus = 'sent';

  if (config.sms.mode === 'live') {
    try {
      const twilio = require('twilio')(config.twilio.accountSid, config.twilio.authToken);
      const message = await twilio.messages.create({
        body,
        from: fromNumber,
        to,
        statusCallback: `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/sms/status`,
      });
      twilioSid = message.sid;
      deliveryStatus = message.status;
    } catch (err) {
      console.error(`[SMS][LIVE] Failed to send to ${to}: ${err.message}`);
      deliveryStatus = 'failed';
    }
  } else {
    // Mock mode
    twilioSid = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log(`\n[SMS][MOCK] ─────────────────────────────────`);
    console.log(`  To:   ${to}`);
    console.log(`  From: ${fromNumber}`);
    console.log(`  Type: ${messageType}`);
    console.log(`  Body: ${body}`);
    console.log(`[SMS][MOCK] ─────────────────────────────────\n`);
  }

  // Log to messages table regardless of mode
  const result = await db.query(
    `INSERT INTO messages (tenant_id, lead_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
     VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [tenantId, leadId, body, fromNumber, to, twilioSid, deliveryStatus, messageType],
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
    from: tenant.phone_number || config.twilio.defaultFrom,
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
 * Handle an inbound SMS from a lead.
 * Looks up the lead by phone number, logs the message,
 * and returns the lead for further processing (qualification, etc).
 */
const handleInbound = async ({ from, to, body, twilioSid }) => {
  // Find the tenant by their phone number
  const tenantResult = await db.query(
    'SELECT id FROM tenants WHERE phone_number = $1',
    [to],
  );

  let tenantId;

  if (tenantResult.rows.length > 0) {
    tenantId = tenantResult.rows[0].id;
  } else {
    // Fallback: find lead by phone number across all tenants
    const leadLookup = await db.query(
      'SELECT tenant_id FROM leads WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [from],
    );
    if (leadLookup.rows.length === 0) {
      console.warn(`[SMS][INBOUND] No lead found for phone ${from}`);
      return null;
    }
    tenantId = leadLookup.rows[0].tenant_id;
  }

  // Find the lead
  const leadResult = await db.query(
    'SELECT * FROM leads WHERE tenant_id = $1 AND phone = $2',
    [tenantId, from],
  );

  if (leadResult.rows.length === 0) {
    console.warn(`[SMS][INBOUND] No lead found for tenant ${tenantId}, phone ${from}`);
    return null;
  }

  const lead = leadResult.rows[0];

  // Log the inbound message
  await db.query(
    `INSERT INTO messages (tenant_id, lead_id, direction, body, from_number, to_number, twilio_sid, delivery_status, message_type)
     VALUES ($1, $2, 'inbound', $3, $4, $5, $6, 'received', 'reply')`,
    [tenantId, lead.id, body, from, to, twilioSid || null],
  );

  // Update lead activity
  await db.query(
    'UPDATE leads SET last_activity_at = NOW(), updated_at = NOW() WHERE id = $1',
    [lead.id],
  );

  return {
    tenantId,
    lead,
    messageBody: body,
  };
};

module.exports = {
  sendSms,
  sendInitialContact,
  handleInbound,
};
