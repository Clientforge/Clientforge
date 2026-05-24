/**
 * Per-tenant appointment automation sequences (confirmations, reminders, follow-ups, etc.)
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.jsonb('appointment_automation_config');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('appointment_automation_config');
  });
};
