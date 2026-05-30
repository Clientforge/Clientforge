/**
 * Google Calendar OAuth connection per tenant — syncs client appointments into the appointments pipeline.
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tenant_google_calendar_connections', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      table.string('google_email');
      table.string('calendar_id').notNullable().defaultTo('primary');
      table.string('calendar_summary');

      table.text('access_token_enc');
      table.text('refresh_token_enc');
      table.timestamp('token_expires_at');

      table.text('sync_token');
      table.string('watch_channel_id');
      table.string('watch_resource_id');
      table.timestamp('watch_expiration');

      table.boolean('sync_enabled').notNullable().defaultTo(true);
      table.timestamp('last_synced_at');
      table.text('last_sync_error');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('watch_channel_id');
    })
    .createTable('calendar_sync_events', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('google_event_id').notNullable();
      table.string('sync_action').notNullable(); // processed | skipped | failed
      table.string('skip_reason');
      table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
      table.string('event_type');
      table.text('error_message');
      table.jsonb('raw_payload');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.index(['tenant_id', 'created_at']);
      table.index(['tenant_id', 'google_event_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('calendar_sync_events')
    .dropTableIfExists('tenant_google_calendar_connections');
};
