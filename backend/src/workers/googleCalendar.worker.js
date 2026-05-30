const googleCalendarService = require('../services/googleCalendar.service');

const SYNC_POLL_MS = Number(process.env.GOOGLE_CALENDAR_SYNC_POLL_MS || 300000);
const WATCH_RENEW_MS = Number(process.env.GOOGLE_CALENDAR_WATCH_RENEW_MS || 3600000);

const startWorker = () => {
  if (!googleCalendarService.isConfigured()) {
    console.log('[GCAL] Worker idle — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable calendar sync');
    return;
  }

  console.log(`[GCAL] Worker started (poll every ${SYNC_POLL_MS / 1000}s)`);

  const runSync = async () => {
    try {
      const result = await googleCalendarService.syncAllEnabledConnections();
      if (result.tenants > 0) {
        console.log(`[GCAL] Poll sync: ${result.ok}/${result.tenants} tenant(s) ok`);
      }
    } catch (err) {
      console.error('[GCAL] Poll sync error:', err.message);
    }
  };

  const runWatchRenewal = async () => {
    try {
      const result = await googleCalendarService.renewExpiringWatches();
      if (result.renewed > 0) {
        console.log(`[GCAL] Renewed ${result.renewed} watch channel(s)`);
      }
    } catch (err) {
      console.error('[GCAL] Watch renewal error:', err.message);
    }
  };

  runSync();
  runWatchRenewal();
  setInterval(runSync, SYNC_POLL_MS);
  setInterval(runWatchRenewal, WATCH_RENEW_MS);
};

module.exports = { startWorker };
