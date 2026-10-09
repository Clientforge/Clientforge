const ecwService = require('../services/ecw.service');
const { processEcwEncounterCheckout } = require('../services/ecw-checkout.service');
const { patientIdFromEncounter, isFinishedEncounter } = require('../adapters/ecw.adapter');

const POLL_INTERVAL_MS = Math.max(
  60_000,
  parseInt(process.env.ECW_POLL_INTERVAL_MS, 10) || 5 * 60 * 1000,
);
const POLL_OVERLAP_MS = 2 * 60 * 1000;

function bundleEntries(bundle) {
  if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) return [];
  return bundle.entry.map((e) => e.resource).filter(Boolean);
}

function sinceIsoForConnection(connection) {
  const last = connection.last_encounter_poll_at
    ? new Date(connection.last_encounter_poll_at)
    : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since = new Date(last.getTime() - POLL_OVERLAP_MS);
  return since.toISOString();
}

async function pollTenantEncounters(connection) {
  const tenantId = connection.tenant_id;
  if (!connection.ecw_checkout_automations) {
    return { tenantId, skipped: 'ecw_checkout_automations_off' };
  }

  const sinceIso = sinceIsoForConnection(connection);
  let bundle;
  try {
    bundle = await ecwService.searchFinishedEncountersSince(connection, sinceIso);
  } catch (err) {
    await ecwService.updatePollCursor(tenantId, { error: err.message });
    throw err;
  }

  const encounters = bundleEntries(bundle).filter((r) => r.resourceType === 'Encounter');
  let processed = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const encounter of encounters) {
    if (!isFinishedEncounter(encounter)) {
      skipped += 1;
      continue;
    }
    const patientId = patientIdFromEncounter(encounter);
    let patient = null;
    try {
      if (patientId) {
        patient = await ecwService.fetchPatient(connection, patientId);
      }
    } catch (err) {
      console.warn(`[ECW] Patient fetch failed tenant=${tenantId} encounter=${encounter.id}:`, err.message);
      skipped += 1;
      continue;
    }

    try {
      const result = await processEcwEncounterCheckout(tenantId, encounter, patient);
      if (result.duplicate) duplicates += 1;
      else if (result.skipped) skipped += 1;
      else processed += 1;
    } catch (err) {
      console.error(`[ECW] Checkout failed tenant=${tenantId} encounter=${encounter.id}:`, err.message);
      skipped += 1;
    }
  }

  await ecwService.updatePollCursor(tenantId, { lastPollAt: new Date() });

  return { tenantId, processed, duplicates, skipped, scanned: encounters.length };
}

async function runPollCycle() {
  if (!ecwService.isConfigured()) return;

  const connections = await ecwService.listPollableConnections();
  for (const connection of connections) {
    try {
      const summary = await pollTenantEncounters(connection);
      if (summary.processed > 0) {
        console.log(`[ECW] tenant=${summary.tenantId} processed=${summary.processed} dup=${summary.duplicates}`);
      }
    } catch (err) {
      console.error(`[ECW] Poll failed tenant=${connection.tenant_id}:`, err.message);
    }
  }
}

function startWorker() {
  if (!ecwService.isConfigured()) {
    console.log('[ECW] Encounter worker not started — set ECW_CLIENT_ID and ECW_CLIENT_SECRET');
    return;
  }
  console.log(`[ECW] Encounter worker started (poll every ${POLL_INTERVAL_MS / 1000}s)`);
  runPollCycle().catch((err) => console.error('[ECW] Initial poll error:', err.message));
  setInterval(() => {
    runPollCycle().catch((err) => console.error('[ECW] Poll cycle error:', err.message));
  }, POLL_INTERVAL_MS);
}

module.exports = { startWorker, runPollCycle, pollTenantEncounters };
