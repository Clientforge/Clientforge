const express = require('express');
const router = express.Router();
const googleCalendarService = require('../services/googleCalendar.service');

/**
 * POST /api/v1/webhook/google-calendar
 * Google Calendar push notification endpoint.
 */
router.post('/', async (req, res) => {
  try {
    const result = await googleCalendarService.handlePushNotification(req.headers);
    res.status(200).send(result.ok === false ? 'ignored' : 'ok');
  } catch (err) {
    console.error('[GCAL][WEBHOOK] Error:', err.message);
    res.status(200).send('ok');
  }
});

module.exports = router;
