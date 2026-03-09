const db = require('../db/connection');
const smsService = require('../services/sms.service');
const emailService = require('../services/email.service');

const POLL_INTERVAL_MS = 15 * 1000;
const BATCH_SIZE = 50;
const EMAIL_RATE_LIMIT_DELAY_MS = 600; // Resend: 2 req/sec max

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const processPendingCampaignMessages = async () => {
  const result = await db.query(
    `SELECT cm.*, c.phone, c.email, c.unsubscribed,
            t.phone_number AS tenant_phone,
            t.email_from_name, t.email_from_address
     FROM campaign_messages cm
     JOIN contacts c ON c.id = cm.contact_id
     JOIN tenants t ON t.id = cm.tenant_id
     WHERE cm.status = 'pending'
       AND cm.scheduled_at <= NOW()
     ORDER BY cm.scheduled_at ASC, cm.step ASC
     LIMIT $1`,
    [BATCH_SIZE],
  );

  const messages = result.rows;
  if (messages.length === 0) return 0;

  console.log(`[CAMPAIGN-WORKER] Processing ${messages.length} campaign message(s)...`);

  let sentCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const msg of messages) {
    try {
      if (msg.unsubscribed) {
        await skipMessage(msg.id, msg.campaign_id, 'optout');
        skippedCount++;
        continue;
      }

      if (msg.step > 1) {
        const replied = await hasContactReplied(msg.campaign_id, msg.contact_id);
        if (replied) {
          await skipRemainingWaves(msg.campaign_id, msg.contact_id, msg.step);
          skippedCount++;
          continue;
        }
      }

      const channel = msg.channel || 'sms';

      if (channel === 'email') {
        if (!msg.email) {
          await skipMessage(msg.id, msg.campaign_id, 'no_email');
          skippedCount++;
          continue;
        }

        const emailResult = await emailService.sendEmail({
          tenantId: msg.tenant_id,
          to: msg.email,
          fromName: msg.email_from_name,
          fromAddress: msg.email_from_address,
          subject: msg.email_subject || 'A message from us',
          body: msg.message_body,
        });
        if (emailResult.status === 'failed') {
          throw new Error(emailResult.error || 'Email send failed');
        }
        await sleep(EMAIL_RATE_LIMIT_DELAY_MS);
      } else {
        if (!msg.phone) {
          await skipMessage(msg.id, msg.campaign_id, 'no_phone');
          skippedCount++;
          continue;
        }

        await smsService.sendSms({
          tenantId: msg.tenant_id,
          leadId: null,
          contactId: msg.contact_id,
          to: msg.phone,
          from: msg.tenant_phone || undefined,
          body: msg.message_body,
          messageType: 'campaign',
        });
      }

      await db.query(
        `UPDATE campaign_messages SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [msg.id],
      );
      await db.query(
        `UPDATE campaigns SET sent_count = sent_count + 1, updated_at = NOW() WHERE id = $1`,
        [msg.campaign_id],
      );
      sentCount++;
    } catch (err) {
      console.error(`[CAMPAIGN-WORKER] Failed to send message ${msg.id}:`, err.message);
      await db.query(
        `UPDATE campaign_messages SET status = 'failed' WHERE id = $1`,
        [msg.id],
      );
      await db.query(
        `UPDATE campaigns SET failed_count = failed_count + 1, updated_at = NOW() WHERE id = $1`,
        [msg.campaign_id],
      );
      failedCount++;
    }
  }

  await markCompletedCampaigns();

  if (sentCount > 0 || failedCount > 0 || skippedCount > 0) {
    console.log(`[CAMPAIGN-WORKER] Sent: ${sentCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);
  }

  return sentCount;
};

const hasContactReplied = async (campaignId, contactId) => {
  const result = await db.query(
    `SELECT 1 FROM campaign_messages cm
     JOIN contacts c ON c.id = cm.contact_id
     JOIN messages m ON m.to_number = c.phone AND m.direction = 'inbound'
       AND m.tenant_id = cm.tenant_id
       AND m.created_at > cm.sent_at
     WHERE cm.campaign_id = $1
       AND cm.contact_id = $2
       AND cm.status = 'sent'
     LIMIT 1`,
    [campaignId, contactId],
  );
  return result.rows.length > 0;
};

const skipMessage = async (messageId, campaignId, reason) => {
  await db.query(`UPDATE campaign_messages SET status = 'skipped' WHERE id = $1`, [messageId]);
  if (reason === 'optout') {
    await db.query(`UPDATE campaigns SET optout_count = optout_count + 1, updated_at = NOW() WHERE id = $1`, [campaignId]);
  }
};

const skipRemainingWaves = async (campaignId, contactId, fromStep) => {
  const result = await db.query(
    `UPDATE campaign_messages
     SET status = 'skipped'
     WHERE campaign_id = $1 AND contact_id = $2 AND step >= $3 AND status = 'pending'
     RETURNING id`,
    [campaignId, contactId, fromStep],
  );
  if (result.rows.length > 0) {
    console.log(`[CAMPAIGN-WORKER] Skipped ${result.rows.length} remaining message(s) for contact ${contactId} (replied)`);
    await db.query(
      `UPDATE campaigns SET reply_count = reply_count + 1, updated_at = NOW() WHERE id = $1`,
      [campaignId],
    );
  }
};

const markCompletedCampaigns = async () => {
  const activeCampaigns = await db.query(
    `SELECT DISTINCT cm.campaign_id
     FROM campaign_messages cm
     WHERE cm.status = 'pending' AND cm.campaign_id IN (
       SELECT id FROM campaigns WHERE status = 'sending'
     )`,
  );

  const activeCampaignIds = new Set(activeCampaigns.rows.map((r) => r.campaign_id));

  const sendingCampaigns = await db.query(
    `SELECT id FROM campaigns WHERE status = 'sending'`,
  );

  for (const row of sendingCampaigns.rows) {
    if (!activeCampaignIds.has(row.id)) {
      await db.query(
        `UPDATE campaigns SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      console.log(`[CAMPAIGN-WORKER] Campaign ${row.id} completed (all waves sent)`);
    }
  }
};

const startWorker = () => {
  console.log(`[CAMPAIGN-WORKER] Campaign worker started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  const run = async () => {
    try {
      await processPendingCampaignMessages();
    } catch (err) {
      console.error('[CAMPAIGN-WORKER] Unexpected error:', err.message);
    }
  };

  run();
  setInterval(run, POLL_INTERVAL_MS);
};

module.exports = { processPendingCampaignMessages, startWorker };
