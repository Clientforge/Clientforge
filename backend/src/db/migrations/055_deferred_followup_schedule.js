/**
 * Multi-step deferred service follow-up schedule (days after visit).
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenant_shopmonkey_connections', (table) => {
    table.jsonb('deferred_followup_schedule').notNullable().defaultTo('[7,14,30,60]');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenant_shopmonkey_connections', (table) => {
    table.dropColumn('deferred_followup_schedule');
  });
};
