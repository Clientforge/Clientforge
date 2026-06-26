/**
 * Square Appointments OAuth + webhook routing by merchant_id.
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tenant_square_connections', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      table.string('square_merchant_id').unique();
      table.string('square_location_id');
      table.string('business_name');

      table.text('access_token_enc');
      table.text('refresh_token_enc');
      table.timestamp('token_expires_at');

      table.boolean('webhooks_enabled').notNullable().defaultTo(true);
      table.timestamp('last_webhook_at');
      table.text('last_webhook_error');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('square_merchant_id');
    })
    .createTable('square_webhook_events', (table) => {
      table.string('event_id').primary();
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('event_type');
      table.string('booking_id');
      table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
      table.timestamp('processed_at').defaultTo(knex.fn.now());

      table.index(['tenant_id', 'processed_at']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('square_webhook_events')
    .dropTableIfExists('tenant_square_connections');
};
