/**
 * OptiMantra Superbill Checkout — post-visit automations at checkout (OptiMantra tenants only).
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('optimantra_checkout_automations').notNullable().defaultTo(false);
  });

  await knex.schema.alterTable('contacts', (table) => {
    table.string('optimantra_patient_id');
    table.index(['tenant_id', 'optimantra_patient_id']);
  });

  await knex.schema.alterTable('appointments', (table) => {
    table.timestamp('completed_at');
  });

  await knex.schema.createTable('visit_checkouts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.string('external_id').notNullable();
    table.string('provider').notNullable().defaultTo('optimantra');
    table.timestamp('checked_out_at').notNullable();
    table.jsonb('raw_payload');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'external_id']);
    table.index(['tenant_id', 'contact_id']);
    table.index('appointment_id');
  });

  await knex.schema.createTable('visit_checkout_services', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('checkout_id').notNullable().references('id').inTable('visit_checkouts').onDelete('CASCADE');
    table.string('service_name', 500);
    table.string('service_type', 100);
    table.uuid('matched_service_id').references('id').inTable('tenant_services').onDelete('SET NULL');
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('checkout_id');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('visit_checkout_services');
  await knex.schema.dropTableIfExists('visit_checkouts');
  await knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('completed_at');
  });
  await knex.schema.alterTable('contacts', (table) => {
    table.dropColumn('optimantra_patient_id');
  });
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('optimantra_checkout_automations');
  });
};
