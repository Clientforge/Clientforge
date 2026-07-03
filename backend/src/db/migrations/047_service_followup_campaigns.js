/**
 * Per-service follow-up campaigns (Sluice Drip Spa and other opted-in tenants).
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenant_services', (table) => {
    table.jsonb('follow_up_campaigns').notNullable().defaultTo('[]');
  });

  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('service_followup_campaigns_enabled').notNullable().defaultTo(false);
  });

  await knex('tenants')
    .whereRaw('name ILIKE ?', ['%Sluice Drip Spa%'])
    .update({ service_followup_campaigns_enabled: true });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('service_followup_campaigns_enabled');
  });

  await knex.schema.alterTable('tenant_services', (table) => {
    table.dropColumn('follow_up_campaigns');
  });
};
