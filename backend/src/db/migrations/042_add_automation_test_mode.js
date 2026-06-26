/**
 * Per-tenant automation test mode — route outbound automations to test phone/email before go-live.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.boolean('automation_test_mode').notNullable().defaultTo(false);
    table.string('automation_test_phone');
    table.string('automation_test_email');
    table.timestamp('automation_live_at');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('automation_test_mode');
    table.dropColumn('automation_test_phone');
    table.dropColumn('automation_test_email');
    table.dropColumn('automation_live_at');
  });
};
