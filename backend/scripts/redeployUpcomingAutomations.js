#!/usr/bin/env node
/**
 * Re-schedule pre-visit appointment automations for all upcoming bookings.
 * Use after go-live cancelled pending test-mode jobs.
 *
 * Usage (from backend/ on Render or locally):
 *   node scripts/redeployUpcomingAutomations.js
 *   node scripts/redeployUpcomingAutomations.js --dry-run
 *   node scripts/redeployUpcomingAutomations.js <tenant-id>
 *
 * Env:
 *   SLUICE_TENANT_ID — defaults to Sluice Drip Spa tenant
 */
require('dotenv').config();

const db = require('../src/db/connection');
const appointmentWorkflowService = require('../src/services/appointment-workflow.service');

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const tenantId = args.find((a) => !a.startsWith('--')) || SLUICE_TENANT_ID;

  const tenantCheck = await db.query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
  if (tenantCheck.rows.length === 0) {
    console.error('Tenant not found:', tenantId);
    process.exit(1);
  }

  const tenantName = tenantCheck.rows[0].name;
  console.log(`\nRedeploy upcoming booking automations for: ${tenantName} (${tenantId})`);
  if (dryRun) console.log('DRY RUN — no jobs will be created\n');

  const result = await appointmentWorkflowService.redeployUpcomingBookingWorkflows(tenantId, { dryRun });

  console.log(`Appointments found: ${result.appointmentsFound}`);
  if (!dryRun) {
    console.log(`Redeployed: ${result.redeployed}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Failed: ${result.failed}`);
    console.log(`Total jobs scheduled: ${result.totalJobsScheduled}`);
  }

  for (const row of result.outcomes) {
    if (dryRun) {
      console.log(`  [dry-run] ${row.contactName} · ${row.scheduledAt}`);
    } else if (row.error) {
      console.log(`  ✗ ${row.contactName} · ${row.error}`);
    } else if (row.skipped) {
      console.log(`  – ${row.contactName} · skipped (${row.reason})`);
    } else {
      console.log(`  ✓ ${row.contactName} · ${row.jobsScheduled} job(s)`);
    }
  }

  console.log('');
  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
