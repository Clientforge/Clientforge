const ecwService = require('./ecw.service');
const { processEcwEncounterCheckout } = require('./ecw-checkout.service');
const {
  isFinishedEncounter,
  encounterRelevantSince,
} = require('../adapters/ecw.adapter');

const DEFAULT_BULK_INTERVAL_MS = 30 * 60 * 1000;
const EXPORT_POLL_MS = 5000;
const EXPORT_POLL_MAX_ATTEMPTS = 120;
const BULK_KICKOFF_LOG_BODY_MAX = 8000;
const BULK_KICKOFF_ERROR_BODY_MAX = 900;

function groupResourceId(groupId) {
  const raw = String(groupId || '').trim();
  if (!raw) return null;
  return raw.startsWith('Group/') ? raw.slice('Group/'.length) : raw;
}

function parseNdjson(text) {
  const resources = [];
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      resources.push(JSON.parse(trimmed));
    } catch {
      // skip malformed lines
    }
  }
  return resources;
}

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function truncateText(text, maxLen) {
  const s = String(text ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…(+${s.length - maxLen} chars)`;
}

function responseHeadersObject(res) {
  const headers = {};
  if (res?.headers?.forEach) {
    res.headers.forEach((value, key) => {
      headers[key] = value;
    });
  }
  return headers;
}

function summarizeBulkKickoffBody(bodyText) {
  const trimmed = String(bodyText || '').trim();
  if (!trimmed) return '(empty body)';
  try {
    const data = JSON.parse(trimmed);
    if (data.resourceType === 'OperationOutcome') {
      const parts = (data.issue || []).map((issue) => {
        return issue.diagnostics || issue.details?.text || issue.code;
      }).filter(Boolean);
      return parts.length ? parts.join('; ') : 'OperationOutcome';
    }
    if (data.output) return 'includes output';
    const keys = Object.keys(data);
    return keys.length ? `JSON keys: ${keys.slice(0, 16).join(', ')}` : 'empty JSON object';
  } catch {
    return truncateText(trimmed, 240);
  }
}

function logBulkExportKickoffResponse(connection, path, res, bodyText, reason) {
  console.warn('[ECW] Bulk export kickoff response', {
    reason,
    tenantId: connection?.tenant_id,
    fhirBase: connection?.fhir_base_url,
    path,
    status: res.status,
    statusText: res.statusText,
    headers: responseHeadersObject(res),
    body: truncateText(bodyText, BULK_KICKOFF_LOG_BODY_MAX),
  });
}

function bulkKickoffErrorMessage(res, bodyText, baseMessage) {
  const summary = summarizeBulkKickoffBody(bodyText);
  const detail = `HTTP ${res.status}${summary ? `: ${summary}` : ''}`;
  const bodySnippet = truncateText(bodyText, BULK_KICKOFF_ERROR_BODY_MAX);
  const withBody = bodySnippet && bodySnippet !== summary
    ? `${detail} — ${bodySnippet}`
    : detail;
  const msg = `${baseMessage} (${withBody})`;
  return truncateText(msg, 2000);
}

function extractStatusUrlFromHeaders(res) {
  const candidates = [
    res.headers.get('content-location'),
    res.headers.get('Content-Location'),
    res.headers.get('location'),
    res.headers.get('Location'),
  ];
  for (const value of candidates) {
    const trimmed = String(value || '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function isBulkExportInProgressOutcome(data) {
  if (data?.resourceType !== 'OperationOutcome') return false;
  return (data.issue || []).some((issue) => {
    const code = String(issue.code || '').toLowerCase();
    const diag = String(issue.diagnostics || '').toLowerCase();
    return code === 'duplicate'
      || diag.includes('already in progress')
      || diag.includes('in progress');
  });
}

function storedBulkStatusUrl(connection) {
  return String(connection?.bulk_export_status_url || '').trim() || null;
}

function isBulkJobNotFoundError(err) {
  return err?.code === 'BULK_JOB_NOT_FOUND';
}

function isBulkPollInProgressError(err) {
  return err?.code === 'BULK_POLL_IN_PROGRESS';
}

/** FHIR bulk status manifest: `error` is an array; empty array means success. */
function bulkExportStatusHasErrors(body) {
  const errors = Array.isArray(body?.error) ? body.error : [];
  return errors.length > 0;
}

/**
 * Kick off Group/$export (async). Returns Content-Location URL for status polling.
 */
async function kickoffGroupExport(connection, { sinceIso } = {}) {
  const base = (connection.fhir_base_url || '').replace(/\/$/, '');
  const gid = groupResourceId(connection.ecw_group_id);
  if (!base || !gid) {
    throw Object.assign(new Error('FHIR base URL and eCW Group ID are required for bulk export'), {
      statusCode: 400,
    });
  }

  const params = new URLSearchParams({ _type: 'Patient,Encounter' });
  if (sinceIso) {
    params.set('_since', sinceIso);
  }

  const path = `Group/${encodeURIComponent(gid)}/$export?${params.toString()}`;
  const res = await ecwService.fhirRequest(connection, path, {
    method: 'GET',
    headers: {
      Prefer: 'respond-async',
      Accept: 'application/fhir+json',
    },
    returnResponse: true,
  });

  if (res.status === 202) {
    const contentLocation = res.headers.get('content-location') || res.headers.get('Content-Location');
    if (!contentLocation) {
      const bodyText = await res.text().catch(() => '');
      logBulkExportKickoffResponse(connection, path, res, bodyText, 'missing_content_location');
      throw new Error(
        bulkKickoffErrorMessage(res, bodyText, 'Bulk export accepted but Content-Location header missing'),
      );
    }
    return contentLocation.trim();
  }

  if (res.status >= 200 && res.status < 300) {
    const bodyText = await res.text().catch(() => '');
    let data = {};
    try {
      data = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      logBulkExportKickoffResponse(connection, path, res, bodyText, 'sync_non_json');
      throw new Error(
        bulkKickoffErrorMessage(res, bodyText, 'Unexpected synchronous bulk export response'),
      );
    }
    if (data.output) return { immediate: true, body: data };
    if (isBulkExportInProgressOutcome(data)) {
      const statusUrl = extractStatusUrlFromHeaders(res);
      logBulkExportKickoffResponse(connection, path, res, bodyText, 'export_already_in_progress');
      return { inProgress: true, statusUrl };
    }
    logBulkExportKickoffResponse(connection, path, res, bodyText, 'sync_unexpected_shape');
    throw new Error(
      bulkKickoffErrorMessage(res, bodyText, 'Unexpected synchronous bulk export response'),
    );
  }

  const errText = await res.text().catch(() => '');
  logBulkExportKickoffResponse(connection, path, res, errText, 'kickoff_failed');
  let msg = res.statusText || 'Bulk export kickoff failed';
  try {
    const parsed = JSON.parse(errText);
    msg = parsed.issue?.[0]?.diagnostics || parsed.message || msg;
  } catch {
    if (errText) msg = errText.slice(0, 500);
  }
  throw new Error(truncateText(`${msg} (HTTP ${res.status})`, 2000));
}

async function pollExportJob(connection, statusUrl) {
  for (let attempt = 0; attempt < EXPORT_POLL_MAX_ATTEMPTS; attempt += 1) {
    const res = await ecwService.fhirRequest(connection, statusUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      returnResponse: true,
    });

    if (res.status === 202) {
      await sleep(EXPORT_POLL_MS);
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      const body = await res.json().catch(() => ({}));
      if (bulkExportStatusHasErrors(body)) {
        const errors = Array.isArray(body.error) ? body.error : [];
        throw new Error(errors[0]?.message || 'Bulk export job failed');
      }
      return body;
    }

    if (res.status === 404 || res.status === 410) {
      throw Object.assign(new Error('Bulk export job not found'), { code: 'BULK_JOB_NOT_FOUND' });
    }

    const errText = await res.text().catch(() => '');
    throw new Error(errText.slice(0, 500) || `Export status poll failed (${res.status})`);
  }
  throw Object.assign(new Error('Bulk export job timed out'), { code: 'BULK_POLL_IN_PROGRESS' });
}

async function downloadExportOutputs(connection, exportResult) {
  const outputs = Array.isArray(exportResult?.output) ? exportResult.output : [];
  const resources = [];

  for (const item of outputs) {
    const url = item?.url;
    if (!url) continue;
    const res = await ecwService.fhirRequest(connection, url, {
      method: 'GET',
      headers: { Accept: 'application/fhir+json, application/ndjson, */*' },
      returnResponse: true,
    });
    if (!res.ok) {
      console.warn('[ECW] Bulk download failed:', url, res.status);
      continue;
    }
    const text = await res.text();
    resources.push(...parseNdjson(text));
  }

  return resources;
}

function sinceIsoForBulk(connection) {
  const last = connection.last_bulk_export_at
    ? new Date(connection.last_bulk_export_at)
    : null;
  if (last && !Number.isNaN(last.getTime())) {
    return last.toISOString();
  }
  return null;
}

async function processBulkResources(tenantId, connection, resources, sinceDate) {
  const patientsById = new Map();
  const encounters = [];

  for (const r of resources) {
    if (!r?.resourceType) continue;
    if (r.resourceType === 'Patient' && r.id) {
      patientsById.set(r.id, r);
    }
    if (r.resourceType === 'Encounter') {
      encounters.push(r);
    }
  }

  let processed = 0;
  let duplicates = 0;
  let skipped = 0;

  for (const encounter of encounters) {
    if (!isFinishedEncounter(encounter)) {
      skipped += 1;
      continue;
    }
    if (sinceDate && !encounterRelevantSince(encounter, sinceDate)) {
      skipped += 1;
      continue;
    }

    const subjectRef = encounter?.subject?.reference || '';
    const m = subjectRef.match(/Patient\/(.+)/i);
    const patientId = m ? m[1] : null;
    let patient = patientId ? patientsById.get(patientId) : null;
    if (!patient && patientId && connection) {
      try {
        patient = await ecwService.fetchPatient(connection, patientId);
      } catch (err) {
        console.warn(`[ECW] Bulk Patient fetch failed ${patientId}:`, err.message);
      }
    }

    try {
      const result = await processEcwEncounterCheckout(tenantId, encounter, patient);
      if (result.duplicate) duplicates += 1;
      else if (result.skipped) skipped += 1;
      else processed += 1;
    } catch (err) {
      console.error(`[ECW] Bulk checkout failed tenant=${tenantId} encounter=${encounter.id}:`, err.message);
      skipped += 1;
    }
  }

  return { processed, duplicates, skipped, scanned: encounters.length, patients: patientsById.size };
}

async function completeBulkExportRun(tenantId, connection, exportResult, sinceDate) {
  let resources;
  try {
    resources = await downloadExportOutputs(connection, exportResult);
  } catch (err) {
    await ecwService.updateBulkExportCursor(tenantId, { error: err.message });
    throw err;
  }

  const summary = await processBulkResources(tenantId, connection, resources, sinceDate);
  await ecwService.clearBulkExportJob(tenantId);
  await ecwService.updateBulkExportCursor(tenantId, { lastExportAt: new Date() });
  return { tenantId, ...summary };
}

async function pollAndCompleteBulkExport(tenantId, connection, statusUrl, sinceDate) {
  const exportResult = await pollExportJob(connection, statusUrl);
  return completeBulkExportRun(tenantId, connection, exportResult, sinceDate);
}

async function resumeStoredBulkExport(connection, sinceDate) {
  const tenantId = connection.tenant_id;
  const statusUrl = storedBulkStatusUrl(connection);
  if (!statusUrl) return null;

  try {
    console.log(`[ECW] bulk tenant=${tenantId} resuming export job`);
    return await pollAndCompleteBulkExport(tenantId, connection, statusUrl, sinceDate);
  } catch (err) {
    if (isBulkJobNotFoundError(err)) {
      console.warn(`[ECW] bulk tenant=${tenantId} stored export job not found — clearing`);
      await ecwService.clearBulkExportJob(tenantId);
      return null;
    }
    if (isBulkPollInProgressError(err)) {
      console.log(`[ECW] bulk tenant=${tenantId} export still in progress (will resume next cycle)`);
      await ecwService.updateBulkExportCursor(tenantId, { clearPollError: true });
      return { tenantId, skipped: 'bulk_job_in_progress' };
    }
    await ecwService.updateBulkExportCursor(tenantId, { error: err.message });
    throw err;
  }
}

async function runBulkExportForConnection(connection) {
  const tenantId = connection.tenant_id;
  if (!connection.ecw_checkout_automations) {
    return { tenantId, skipped: 'ecw_checkout_automations_off' };
  }
  if (connection.connection_mode !== 'bulk' || !connection.ecw_group_id) {
    return { tenantId, skipped: 'not_bulk_connection' };
  }

  const sinceIso = sinceIsoForBulk(connection);
  const sinceDate = sinceIso ? new Date(sinceIso) : null;

  const resumed = await resumeStoredBulkExport(connection, sinceDate);
  if (resumed) return resumed;

  let kickoff;
  try {
    kickoff = await kickoffGroupExport(connection, { sinceIso });
  } catch (err) {
    await ecwService.updateBulkExportCursor(tenantId, { error: err.message });
    throw err;
  }

  if (kickoff?.inProgress) {
    const statusUrl = kickoff.statusUrl || storedBulkStatusUrl(connection);
    if (!statusUrl) {
      console.warn(
        `[ECW] bulk tenant=${tenantId} eCW reports export in progress but no status URL — waiting`,
      );
      await ecwService.updateBulkExportCursor(tenantId, { clearPollError: true });
      return { tenantId, skipped: 'bulk_duplicate_no_status_url' };
    }
    await ecwService.setBulkExportJob(tenantId, { statusUrl });
    try {
      return await pollAndCompleteBulkExport(tenantId, connection, statusUrl, sinceDate);
    } catch (err) {
      if (isBulkPollInProgressError(err)) {
        await ecwService.updateBulkExportCursor(tenantId, { clearPollError: true });
        return { tenantId, skipped: 'bulk_job_in_progress' };
      }
      await ecwService.updateBulkExportCursor(tenantId, { error: err.message });
      throw err;
    }
  }

  let exportResult;
  try {
    if (kickoff.immediate) {
      exportResult = kickoff.body;
    } else {
      const statusUrl = typeof kickoff === 'string' ? kickoff : kickoff.statusUrl;
      await ecwService.setBulkExportJob(tenantId, { statusUrl });
      exportResult = await pollExportJob(connection, statusUrl);
    }
  } catch (err) {
    if (isBulkPollInProgressError(err)) {
      await ecwService.updateBulkExportCursor(tenantId, { clearPollError: true });
      return { tenantId, skipped: 'bulk_job_in_progress' };
    }
    await ecwService.updateBulkExportCursor(tenantId, { error: err.message });
    throw err;
  }

  return completeBulkExportRun(tenantId, connection, exportResult, sinceDate);
}

function bulkExportIntervalMs() {
  return Math.max(
    60_000,
    parseInt(process.env.ECW_BULK_EXPORT_INTERVAL_MS, 10) || DEFAULT_BULK_INTERVAL_MS,
  );
}

module.exports = {
  runBulkExportForConnection,
  kickoffGroupExport,
  pollExportJob,
  parseNdjson,
  processBulkResources,
  bulkExportIntervalMs,
  groupResourceId,
  summarizeBulkKickoffBody,
  truncateText,
  isBulkExportInProgressOutcome,
  extractStatusUrlFromHeaders,
  bulkExportStatusHasErrors,
};
