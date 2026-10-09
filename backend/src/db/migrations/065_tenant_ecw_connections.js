/**
 * eClinicalWorks SMART on FHIR — OAuth tokens + encounter poll cursor per tenant.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('ecw_checkout_automations').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('tenant_ecw_connections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

    table.text('fhir_base_url');
    table.string('ecw_patient_id');
    table.text('scope');

    table.text('access_token_enc');
    table.text('refresh_token_enc');
    table.timestamp('token_expires_at');

    table.boolean('poll_enabled').notNullable().defaultTo(true);
    table.timestamp('last_encounter_poll_at');
    table.text('last_poll_error');

    table.timestamp('connected_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('tenant_ecw_connections');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('ecw_checkout_automations');
  });
};
