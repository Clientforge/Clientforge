/**
 * Booking email ingestion — forwarded confirmations to info@clientforge-ai.com
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('tenant_booking_email_aliases', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('alias', 200).notNullable();
    table.string('match_type', 20).notNullable().defaultTo('contains');
    table.integer('priority').notNullable().defaultTo(0);
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'alias']);
    table.index(['alias', 'active']);
  });

  await knex.schema.createTable('booking_email_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('message_id', 512).notNullable().unique();
    table.string('inbox_email', 254).notNullable();
    table.string('from_address', 254);
    table.string('subject', 500);
    table.text('body_text');
    table.text('body_html');
    table.timestamp('received_at');
    table.string('parse_status', 32).notNullable().defaultTo('pending');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.jsonb('parsed');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('SET NULL');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index('parse_status');
    table.index('tenant_id');
    table.index('received_at');
  });

  await knex.schema.createTable('booking_email_sync_state', (table) => {
    table.string('inbox_key', 120).primary();
    table.bigInteger('last_uid').defaultTo(0);
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('booking_email_sync_state');
  await knex.schema.dropTableIfExists('booking_email_messages');
  await knex.schema.dropTableIfExists('tenant_booking_email_aliases');
};
