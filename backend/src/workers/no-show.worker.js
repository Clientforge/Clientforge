const sluiceNoShow = require('../services/sluice-no-show.service');

const POLL_INTERVAL_MS = 60 * 1000;

const startWorker = () => {
  console.log(`[NO-SHOW-WORKER] Started (polling every ${POLL_INTERVAL_MS / 1000}s, send hour ${sluiceNoShow.SLUICE_NO_SHOW_SEND_HOUR})`);

  const run = async () => {
    try {
      const sent = await sluiceNoShow.processAllSluiceNoShowChecks();
      if (sent > 0) {
        console.log(`[NO-SHOW-WORKER] Sent ${sent} no-show message(s)`);
      }
    } catch (err) {
      console.error('[NO-SHOW-WORKER] Unexpected error:', err.message);
    }
  };

  run();
  setInterval(run, POLL_INTERVAL_MS);
};

module.exports = {
  startWorker,
  processAllSluiceNoShowChecks: sluiceNoShow.processAllSluiceNoShowChecks,
};
