/**
 * Speed up inbox queries that scan recent messages per tenant.
 */
exports.up = function (knex) {
  return knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_messages_tenant_created_at ON messages (tenant_id, created_at DESC)',
  );
};

exports.down = function (knex) {
  return knex.raw('DROP INDEX IF EXISTS idx_messages_tenant_created_at');
};
