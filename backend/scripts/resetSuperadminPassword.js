/**
 * Set a new password for a platform superadmin (production lockout recovery).
 *
 * SUPERADMIN_EMAIL=info@clientforge-ai.com SUPERADMIN_NEW_PASSWORD='…' node scripts/resetSuperadminPassword.js
 */
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('../src/db/connection');

const SALT_ROUNDS = 12;

async function main() {
  const email = (process.argv[2] || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const newPassword = process.env.SUPERADMIN_NEW_PASSWORD || '';

  if (!email) {
    console.error('[resetSuperadmin] Set SUPERADMIN_EMAIL or pass email as first argument.');
    process.exit(1);
  }
  if (!newPassword) {
    console.error('[resetSuperadmin] Set SUPERADMIN_NEW_PASSWORD in the environment (min 8 characters).');
    process.exit(1);
  }
  if (newPassword.length < 8) {
    console.error('[resetSuperadmin] Password must be at least 8 characters.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const r = await db.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE LOWER(email) = LOWER($2) AND role = 'superadmin'
     RETURNING email, active`,
    [passwordHash, email],
  );

  if (!r.rowCount) {
    console.error('[resetSuperadmin] No superadmin user updated for:', email);
    process.exit(1);
  }

  console.log(`[resetSuperadmin] Updated password for ${r.rows[0].email}`);
  await db.pool.end();
}

main().catch((err) => {
  console.error('[resetSuperadmin]', err.message);
  process.exit(1);
});
