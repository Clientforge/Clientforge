const express = require('express');
const router = express.Router();
const squareService = require('../services/square.service');

/**
 * POST /api/v1/webhook/square
 * Square Bookings webhook (application-level URL; routes by merchant_id).
 */
router.post('/', async (req, res, next) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const result = await squareService.handleWebhookNotification(rawBody, req.headers);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
