const db = require('../db/connection');
const smsService = require('./sms.service');
const followupService = require('./followup.service');
const compliance = require('./compliance.service');

/**
 * Send a booking link to a qualified lead.
 *
 * This is the conversion moment:
 *   1. Send booking link SMS
 *   2. Update lead → QUALIFIED, booking_link_sent = true
 *   3. Schedule follow-up sequence in case they don't book
 */
const sendBookingLink = async (tenantId, leadId) => {
  // Check compliance first
  const canSend = await compliance.canSendMessage(leadId);
  if (!canSend) {
    console.log(`[BOOKING] Lead ${leadId} is unsubscribed — skipping`);
    return null;
  }

  // Get tenant info
  const tenantResult = await db.query(
    'SELECT name, phone_number, booking_link, followup_config FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantResult.rows[0];

  if (!tenant.booking_link) {
    console.warn(`[BOOKING] Tenant ${tenantId} has no booking link configured`);
  }

  // Get lead info
  const leadResult = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
  const lead = leadResult.rows[0];

  const firstName = lead.first_name || 'there';
  const bookingLink = tenant.booking_link || 'https://calendly.com/your-link';

  const body = `Great news, ${firstName}! You're all set to book your appointment with ${tenant.name}. Pick a time that works for you: ${bookingLink}`;

  // Send the booking link SMS
  await smsService.sendSms({
    tenantId,
    leadId,
    to: lead.phone,
    from: tenant.phone_number || undefined,
    body,
    messageType: 'booking',
  });

  // Update lead status
  await db.query(
    `UPDATE leads
     SET status = 'QUALIFIED',
         booking_link_sent = true,
         last_activity_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [leadId],
  );

  console.log(`[BOOKING] Booking link sent to lead ${leadId}`);

  // Schedule follow-ups in case they don't book
  try {
    await followupService.scheduleFollowUps(leadId, tenantId);
  } catch (err) {
    console.error(`[BOOKING] Failed to schedule follow-ups for lead ${leadId}:`, err.message);
  }

  return { leadId, bookingLinkSent: true };
};

/**
 * Mark a lead as booked (called when booking webhook fires or manually).
 * Cancels all pending follow-ups.
 */
const markAsBooked = async (leadId) => {
  await db.query(
    `UPDATE leads
     SET status = 'BOOKED',
         booked_at = NOW(),
         last_activity_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [leadId],
  );

  // Cancel remaining follow-ups
  await followupService.cancelFollowUps(leadId);

  console.log(`[BOOKING] Lead ${leadId} marked as BOOKED — follow-ups cancelled`);
};

module.exports = {
  sendBookingLink,
  markAsBooked,
};
