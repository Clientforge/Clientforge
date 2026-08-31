/**
 * Shopmonkey deferred services — Southlake Autocare retention follow-ups.
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('shopmonkey_deferred_services', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
      table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');

      table.string('shopmonkey_customer_id').notNullable();
      table.string('shopmonkey_order_id');
      table.string('shopmonkey_deferred_id').notNullable();
      table.string('service_name').notNullable();
      table.string('vehicle_label');
      table.timestamp('deferred_at');
      table.string('deferred_reason');
      table.integer('total_cents');

      table.string('status').notNullable().defaultTo('pending');
      table.jsonb('raw_payload');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'shopmonkey_deferred_id']);
      table.index(['tenant_id', 'contact_id', 'status']);
      table.index(['tenant_id', 'shopmonkey_order_id']);
    })
    .alterTable('tenant_shopmonkey_connections', (table) => {
      table.boolean('deferred_followup_enabled').notNullable().defaultTo(true);
      table.integer('deferred_followup_days').notNullable().defaultTo(3);
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('tenant_shopmonkey_connections', (table) => {
      table.dropColumn('deferred_followup_enabled');
      table.dropColumn('deferred_followup_days');
    })
    .dropTableIfExists('shopmonkey_deferred_services');
};
