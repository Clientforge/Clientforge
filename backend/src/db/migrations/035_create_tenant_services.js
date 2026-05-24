/**
 * Per-tenant service catalog with return intervals for service-based rebooking.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('tenant_services', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name', 200).notNullable();
    table.jsonb('aliases').defaultTo('[]');
    table.integer('return_interval_days');
    table.boolean('rebooking_enabled').notNullable().defaultTo(true);
    table.text('rebook_message');
    table.string('rebook_email_subject', 500);
    table.text('notes');
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'name']);
    table.index('tenant_id');
  });

  await knex.schema.alterTable('appointments', (table) => {
    table.uuid('matched_service_id').references('id').inTable('tenant_services').onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('appointments', (table) => {
    table.dropColumn('matched_service_id');
  });
  await knex.schema.dropTableIfExists('tenant_services');
};
