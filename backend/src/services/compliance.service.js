const db = require('../db/connection');

const STOP_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end'];

/**
 * Check if a message body is an opt-out request.
 */
const isOptOut = (messageBody) => {
  const normalized = messageBody.trim().toLowerCase();
  return STOP_KEYWORDS.includes(normalized);
};

/**
 * Process an opt-out: flag the lead, log the event, cancel follow-ups.
 */
const handleOptOut = async (leadId, tenantId) => {
  await db.query(
    `UPDATE leads SET unsubscribed = true, unsubscribed_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [leadId],
  );

  // Cancel any pending follow-ups
  await db.query(
    `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW() WHERE lead_id = $1 AND status = 'pending'`,
    [leadId],
  );

  // Log compliance event
  await db.query(
    `INSERT INTO consent_log (tenant_id, lead_id, event_type, source)
     VALUES ($1, $2, 'opt_out', 'sms_stop')`,
    [tenantId, leadId],
  );

  console.log(`[COMPLIANCE] Lead ${leadId} opted out — all messaging stopped`);
};

/**
 * Check if we're allowed to send a message to this lead.
 * Returns true if OK, false if blocked.
 */
const canSendMessage = async (leadId) => {
  const result = await db.query(
    'SELECT unsubscribed FROM leads WHERE id = $1',
    [leadId],
  );

  if (result.rows.length === 0) return false;
  return !result.rows[0].unsubscribed;
};

module.exports = {
  STOP_KEYWORDS,
  isOptOut,
  handleOptOut,
  canSendMessage,
};
