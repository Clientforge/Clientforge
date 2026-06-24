/**
 * OptiMantra outbound webhook secret (optional verification header).
 * Webhook URL: https://app.clientforge-ai.com/api/v1/webhook/optimantra/:tenantId
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('optimantra_webhook_secret');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('optimantra_webhook_secret');
  });
};
