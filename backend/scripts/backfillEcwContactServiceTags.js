/**
 * Backfill contact tags from latest eCW appointment service_name per contact.
 *
 *   node scripts/backfillEcwContactServiceTags.js
 *   node scripts/backfillEcwContactServiceTags.js --tenant-id=UUID
 *   node scripts/backfillEcwContactServiceTags.js --dry-run
 */
require('dotenv').config();

const db = require('../src/db/connection');
const contactService = require('../src/services/contact.service');

function parseArgs(argv) {
  let tenantId = null;
  let dryRun = false;
  for (const arg of argv.slice(2)) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg.startsWith('--tenant-id=')) tenantId = arg.slice('--tenant-id='.length).trim() || null;
  }
  return { tenantId, dryRun };
}

async function main() {
  const { tenantId, dryRun } = parseArgs(process.argv);

  const params = [];
  let tenantFilter = '';
  if (tenantId) {
    params.push(tenantId);
    tenantFilter = 'AND a.tenant_id = $1';
  }

  const { rows } = await db.query(
    `SELECT DISTINCT ON (a.contact_id)
            a.tenant_id,
            a.contact_id,
            a.service_name
     FROM appointments a
     WHERE a.provider = 'ecw'
       AND a.service_name IS NOT NULL
       AND TRIM(a.service_name) <> ''
       ${tenantFilter}
     ORDER BY a.contact_id, a.scheduled_at DESC NULLS LAST`,
    params,
  );

  console.log(`[backfill-ecw-service-tags] ${rows.length} contact(s) with eCW appointments`);
  if (dryRun) console.log('[backfill-ecw-service-tags] DRY RUN — no writes');

  let updated = 0;
  for (const row of rows) {
    const label = String(row.service_name).trim();
    if (!label) continue;

    if (dryRun) {
      console.log(`  would tag contact ${row.contact_id} → service:${label}`);
      updated += 1;
      continue;
    }

    await contactService.applyEcwServiceTag(row.tenant_id, row.contact_id, label);
    updated += 1;
  }

  console.log(`[backfill-ecw-service-tags] done${dryRun ? ' (dry run)' : ''}: ${updated} contact(s)`);
  await db.pool.end();
}

main().catch((err) => {
  console.error('[backfill-ecw-service-tags]', err.message);
  process.exit(1);
});
