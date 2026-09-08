#!/usr/bin/env node
/**
 * Import Southlake Autocare customers from a Shopmonkey CSV export.
 * Skips duplicates (matched by phone or shopmonkey_customer_id).
 *
 * Usage (from backend/):
 *   node scripts/importSouthlakeShopmonkeyContacts.js [path/to/customers.csv]
 *
 * Env:
 *   DATABASE_URL — target database (production for live import)
 *   SHOPMONKEY_TENANT_ID — optional tenant UUID override
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/db/connection');
const contactService = require('../src/services/contact.service');

const DEFAULT_CSV = path.join(__dirname, '../fixtures/southlake-shopmonkey-customers.csv');

async function resolveSouthlakeTenant() {
  const tenantId = process.env.SHOPMONKEY_TENANT_ID;
  if (tenantId) {
    const result = await db.query(
      'SELECT id, name FROM tenants WHERE id = $1',
      [tenantId],
    );
    if (result.rows[0]) return result.rows[0];
    throw new Error(`Tenant not found for SHOPMONKEY_TENANT_ID=${tenantId}`);
  }

  const result = await db.query(
    `SELECT id, name FROM tenants
     WHERE name ILIKE '%southlake%' OR name ILIKE '%autocare%'
     ORDER BY created_at ASC
     LIMIT 1`,
  );
  if (result.rows[0]) return result.rows[0];
  throw new Error('Southlake Autocare tenant not found. Set SHOPMONKEY_TENANT_ID.');
}

async function main() {
  const csvPath = process.argv[2] || process.env.SOUTHLAKE_IMPORT_CSV || DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    process.exit(1);
  }

  const tenant = await resolveSouthlakeTenant();
  console.log(`Importing into: ${tenant.name} (${tenant.id})`);
  console.log(`CSV: ${csvPath}`);

  const buffer = fs.readFileSync(csvPath);
  const result = await contactService.importShopmonkeyFromCSV(
    tenant.id,
    buffer,
    'shopmonkey-import',
    { skipDuplicates: true },
  );

  console.log('\nImport complete');
  console.log(`  Imported:            ${result.imported}`);
  console.log(`  Skipped (duplicate): ${result.skippedDuplicates}`);
  console.log(`  Skipped (no phone):  ${result.skippedNoPhone}`);
  console.log(`  Skipped (other):     ${result.skipped - result.skippedDuplicates - result.skippedNoPhone}`);
  console.log(`  Total rows:          ${result.total}`);
  if (result.errors?.length) {
    console.log('  Errors:');
    for (const e of result.errors) {
      console.log(`    ${e.phone}: ${e.error}`);
    }
  }

  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
