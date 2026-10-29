/**
 * Backfill provider:… contact tags from latest eCW appointment (FHIR Practitioner read).
 *
 *   node scripts/backfillEcwContactPractitionerTags.js --tenant-id=UUID
 *   node scripts/backfillEcwContactPractitionerTags.js --dry-run
 */
require('dotenv').config();

const db = require('../src/db/connection');
const ecwService = require('../src/services/ecw.service');
const contactService = require('../src/services/contact.service');
const {
  practitionerIdFromEncounter,
  pickPractitionerName,
} = require('../src/adapters/ecw.adapter');

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
            a.raw_payload AS encounter
     FROM appointments a
     WHERE a.provider = 'ecw'
       AND a.raw_payload IS NOT NULL
       ${tenantFilter}
     ORDER BY a.contact_id, a.scheduled_at DESC NULLS LAST`,
    params,
  );

  console.log(`[backfill-ecw-practitioner-tags] ${rows.length} contact(s)`);
  if (dryRun) console.log('[backfill-ecw-practitioner-tags] DRY RUN — no writes');

  const connectionCache = new Map();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const encounter = row.encounter;
    const practId = practitionerIdFromEncounter(encounter);
    if (!practId) {
      skipped += 1;
      continue;
    }

    let connection = connectionCache.get(row.tenant_id);
    if (!connection) {
      connection = await ecwService.getConnection(row.tenant_id);
      connectionCache.set(row.tenant_id, connection);
    }
    if (!connection) {
      skipped += 1;
      continue;
    }

    let name;
    try {
      const practitioner = await ecwService.fetchPractitioner(connection, practId);
      name = pickPractitionerName(practitioner);
    } catch (err) {
      console.warn(`[backfill-ecw-practitioner-tags] fetch ${practId}:`, err.message);
      skipped += 1;
      continue;
    }

    if (!name) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  would tag contact ${row.contact_id} → provider:${name}`);
      updated += 1;
      continue;
    }

    await contactService.applyEcwEncounterTags(row.tenant_id, row.contact_id, {
      practitionerName: name,
    });
    updated += 1;
  }

  console.log(
    `[backfill-ecw-practitioner-tags] done${dryRun ? ' (dry run)' : ''}:`
    + ` ${updated} tagged, ${skipped} skipped`,
  );
  await db.pool.end();
}

main().catch((err) => {
  console.error('[backfill-ecw-practitioner-tags]', err.message);
  process.exit(1);
});
