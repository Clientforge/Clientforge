#!/usr/bin/env node
/**
 * Send Bay Area Heart's saved post-appointment message to recent visits that
 * already received or queued an older post-appointment text.
 * A visit that already has this exact message is skipped.
 * Pending copies of the old message are cancelled. Sent messages stay sent.
 *
 * From backend/ on Render:
 *   node scripts/resendBayAreaPostAppointment.js --dry-run
 *   node scripts/resendBayAreaPostAppointment.js
 */
require('dotenv').config();

const db = require('../src/db/connection');
const {
  isBayAreaHeartTenant,
  resendUpdatedPostAppointments,
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

  console.log(`\nResend updated post-appointment for ${tenant.name} (${tenant.id})`);
  console.log(dryRun ? 'DRY RUN — no messages will be queued\n' : 'Queueing the saved message for the appointment worker\n');

  const result = await resendUpdatedPostAppointments(tenant.id, { withinDays: 7, dryRun });
  console.log(`Test mode: ${result.testMode ? 'on (messages go to the test number)' : 'off'}`);
  if (result.messagePreview?.length) {
    console.log('Saved message:');
    for (const message of result.messagePreview) console.log(`  ${message}`);
  }
  console.log(`Contacts with a post-appointment already sent or pending: ${result.contacts}`);
  console.log(`Jobs ${dryRun ? 'that would be scheduled' : 'scheduled'}: ${result.scheduled}`);
  if (result.skipped) console.log(`Stopped: ${result.skipped}`);

  for (const row of result.outcomes) {
    if (row.skipped) {
      const extra = row.cancelled ? `, ${row.cancelled} pending cancelled` : '';
      console.log(`  – ${row.contactName} · ${row.reason}${extra}`);
    } else {
      const when = row.dueNow ? 'due now' : 'scheduled later';
      const dropped = row.cancelled ? `, ${row.cancelled} old pending cancelled` : '';
      console.log(`  ✓ ${row.contactName} · ${row.jobsScheduled} job(s), ${when}${dropped}`);
    }
  }

  console.log('');
  await db.pool.end();
  if (result.skipped) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  try { await db.pool.end(); } catch (_) { /* pool may already be closed */ }
  process.exit(1);
});
