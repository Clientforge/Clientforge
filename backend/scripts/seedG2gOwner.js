/**
 * Create or update a Grace to Grace owner account (username + password).
 *
 * Required env: G2G_OWNER_USERNAME, G2G_OWNER_PASSWORD
 * Run from backend/: node scripts/seedG2gOwner.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/db/connection');
const { SALT_ROUNDS } = require('../src/services/g2gOwnerAuth.service');

async function main() {
  const username = process.env.G2G_OWNER_USERNAME;
  const password = process.env.G2G_OWNER_PASSWORD;

  if (!username || !password) {
    console.error('[seedG2gOwner] Set G2G_OWNER_USERNAME and G2G_OWNER_PASSWORD in .env');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[seedG2gOwner] Password must be at least 8 characters');
    process.exit(1);
  }

  const u = String(username).trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const existing = await db.query('SELECT id FROM g2g_owner_accounts WHERE username = $1', [u]);

  if (existing.rows.length > 0) {
    await db.query(
      `UPDATE g2g_owner_accounts
       SET password_hash = $2, active = true, updated_at = NOW()
       WHERE username = $1`,
      [u, passwordHash],
    );
    console.log(`[seedG2gOwner] Updated password for "${u}"`);
  } else {
    await db.query(
      `INSERT INTO g2g_owner_accounts (username, password_hash, active)
       VALUES ($1, $2, true)`,
      [u, passwordHash],
    );
    console.log(`[seedG2gOwner] Created owner "${u}"`);
  }

  await db.pool.end();
}

main().catch((err) => {
  console.error('[seedG2gOwner]', err);
  process.exit(1);
});
