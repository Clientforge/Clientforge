/**
 * Read-only: list superadmin users and G2G SMS tenant / notify env.
 * Run on Render shell (backend dir): node scripts/checkG2gAndSuperadmin.js
 */
require('dotenv').config();

const db = require('../src/db/connection');

const PLATFORM_TENANT = '00000000-0000-0000-0000-000000000001';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[check] DATABASE_URL is not set');
    process.exit(1);
  }

  const admins = await db.query(
    `SELECT email, active, tenant_id, created_at
     FROM users WHERE role = 'superadmin' ORDER BY email`,
  );
  console.log(`\nSuperadmin accounts (${admins.rows.length}):`);
  if (admins.rows.length === 0) {
    console.log('  (none — create one or re-run migration 010 on a fresh DB)');
  } else {
    for (const r of admins.rows) {
      console.log(`  • ${r.email}  ${r.active ? 'active' : 'INACTIVE'}  tenant=${r.tenant_id}`);
    }
  }
  console.log('\n  Login URL: https://app.clientforge-ai.com/admin/login');
  console.log('  (Passwords are hashed in DB — not shown here.)');
  console.log('  Reset lockout: SUPERADMIN_EMAIL=… SUPERADMIN_NEW_PASSWORD=… node scripts/resetSuperadminPassword.js');
  console.log('  Dev seed from migration 010: admin@clientforge.ai / admin123 (if never changed)\n');

  const g2gTenantId = process.env.G2G_SELL_INTENT_TENANT_ID?.trim() || PLATFORM_TENANT;
  const t = await db.query(
    'SELECT id, name, phone_number, sms_provider FROM tenants WHERE id = $1',
    [g2gTenantId],
  );
  console.log('G2G outbound SMS tenant (G2G_SELL_INTENT_TENANT_ID or platform default):');
  if (!t.rows[0]) {
    console.log(`  Tenant not found: ${g2gTenantId}`);
  } else {
    const row = t.rows[0];
    console.log(`  Name: ${row.name}`);
    console.log(`  ID:   ${row.id}`);
    console.log(`  SMS phone:    ${row.phone_number || '(empty → platform TWILIO/TELNYX default)'}`);
    console.log(`  SMS provider: ${row.sms_provider || '(auto)'}`);
  }

  console.log('\nG2G notify env (estimate SMS recipients):');
  console.log(`  G2G_ESTIMATE_NOTIFY_PHONES: ${process.env.G2G_ESTIMATE_NOTIFY_PHONES || '(unset)'}`);
  console.log(`  G2G_ESTIMATE_NOTIFY_PHONE:  ${process.env.G2G_ESTIMATE_NOTIFY_PHONE || '(unset)'}`);
  console.log(`  G2G_SELL_NOTIFY_PHONE:      ${process.env.G2G_SELL_NOTIFY_PHONE || '(unset)'}`);
  console.log('\nPlatform Telnyx default:');
  console.log(
    `  TELNYX_PHONE_NUMBER: ${process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_DEFAULT_FROM || '(unset)'}`,
  );
  console.log(`  SMS_MODE: ${process.env.SMS_MODE || 'mock'}\n`);

  await db.pool.end();
}

main().catch((err) => {
  console.error('[check]', err.message);
  process.exit(1);
});
