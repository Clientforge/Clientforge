const ecwService = require('../services/ecw.service');
const {
  runBulkExportForConnection,
  bulkExportIntervalMs,
} = require('../services/ecw-bulk-export.service');

async function runExportCycle() {
  if (!ecwService.isBackendConfigured()) return;

  const connections = await ecwService.listBulkExportConnections();
  for (const connection of connections) {
    try {
      const summary = await runBulkExportForConnection(connection);
      if (summary.processed > 0 || summary.upcoming > 0 || summary.practitionersTagged > 0) {
        console.log(
          `[ECW] bulk tenant=${summary.tenantId} processed=${summary.processed} dup=${summary.duplicates} upcoming=${summary.upcoming || 0} practitioners=${summary.practitionersTagged || 0}`,
        );
      } else if (summary.skipped === 'bulk_job_in_progress') {
        console.log(`[ECW] bulk tenant=${summary.tenantId} waiting on in-progress export`);
      }
    } catch (err) {
      console.error(`[ECW] Bulk export failed tenant=${connection.tenant_id}:`, err.message);
    }
  }
}

function startWorker() {
  if (!ecwService.isBackendConfigured()) {
    console.log('[ECW] Bulk export worker not started — configure ECW_CLIENT_ID + ECW_PRIVATE_KEY');
    return;
  }
  const intervalMs = bulkExportIntervalMs();
  console.log(`[ECW] Bulk export worker started (every ${intervalMs / 1000}s)`);
  runExportCycle().catch((err) => console.error('[ECW] Initial bulk export error:', err.message));
  setInterval(() => {
    runExportCycle().catch((err) => console.error('[ECW] Bulk export cycle error:', err.message));
  }, intervalMs);
}

module.exports = { startWorker, runExportCycle };
