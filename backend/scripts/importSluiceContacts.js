#!/usr/bin/env node
/**
 * Import Sluice Drip Spa contacts from generated CSV (no follow-ups).
 *
 * Usage (from backend/):
 *   node scripts/generateSluiceImport.js
 *   node scripts/importSluiceContacts.js
 *
 * Env:
 *   SLUICE_TENANT_ID — defaults to known Sluice Drip Spa tenant
 *   SLUICE_IMPORT_CSV — path to CSV (default: fixtures/sluice-drip-spa-import.csv)
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('../src/db/connection');
const contactService = require('../src/services/contact.service');

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';
const DEFAULT_CSV = path.join(__dirname, '../fixtures/sluice-drip-spa-import.csv');

async function main() {
  const csvPath = process.argv[2] || process.env.SLUICE_IMPORT_CSV || DEFAULT_CSV;

  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found:', csvPath);
    console.error('Run: node scripts/generateSluiceImport.js');
    process.exit(1);
  }

  const tenantCheck = await db.query(
    'SELECT id, name FROM tenants WHERE id = $1',
    [SLUICE_TENANT_ID],
  );
  if (tenantCheck.rows.length === 0) {
    console.error('Tenant not found:', SLUICE_TENANT_ID);
    process.exit(1);
  }

  console.log(`Importing into: ${tenantCheck.rows[0].name} (${SLUICE_TENANT_ID})`);
  console.log(`CSV: ${csvPath}`);

  const buffer = fs.readFileSync(csvPath);
  const result = await contactService.importFromCSV(
    SLUICE_TENANT_ID,
    buffer,
    'sluice-import',
  );

  console.log('\nImport complete');
  console.log(`  Imported: ${result.imported}`);
  console.log(`  Skipped:  ${result.skipped}`);
  console.log(`  Total:    ${result.total}`);
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
