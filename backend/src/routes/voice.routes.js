const express = require('express');
const router = express.Router();
const missedCallService = require('../services/missed-call.service');
const telnyxVoiceService = require('../services/telnyx-voice.service');

const twilioRejectTwiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>';

/**
 * POST /api/v1/voice/inbound
 *
 * Twilio webhook for inbound voice calls (e.g. forwarded missed calls).
 * Configure in Twilio: Phone Numbers → [Number] → Voice → A CALL COMES IN → Webhook
 */
router.post('/inbound', async (req, res, next) => {
  try {
    const from = req.body.From || req.body.from;
    const to = req.body.To || req.body.to;
    const callSid = req.body.CallSid || req.body.callSid;

    await missedCallService.processMissedCall({ from, to, callSid });

    res.type('text/xml');
    res.send(twilioRejectTwiml);
  } catch (err) {
    console.error('[VOICE][TWILIO] Inbound error:', err.message);
    res.type('text/xml');
    res.status(200).send(twilioRejectTwiml);
  }
});

/**
 * POST /api/v1/voice/telnyx
 *
 * Telnyx Voice API v2 webhook for inbound forwarded/missed calls.
 * Configure in Telnyx: Voice API Application → Webhook URL (API v2).
 */
router.post('/telnyx', async (req, res, next) => {
  try {
    const parsed = telnyxVoiceService.parseInboundCallEvent(req.body);
    if (!parsed) {
      return res.status(200).json({ received: true, action: 'ignored' });
    }

    telnyxVoiceService.hangupCall(parsed.callControlId).catch((err) => {
      console.error('[VOICE][TELNYX] Hangup failed:', err.message);
    });

    const result = await missedCallService.processMissedCall({
      from: parsed.from,
      to: parsed.to,
      callSid: parsed.callControlId,
    });

    res.status(200).json({ received: true, ...result });
  } catch (err) {
    console.error('[VOICE][TELNYX] Inbound error:', err.message);
    res.status(200).json({ received: true, action: 'error' });
  }
});

module.exports = router;
