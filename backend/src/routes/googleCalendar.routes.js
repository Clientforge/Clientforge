const express = require('express');
const router = express.Router();
const googleCalendarService = require('../services/googleCalendar.service');

/**
 * GET /api/v1/integrations/google-calendar/status
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await googleCalendarService.getStatus(req.tenantId);
    res.json(status || { connected: false, configured: googleCalendarService.isConfigured() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/integrations/google-calendar/connect
 * Returns Google OAuth URL for the authenticated tenant.
 */
router.post('/connect', async (req, res, next) => {
  try {
    const url = googleCalendarService.buildConnectUrl(req.tenantId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/integrations/google-calendar/calendars
 */
router.get('/calendars', async (req, res, next) => {
  try {
    const calendars = await googleCalendarService.listCalendars(req.tenantId);
    res.json({ calendars });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/v1/integrations/google-calendar
 * Body: { calendarId?, syncEnabled? }
 */
router.put('/', async (req, res, next) => {
  try {
    const status = await googleCalendarService.updateConnectionSettings(req.tenantId, req.body);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/integrations/google-calendar/sync
 */
router.post('/sync', async (req, res, next) => {
  try {
    const result = await googleCalendarService.syncTenantCalendar(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/integrations/google-calendar/disconnect
 */
router.post('/disconnect', async (req, res, next) => {
  try {
    const result = await googleCalendarService.disconnect(req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
