/**
 * Add Calendly webhook config to tenants.
 * Tenant configures webhook URL: https://api.clientforge.ai/api/v1/webhook/calendly/:tenantId
 * Signing secret stored in calendly_webhook_signing_key for signature verification.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('calendly_webhook_signing_key');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('calendly_webhook_signing_key');
  });
};
