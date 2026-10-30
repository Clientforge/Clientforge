#!/usr/bin/env node
/**
 * Replace Bay Area Heart's pending post-appointment jobs with the saved message and timing.
 * Sent jobs stay sent. A send time that is already past is due now.
 *
 * From backend/ on Render:
 *   node scripts/refreshBayAreaPostAppointment.js --dry-run
 *   node scripts/refreshBayAreaPostAppointment.js
 */
require('dotenv').config();

const db = require('../src/db/connection');
const {
  isBayAreaHeartTenant,
  refreshPendingPostAppointments,
} = require('../src/services/appointment-workflow.service');

async function resolveBayAreaHeart() {
  const result = await db.query(
    `SELECT id, name
     FROM tenants
     WHERE name ILIKE '%Bay Area Heart%'
        OR (name ILIKE '%Bay Area%' AND name ILIKE '%Health%')
     ORDER BY name ASC`,
  );
  const matches = result.rows.filter((row) => isBayAreaHeartTenant(row));
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    console.error('More than one Bay Area Heart tenant:');
    for (const row of matches) console.error(`  ${row.name} ${row.id}`);
    return null;
  }
  console.error('No tenant name matched Bay Area Heart.');
  return null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const tenant = await resolveBayAreaHeart();
  if (!tenant) {
    console.error('Bay Area Heart tenant was not found.');
    process.exit(1);
  }

  console.log(`\nRefresh pending post-appointment jobs for ${tenant.name} (${tenant.id})`);
  console.log(dryRun ? 'DRY RUN — pending jobs stay as they are\n' : 'Replacing pending jobs from the saved step\n');

  const result = await refreshPendingPostAppointments(tenant.id, { dryRun });
  console.log(`Test mode: ${result.testMode ? 'on (messages go to the test number)' : 'off'}`);
  console.log(`Appointments with a pending post-appointment: ${result.pendingAppointments}`);
  console.log(`Pending jobs ${dryRun ? 'that would be cancelled' : 'cancelled'}: ${result.cancelled}`);
  console.log(`Jobs ${dryRun ? 'that would be scheduled' : 'scheduled'}: ${result.replaced}`);
  if (result.skipped) console.log(`Stopped: ${result.skipped}`);

  for (const row of result.outcomes) {
    if (row.skipped) {
      const extra = row.cancelled ? `, ${row.cancelled} pending cancelled` : '';
      console.log(`  – ${row.contactName} · ${row.reason}${extra}`);
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
