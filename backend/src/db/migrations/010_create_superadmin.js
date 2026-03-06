const bcrypt = require('bcryptjs');

/**
 * Create a platform-level tenant and the first superadmin user.
 * Superadmins see metrics across all tenants.
 */
exports.up = async function (knex) {
  const platformTenantId = '00000000-0000-0000-0000-000000000001';

  await knex.raw(`
    INSERT INTO tenants (id, name, industry, plan, active)
    VALUES ('${platformTenantId}', 'Leadflow AI Platform', 'Platform', 'platform', true)
    ON CONFLICT (id) DO NOTHING
  `);

  const passwordHash = await bcrypt.hash('admin123', 12);

  await knex.raw(`
    INSERT INTO users (tenant_id, email, password_hash, first_name, last_name, role, active)
    VALUES ('${platformTenantId}', 'admin@leadflow.ai', '${passwordHash}', 'Platform', 'Admin', 'superadmin', true)
    ON CONFLICT DO NOTHING
  `);
};

exports.down = async function (knex) {
  await knex.raw(`DELETE FROM users WHERE role = 'superadmin'`);
  await knex.raw(`DELETE FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001'`);
};
