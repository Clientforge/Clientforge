/**
 * Sluice Drip Spa retention dashboard (lapsed patient segments).
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('retention_dashboard_enabled').notNullable().defaultTo(false);
  });

  await knex('tenants')
    .whereRaw('name ILIKE ?', ['%Sluice Drip Spa%'])
    .update({ retention_dashboard_enabled: true });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('retention_dashboard_enabled');
  });
};
