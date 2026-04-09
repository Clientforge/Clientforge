const express = require('express');
const router = express.Router();
const smsService = require('../services/sms.service');
const compliance = require('../services/compliance.service');
const bookingService = require('../services/booking.service');
const followupService = require('../services/followup.service');
const conversationService = require('../services/conversation.service');
const aiService = require('../services/ai.service');
const db = require('../db/connection');

/**
 * Resolve which participant row drives AI settings (lead preferred when both exist).
 */
const resolveAiParticipant = (inbound) => {
  if (inbound.lead) return { participantType: 'lead', participantId: inbound.lead.id };
  if (inbound.contact) return { participantType: 'contact', participantId: inbound.contact.id };
  return null;
};

/**
 * When AI auto-reply is enabled, generate and send one SMS. Returns a result object or null.
 */
const trySendAiAutoReply = async (inbound, inboundBody) => {
  if (!process.env.OPENAI_API_KEY) return null;

  const who = resolveAiParticipant(inbound);
  if (!who) return null;

  const { effective } = await conversationService.getEffectiveAiAutoReply(
    inbound.tenantId,
    who.participantType,
    who.participantId,
  );
  if (!effective) return null;

  if (who.participantType === 'lead') {
    const ok = await compliance.canSendMessage(who.participantId);
    if (!ok) return null;
  } else {
    const ok = await compliance.canSendToContact(who.participantId);
    if (!ok) return null;
  }

  const recent = await conversationService.getRecentThreadMessagesForAi(
    inbound.tenantId,
    who.participantType,
    who.participantId,
    12,
  );

  const firstName =
    (inbound.lead && inbound.lead.first_name) ||
    (inbound.contact && inbound.contact.first_name) ||
    null;

  let replyText;
  try {
    replyText = await aiService.generateInboundSmsReply(inbound.tenantId, {
      firstName,
      inboundBody,
      recentMessages: recent,
    });
  } catch (err) {
    console.error('[SMS][AI] generateInboundSmsReply failed:', err.message);
    return null;
  }

  if (!replyText || !replyText.trim()) return null;

  const tenantResult = await db.query('SELECT phone_number FROM tenants WHERE id = $1', [inbound.tenantId]);
  const fromNumber = tenantResult.rows[0]?.phone_number || null;

  await smsService.sendSms({
    tenantId: inbound.tenantId,
    leadId: inbound.lead?.id ?? null,
    contactId: inbound.contact?.id ?? null,
    to: inbound.lead?.phone || inbound.contact?.phone,
    from: fromNumber,
    body: replyText.trim(),
    messageType: 'ai_reply',
  });

  return {
    action: 'ai_reply_sent',
    leadId: inbound.lead?.id,
    contactId: inbound.contact?.id,
  };
};

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
 * Extract inbound params from Twilio or Telnyx webhook payload.
 */
const parseInboundPayload = (req) => {
  if (req.body?.data?.event_type === 'message.received') {
    const p = req.body.data.payload;
    return {
      from: p.from?.phone_number,
      to: p.to?.[0]?.phone_number,
      body: p.text,
      messageSid: p.id,
    };
  }
  return {
    from: req.body.From || req.body.from,
    to: req.body.To || req.body.to,
    body: req.body.Body || req.body.body,
    messageSid: req.body.MessageSid || req.body.messageSid,
  };
};

/**
 * POST /api/v1/sms/inbound — Twilio or Telnyx webhook for incoming SMS.
 */
router.post('/inbound', async (req, res, next) => {
  try {
    if (req.body?.data?.event_type && req.body.data.event_type !== 'message.received') {
      return res.status(200).json({ received: true });
    }

    const { from, to, body, messageSid } = parseInboundPayload(req);

    if (!from || !body) {
      return res.status(400).json({ error: 'Missing From and Body fields' });
    }

    // Check for opt-out FIRST (compliance)
    if (compliance.isOptOut(body)) {
      const inbound = await smsService.handleInbound({ from, to, body, twilioSid: messageSid || undefined });
      if (inbound) {
        if (inbound.participantType === 'lead') {
          await compliance.handleOptOut(inbound.lead.id, inbound.tenantId);
          await followupService.cancelFollowUps(inbound.lead.id);
        } else {
          await compliance.handleOptOutContact(inbound.contact.id, inbound.tenantId);
        }
      }
      return res.status(200).json({ received: true, action: 'opt_out' });
    }

    const inbound = await smsService.handleInbound({ from, to, body, twilioSid: messageSid || undefined });
    if (!inbound) {
      return res.status(200).json({ received: true, action: 'no_lead_found' });
    }

    if (!inbound.keywordWelcomeSent) {
      const aiResult = await trySendAiAutoReply(inbound, body);
      if (aiResult) {
        return res.status(200).json({ received: true, ...aiResult });
      }
    }

    if (inbound.participantType === 'contact') {
      return res.status(200).json({
        received: true,
        action: inbound.keywordWelcomeSent ? 'keyword_welcome' : 'reply_logged',
        contactId: inbound.contact.id,
        keywordWelcomeSent: !!inbound.keywordWelcomeSent,
      });
    }
    const result = await processInboundLogic(inbound);

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sms/status — Twilio or Telnyx delivery status callback.
 */
router.post('/status', async (req, res, next) => {
  try {
    let sid, status;

    if (req.body?.data?.event_type === 'message.finalized') {
      const p = req.body.data.payload;
      sid = p.id;
      status = p.to?.[0]?.status || p.from?.status || 'finalized';
    } else {
      sid = req.body.MessageSid || req.body.messageSid;
      status = req.body.MessageStatus || req.body.messageStatus;
    }

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

    const { from, body, to } = req.body;

    if (!from || !body) {
      return res.status(400).json({ error: 'from and body are required' });
    }

    const simulateTo = to || null;

    // Check for opt-out
    if (compliance.isOptOut(body)) {
      const inbound = await smsService.handleInbound({ from, to: simulateTo, body, twilioSid: null });
      if (inbound) {
        if (inbound.participantType === 'lead') {
          await compliance.handleOptOut(inbound.lead.id, inbound.tenantId);
          await followupService.cancelFollowUps(inbound.lead.id);
        } else {
          await compliance.handleOptOutContact(inbound.contact.id, inbound.tenantId);
        }
      }
      return res.json({ received: true, action: 'opt_out' });
    }

    const inbound = await smsService.handleInbound({ from, to: simulateTo, body, twilioSid: null });
    if (!inbound) {
      return res.json({ received: true, action: 'no_lead_found' });
    }

    if (!inbound.keywordWelcomeSent) {
      const aiResult = await trySendAiAutoReply(inbound, body);
      if (aiResult) {
        return res.json({ received: true, ...aiResult });
      }
    }

    if (inbound.participantType === 'contact') {
      return res.json({
        received: true,
        action: inbound.keywordWelcomeSent ? 'keyword_welcome' : 'reply_logged',
        contactId: inbound.contact.id,
        keywordWelcomeSent: !!inbound.keywordWelcomeSent,
      });
    }
    const result = await processInboundLogic(inbound);

    res.json({ received: true, ...result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
