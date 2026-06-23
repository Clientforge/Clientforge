/**
 * Per-tenant SMS provider for dual Twilio + Telnyx routing.
 */
exports.up = (knex) =>
  knex.schema.alterTable('tenants', (table) => {
    table.string('sms_provider', 16).nullable();
  });

exports.down = (knex) =>
  knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('sms_provider');
  });
