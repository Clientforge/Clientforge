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
    const fullResync = req.body?.full === true || req.query?.full === 'true';
    const result = await googleCalendarService.syncTenantCalendar(req.tenantId, { fullResync });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/integrations/google-calendar/sync-log?limit=50&action=skipped
 */
router.get('/sync-log', async (req, res, next) => {
  try {
    const { limit, action } = req.query;
    const result = await googleCalendarService.listSyncLog(req.tenantId, { limit, action });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/integrations/google-calendar/clear-and-resync
 * Deletes all google_calendar appointments for the tenant, then runs a full sync.
 */
router.post('/clear-and-resync', async (req, res, next) => {
  try {
    const result = await googleCalendarService.clearAndResyncTenantCalendar(req.tenantId);
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
