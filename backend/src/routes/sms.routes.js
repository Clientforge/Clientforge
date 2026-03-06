const express = require('express');
const router = express.Router();
const smsService = require('../services/sms.service');
const compliance = require('../services/compliance.service');
const bookingService = require('../services/booking.service');
const followupService = require('../services/followup.service');
const db = require('../db/connection');

/**
 * Process the business logic after an inbound SMS is logged.
 * Handles: opt-out, booking trigger on reply, follow-up cancellation.
 */
const processInboundLogic = async (inbound) => {
  if (!inbound) return { action: 'no_lead_found' };

  const { lead, tenantId, messageBody } = inbound;
  const status = lead.status;

  // Lead replied — cancel any pending follow-ups
  await followupService.cancelFollowUps(lead.id);

  // If lead is in CONTACTED status and replies positively → send booking link
  // (In future, Step 7 qualification goes here instead of this simple check)
  if (status === 'CONTACTED' || status === 'QUALIFYING') {
    const positiveReplies = ['yes', 'yeah', 'yep', 'sure', 'ok', 'okay', 'y', 'interested', 'book', 'schedule'];
    const normalized = messageBody.trim().toLowerCase();

    if (positiveReplies.includes(normalized)) {
      await bookingService.sendBookingLink(tenantId, lead.id);
      return { action: 'booking_link_sent', leadId: lead.id };
    }

    // Non-positive reply — for now, still send booking link
    // (qualification logic in Step 7 will make this smarter)
    await bookingService.sendBookingLink(tenantId, lead.id);
    return { action: 'booking_link_sent', leadId: lead.id };
  }

  // If lead already has booking link and replies again → they might be re-engaging
  if (status === 'QUALIFIED') {
    // Cancel follow-ups (already done above) — they're active again
    return { action: 'lead_re_engaged', leadId: lead.id };
  }

  return { action: 'reply_logged', leadId: lead.id };
};

/**
 * POST /api/v1/sms/inbound — Twilio webhook for incoming SMS.
 */
router.post('/inbound', async (req, res, next) => {
  try {
    const from = req.body.From || req.body.from;
    const to = req.body.To || req.body.to;
    const body = req.body.Body || req.body.body;
    const messageSid = req.body.MessageSid || req.body.messageSid;

    if (!from || !body) {
      return res.status(400).json({ error: 'Missing From and Body fields' });
    }

    // Check for opt-out FIRST (compliance)
    if (compliance.isOptOut(body)) {
      const inbound = await smsService.handleInbound({ from, to, body, twilioSid: messageSid });
      if (inbound) {
        await compliance.handleOptOut(inbound.lead.id, inbound.tenantId);
        await followupService.cancelFollowUps(inbound.lead.id);
      }
      return res.status(200).json({ received: true, action: 'opt_out' });
    }

    const inbound = await smsService.handleInbound({ from, to, body, twilioSid: messageSid });
    const result = await processInboundLogic(inbound);

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sms/status — Twilio delivery status callback.
 */
router.post('/status', async (req, res, next) => {
  try {
    const sid = req.body.MessageSid || req.body.messageSid;
    const status = req.body.MessageStatus || req.body.messageStatus;

    if (sid && status) {
      await db.query(
        'UPDATE messages SET delivery_status = $1 WHERE twilio_sid = $2',
        [status, sid],
      );
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sms/simulate — Mock inbound SMS for testing.
 * Only available when SMS_MODE=mock.
 */
router.post('/simulate', async (req, res, next) => {
  try {
    const appConfig = require('../config');
    if (appConfig.sms.mode !== 'mock') {
      return res.status(403).json({ error: 'Simulate endpoint only available in mock mode' });
    }

    const { from, body } = req.body;

    if (!from || !body) {
      return res.status(400).json({ error: 'from and body are required' });
    }

    // Check for opt-out
    if (compliance.isOptOut(body)) {
      const inbound = await smsService.handleInbound({ from, to: null, body, twilioSid: null });
      if (inbound) {
        await compliance.handleOptOut(inbound.lead.id, inbound.tenantId);
        await followupService.cancelFollowUps(inbound.lead.id);
      }
      return res.json({ received: true, action: 'opt_out' });
    }

    const inbound = await smsService.handleInbound({ from, to: null, body, twilioSid: null });
    const result = await processInboundLogic(inbound);

    res.json({ received: true, ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
