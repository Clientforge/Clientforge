const birthdayCampaign = require('../services/birthday-campaign.service');

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

const startWorker = () => {
  console.log(`[BIRTHDAY-WORKER] Started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  const run = async () => {
    try {
      const sent = await birthdayCampaign.processAllBirthdayCampaigns();
      if (sent > 0) {
        console.log(`[BIRTHDAY-WORKER] Sent ${sent} birthday message(s)`);
      }
    } catch (err) {
      console.error('[BIRTHDAY-WORKER] Unexpected error:', err.message);
    }
  };

  run();
  setInterval(run, POLL_INTERVAL_MS);
};

module.exports = {
  startWorker,
  processAllBirthdayCampaigns: birthdayCampaign.processAllBirthdayCampaigns,
};
