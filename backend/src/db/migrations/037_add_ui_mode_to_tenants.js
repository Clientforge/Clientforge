/**
 * ui_mode: 'simple' (Inbox-first, Podium-style) | 'full' (operator dashboard with leads/automations).
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('ui_mode').notNullable().defaultTo('simple');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('ui_mode');
  });
};
