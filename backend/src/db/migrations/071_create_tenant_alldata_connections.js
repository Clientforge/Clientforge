/**
 * ALLDATA Manage Online — per-tenant sFTP generic export (auto-shop sync).
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tenant_alldata_connections', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      table.string('sftp_host');
      table.integer('sftp_port').notNullable().defaultTo(22);
      table.string('sftp_username');
      table.text('sftp_password_enc');
      table.text('sftp_private_key_enc');
      table.string('remote_path').notNullable().defaultTo('/');
      table.string('shop_label');

      table.boolean('sync_enabled').notNullable().defaultTo(true);
      table.boolean('deferred_followup_enabled').notNullable().defaultTo(true);
      table.jsonb('deferred_followup_schedule').notNullable().defaultTo('[7,14,30,60]');

      table.timestamp('last_sync_at');
      table.text('last_sync_error');
      table.jsonb('last_sync_stats');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('alldata_import_files', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('file_name').notNullable();
      table.string('file_fingerprint').notNullable();
      table.string('file_kind');
      table.integer('row_count');
      table.timestamp('processed_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'file_fingerprint']);
      table.index(['tenant_id', 'processed_at']);
    })
    .createTable('alldata_deferred_services', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
      table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');

      table.string('alldata_customer_id').notNullable();
      table.string('alldata_repair_order_id');
      table.string('alldata_deferred_id').notNullable();
      table.string('service_name').notNullable();
      table.string('vehicle_label');
      table.timestamp('deferred_at');
      table.timestamp('due_at');
      table.string('deferred_reason');
      table.integer('total_cents');

      table.string('status').notNullable().defaultTo('pending');
      table.jsonb('raw_payload');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'alldata_deferred_id']);
      table.index(['tenant_id', 'contact_id', 'status']);
      table.index(['tenant_id', 'alldata_repair_order_id']);
    })
    .alterTable('contacts', (table) => {
      table.string('alldata_customer_id');
      table.index(['tenant_id', 'alldata_customer_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .alterTable('contacts', (table) => {
      table.dropIndex(['tenant_id', 'alldata_customer_id']);
      table.dropColumn('alldata_customer_id');
    })
    .dropTableIfExists('alldata_deferred_services')
    .dropTableIfExists('alldata_import_files')
    .dropTableIfExists('tenant_alldata_connections');
};
