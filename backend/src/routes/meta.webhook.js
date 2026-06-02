const express = require('express');
const router = express.Router();
const instagramService = require('../services/instagram.service');

/**
 * GET /api/v1/webhook/meta — Meta webhook verification.
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = instagramService.webhookVerifyToken();

  if (mode === 'subscribe' && token && expected && token === expected) {
    return res.status(200).send(challenge);
  }

  console.warn('[META][WEBHOOK] Verification failed');
  return res.sendStatus(403);
});

/**
 * POST /api/v1/webhook/meta — Instagram messaging events.
 */
router.post('/', async (req, res) => {
  try {
    await instagramService.handleWebhook(req.body, {
      signature: req.headers['x-hub-signature-256'],
      rawBody: req.rawBody,
    });
    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('[META][WEBHOOK] Error:', err.message);
    if (err.statusCode === 403) {
      return res.sendStatus(403);
    }
    res.status(200).send('EVENT_RECEIVED');
  }
});

module.exports = router;
