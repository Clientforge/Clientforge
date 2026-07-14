#!/usr/bin/env node
/**
 * Recompute Sluice appointment service_name from visit_checkout_services,
 * skipping add-ons and fee lines when choosing the primary service.
 *
 * Usage (from backend/):
 *   node scripts/repairSluiceCheckoutPrimaryServices.js
 *   node scripts/repairSluiceCheckoutPrimaryServices.js --dry-run
 */
require('dotenv').config();

const db = require('../src/db/connection');
const { pickPrimaryService } = require('../src/services/optimantra-checkout.service');
const tenantService = require('../src/services/tenant-service.service');
const { SLUICE_TENANT_ID } = require('./sluiceCheckoutRules');

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const result = await db.query(
    `SELECT
       a.id AS appointment_id,
       a.service_name AS current_service_name,
       vc.id AS checkout_id,
       json_agg(
         json_build_object(
           'serviceName', vcs.service_name,
           'serviceType', vcs.service_type
         )
         ORDER BY vcs.sort_order
       ) AS services
     FROM visit_checkouts vc
     JOIN visit_checkout_services vcs ON vcs.checkout_id = vc.id
     JOIN appointments a ON a.id = vc.appointment_id
     WHERE vc.tenant_id = $1
       AND a.provider = 'optimantra'
     GROUP BY a.id, a.service_name, vc.id
     ORDER BY a.updated_at DESC`,
    [SLUICE_TENANT_ID],
  );

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const services = row.services || [];
    const primary = pickPrimaryService(services, { tenantId: SLUICE_TENANT_ID });
    const nextName = primary?.serviceName || null;

    if (!nextName || nextName === row.current_service_name) {
      skipped += 1;
      continue;
    }

    console.log(
      `${dryRun ? '[dry-run] ' : ''}Appointment ${row.appointment_id}:`
      + ` "${row.current_service_name}" → "${nextName}"`,
    );

    if (!dryRun) {
      await db.query(
        `UPDATE appointments
         SET service_name = $2, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $3`,
        [row.appointment_id, nextName, SLUICE_TENANT_ID],
      );

      const matched = await tenantService.matchService(SLUICE_TENANT_ID, nextName);
      if (matched) {
        await tenantService.setAppointmentMatchedService(row.appointment_id, matched.id);
      }
    }

    updated += 1;
  }

  console.log(`\nChecked ${result.rows.length} checkout(s). Updated: ${updated}. Unchanged: ${skipped}.`);
  if (dryRun && updated > 0) {
    console.log('Re-run without --dry-run to apply changes.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.pool.end());
