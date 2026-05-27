#!/usr/bin/env node
/**
 * One-time cleanup: normalize tenant SMS numbers to E.164 and resolve duplicates
 * (keeps the most recently updated tenant per number).
 *
 * Run from backend/: node scripts/normalizeTenantPhones.js
 */
require('dotenv').config();

const db = require('../src/db/connection');
const { normalizePhone } = require('../src/services/lead.service');
const { phonesMatch } = require('../src/services/tenant-phone.service');

async function main() {
  const result = await db.query(
    `SELECT id, name, phone_number, updated_at
     FROM tenants
     WHERE phone_number IS NOT NULL AND phone_number != ''
     ORDER BY updated_at DESC`,
  );

  const seen = new Map();
  let normalized = 0;
  let cleared = 0;

  for (const row of result.rows) {
    let e164;
    try {
      e164 = normalizePhone(row.phone_number);
    } catch {
      console.warn(`[normalize] Skipping invalid phone for "${row.name}": ${row.phone_number}`);
      continue;
    }

    if (seen.has(e164)) {
      await db.query(
        `UPDATE tenants SET phone_number = NULL, updated_at = NOW() WHERE id = $1`,
        [row.id],
      );
      cleared += 1;
      console.log(`[normalize] Cleared duplicate ${e164} from "${row.name}" (${row.id})`);
      continue;
    }

    seen.set(e164, row.id);
    if (!phonesMatch(row.phone_number, e164) || row.phone_number !== e164) {
      await db.query(
        `UPDATE tenants SET phone_number = $1, updated_at = NOW() WHERE id = $2`,
        [e164, row.id],
      );
      normalized += 1;
      console.log(`[normalize] ${row.name}: ${row.phone_number} → ${e164}`);
    }
  }

  console.log(`[normalize] Done. Normalized ${normalized}, cleared ${cleared} duplicate(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[normalize] Failed:', err.message);
  process.exit(1);
});
