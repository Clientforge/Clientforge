const alldataService = require('../services/alldata.service');

const POLL_INTERVAL_MS = Math.max(
  60_000,
  parseInt(process.env.ALLDATA_POLL_INTERVAL_MS, 10) || 60 * 60 * 1000,
);

async function run() {
  let connections = [];
  try {
    connections = await alldataService.listSyncConnections();
  } catch (err) {
    console.error('[ALLDATA] Failed to list connections:', err.message);
    return;
  }

  if (connections.length === 0) return;

  for (const row of connections) {
    try {
      const result = await alldataService.syncTenantFromSftp(row.tenant_id);
      if (result.filesProcessed > 0) {
        console.log(
          `[ALLDATA] Synced tenant=${row.tenant_id} files=${result.filesProcessed}`,
          result.stats,
        );
      }
    } catch (err) {
      console.error(`[ALLDATA] Sync failed tenant=${row.tenant_id}:`, err.message);
    }
  }
}

function startWorker() {
  console.log(`[ALLDATA] Worker started (interval ${POLL_INTERVAL_MS}ms)`);
  run();
  return setInterval(run, POLL_INTERVAL_MS);
}

module.exports = { startWorker, run };
