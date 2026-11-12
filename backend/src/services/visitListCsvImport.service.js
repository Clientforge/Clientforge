const db = require('../db/connection');
const { parseVisitListCsv } = require('./visitListCsv.parse');
const { processVisitListRow } = require('./visit-list-checkout.service');
const { allowPatientColumnImportForTenant } = require('./contact.service');

async function processVisitListCsvRows(tenantId, rows, { timezone = 'America/Los_Angeles' } = {}) {
  const stats = {
    rowCount: rows.length,
    processed: 0,
    duplicates: 0,
    skipped: 0,
    jobsScheduled: 0,
    errors: [],
  };

  for (const row of rows) {
    try {
      const result = await processVisitListRow(tenantId, row, { timezone });
      if (result.duplicate) stats.duplicates += 1;
      else if (result.skipped) stats.skipped += 1;
      else {
        stats.processed += 1;
        stats.jobsScheduled += result.jobsScheduled || 0;
      }
    } catch (err) {
      stats.errors.push({
        phone: row.phone,
        visitDate: row.visitDate,
        message: err.message,
      });
    }
  }

  return stats;
}

/**
 * Bay Area Heart: after manual contact CSV import, run visit-list checkout + post-visit SMS
 * when visit_list_email_automations is on (same rules as email ingest).
 */
async function processBayAreaVisitListFromContactImport(tenantId, csvBuffer) {
  const tenantResult = await db.query(
    `SELECT id, name, timezone, visit_list_email_automations
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  const tenant = tenantResult.rows[0];
  if (!allowPatientColumnImportForTenant(tenant)) {
    return null;
  }
  if (!tenant.visit_list_email_automations) {
    return { skipped: true, reason: 'visit_list_automations_off' };
  }

  let rows;
  try {
    rows = parseVisitListCsv(csvBuffer);
  } catch (err) {
    return { skipped: true, reason: 'csv_parse_error', error: err.message };
  }

  if (rows.length === 0) {
    return {
      skipped: true,
      reason: 'no_visit_list_rows',
      message: 'No rows with phone + visit date (e.g. Last Visit)',
    };
  }

  const timezone = tenant.timezone || 'America/Los_Angeles';
  return processVisitListCsvRows(tenantId, rows, { timezone });
}

module.exports = {
  processVisitListCsvRows,
  processBayAreaVisitListFromContactImport,
};
