const express = require('express');
const router = express.Router();
const missedCallService = require('../services/missed-call.service');

/**
 * POST /api/v1/voice/inbound
 *
 * Twilio webhook for inbound voice calls (e.g. forwarded missed calls).
 * Configure in Twilio: Phone Numbers → [Number] → Voice → A CALL COMES IN → Webhook
 *
 * When a call is forwarded to our Twilio number (conditional forwarding from
 * business's existing number), we capture the caller, create/update contact,
 * log the missed call, and send an SMS follow-up (with opt-out and dedup safeguards).
 *
 * Twilio params: From (caller), To (our number), CallSid
 */
router.post('/inbound', async (req, res, next) => {
  try {
    const from = req.body.From || req.body.from;
    const to = req.body.To || req.body.to;
    const callSid = req.body.CallSid || req.body.callSid;

    // Process missed call (create contact, log, send SMS if allowed)
    const result = await missedCallService.processMissedCall({
      from,
      to,
      callSid,
    });

    // Twilio expects TwiML response. Reject immediately so we don't incur voice charges.
    // The caller hears busy/unavailable — we've already captured the call for text-back.
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>';

    res.type('text/xml');
    res.send(twiml);
  } catch (err) {
    console.error('[VOICE] Inbound error:', err.message);
    // Still return TwiML so Twilio doesn't retry excessively
    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>';
    res.type('text/xml');
    res.status(200).send(twiml);
  }
});

module.exports = router;
