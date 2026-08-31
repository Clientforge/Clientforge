/**
 * Shopmonkey — per-tenant API key + webhook (auto-shop retention sync).
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tenant_shopmonkey_connections', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      table.text('api_key_enc');
      table.string('location_id');
      table.string('company_id');
      table.string('shop_name');

      table.text('webhook_secret');
      table.boolean('webhooks_enabled').notNullable().defaultTo(true);
      table.timestamp('last_webhook_at');
      table.text('last_webhook_error');
      table.timestamp('last_sync_at');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('shopmonkey_webhook_events', (table) => {
      table.string('webhook_id').primary();
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('table_name');
      table.string('operation');
      table.string('record_id');
      table.timestamp('processed_at').defaultTo(knex.fn.now());

      table.index(['tenant_id', 'processed_at']);
    })
    .alterTable('contacts', (table) => {
      table.string('shopmonkey_customer_id');
      table.index(['tenant_id', 'shopmonkey_customer_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('contacts', (table) => {
      table.dropIndex(['tenant_id', 'shopmonkey_customer_id']);
      table.dropColumn('shopmonkey_customer_id');
    })
    .dropTableIfExists('shopmonkey_webhook_events')
    .dropTableIfExists('tenant_shopmonkey_connections');
};
