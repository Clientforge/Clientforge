const db = require('../db/connection');
const smsService = require('../services/sms.service');
const compliance = require('../services/compliance.service');

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Process all follow-ups that are due right now.
 *
 * Picks up rows where: status = 'pending' AND scheduled_at <= NOW()
 * For each:
 *   1. Check compliance (is lead still subscribed?)
 *   2. Send the SMS
 *   3. Mark follow-up as 'sent'
 *   4. Update lead's followup_step and next_followup_at
 *   5. If this was the last step → mark lead as UNRESPONSIVE
 */
const processDueFollowUps = async () => {
  const result = await db.query(
    `SELECT f.*, l.phone, l.first_name, l.unsubscribed, l.status as lead_status,
            t.phone_number as tenant_phone, t.name as tenant_name
     FROM follow_ups f
     JOIN leads l ON l.id = f.lead_id
     JOIN tenants t ON t.id = f.tenant_id
     WHERE f.status = 'pending'
       AND f.scheduled_at <= NOW()
     ORDER BY f.scheduled_at ASC
     LIMIT 50`,
  );

  const dueFollowUps = result.rows;

  if (dueFollowUps.length === 0) return 0;

  console.log(`[WORKER] Processing ${dueFollowUps.length} due follow-up(s)...`);

  let sentCount = 0;

  for (const followUp of dueFollowUps) {
    try {
      // Skip if lead has opted out, been booked, or is already unresponsive
      if (followUp.unsubscribed) {
        await markFollowUpCancelled(followUp.id, 'lead_unsubscribed');
        continue;
      }

      if (followUp.lead_status === 'BOOKED') {
        await markFollowUpCancelled(followUp.id, 'lead_booked');
        continue;
      }

      // Double-check compliance
      const canSend = await compliance.canSendMessage(followUp.lead_id);
      if (!canSend) {
        await markFollowUpCancelled(followUp.id, 'compliance_block');
        continue;
      }

      // Send the SMS
      await smsService.sendSms({
        tenantId: followUp.tenant_id,
        leadId: followUp.lead_id,
        to: followUp.phone,
        from: followUp.tenant_phone || undefined,
        body: followUp.message_body,
        messageType: 'followup',
      });

      // Mark this follow-up as sent
      await db.query(
        `UPDATE follow_ups SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [followUp.id],
      );

      // Update lead's follow-up tracking
      await db.query(
        `UPDATE leads SET followup_step = $1, last_activity_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [followUp.step, followUp.lead_id],
      );

      // Find the next pending follow-up for this lead
      const nextResult = await db.query(
        `SELECT scheduled_at FROM follow_ups
         WHERE lead_id = $1 AND status = 'pending'
         ORDER BY step ASC LIMIT 1`,
        [followUp.lead_id],
      );

      if (nextResult.rows.length > 0) {
        await db.query(
          'UPDATE leads SET next_followup_at = $1 WHERE id = $2',
          [nextResult.rows[0].scheduled_at, followUp.lead_id],
        );
      } else {
        // No more follow-ups → mark lead as UNRESPONSIVE
        await db.query(
          `UPDATE leads
           SET status = 'UNRESPONSIVE',
               next_followup_at = NULL,
               updated_at = NOW()
           WHERE id = $1 AND status != 'BOOKED'`,
          [followUp.lead_id],
        );
        console.log(`[WORKER] Lead ${followUp.lead_id} marked UNRESPONSIVE (all follow-ups exhausted)`);
      }

      sentCount++;
    } catch (err) {
      console.error(`[WORKER] Error processing follow-up ${followUp.id}:`, err.message);
    }
  }

  if (sentCount > 0) {
    console.log(`[WORKER] Sent ${sentCount} follow-up message(s)`);
  }

  return sentCount;
};

const markFollowUpCancelled = async (followUpId, reason) => {
  await db.query(
    `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
    [followUpId],
  );
  console.log(`[WORKER] Follow-up ${followUpId} cancelled: ${reason}`);
};

/**
 * Start the follow-up worker as a polling loop.
 * Call this from index.js to run alongside the server.
 */
const startWorker = () => {
  console.log(`[WORKER] Follow-up worker started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  const run = async () => {
    try {
      await processDueFollowUps();
    } catch (err) {
      console.error('[WORKER] Unexpected error:', err.message);
    }
  };

  // Run immediately, then on interval
  run();
  setInterval(run, POLL_INTERVAL_MS);
};

module.exports = {
  processDueFollowUps,
  startWorker,
};
