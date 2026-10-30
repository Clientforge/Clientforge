#!/usr/bin/env node
/**
 * Schedule Bay Area Heart post-appointment messages for visits in the past 7 days.
 * Overdue steps are due now. Steps still in the future keep their normal time.
 * The appointment worker sends due jobs. Test mode still redirects to the test number.
 *
 * From backend/ on Render:
 *   node scripts/catchUpBayAreaPostAppointment.js --dry-run
 *   node scripts/catchUpBayAreaPostAppointment.js
 */
require('dotenv').config();

const db = require('../src/db/connection');
const {
  BAY_AREA_HEART_TENANT_ID,
  isBayAreaHeartTenant,
  catchUpRecentPostAppointments,
} = require('../src/services/appointment-workflow.service');

async function resolveBayAreaHeart() {
  const result = await db.query(
    `SELECT id, name
     FROM tenants
     WHERE id = $1
        OR name ILIKE '%Bay Area Heart%'
        OR (name ILIKE '%Bay Area%' AND name ILIKE '%Health%')`,
    [BAY_AREA_HEART_TENANT_ID],
  );
  const matches = result.rows.filter((row) => isBayAreaHeartTenant(row));
  const known = matches.find((row) => row.id === BAY_AREA_HEART_TENANT_ID);
  if (known) return known;
  if (matches.length === 1) return matches[0];
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tenant = await resolveBayAreaHeart();
  if (!tenant) {
    console.error('Bay Area Heart tenant was not found.');
    process.exit(1);
  }

  console.log(`\nPost-appointment catch-up for ${tenant.name} (${tenant.id})`);
  console.log(dryRun ? 'DRY RUN — no jobs will be created\n' : 'Scheduling jobs for the appointment worker\n');

  const result = await catchUpRecentPostAppointments(tenant.id, { withinDays: 7, dryRun });
  console.log(`Test mode: ${result.testMode ? 'on (messages go to the test number)' : 'off'}`);
  console.log(`Contacts with a visit in the past 7 days: ${result.contactsWithVisit}`);
  console.log(`Contacts with a last visit but no completed appointment: ${result.contactsWithoutAppointment}`);
  console.log(`Post-appointment jobs ${dryRun ? 'that would be scheduled' : 'scheduled'}: ${result.scheduled}`);
  if (result.skipped) console.log(`Stopped: ${result.skipped}`);

  for (const row of result.outcomes) {
    if (row.skipped) {
      console.log(`  – ${row.contactName} · ${row.reason}`);
    } else {
      const when = row.dueNow ? 'due now' : 'scheduled later';
      console.log(`  ✓ ${row.contactName} · ${row.jobsScheduled} job(s), ${when}`);
    }
  }

  console.log('');
  await db.pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try { await db.pool.end(); } catch (_) { /* pool may already be closed */ }
  process.exit(1);
});
