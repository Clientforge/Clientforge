/**
 * FOLLOW_UPS — Scheduled follow-up messages (7-step sequence).
 *
 * Each row is one step for one lead. The worker picks up rows
 * where scheduled_at <= now and status = 'pending'.
 */
exports.up = function (knex) {
  return knex.schema.createTable('follow_ups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');

    table.integer('step').notNullable(); // 1 through 7
    table.text('message_body');
    table.string('status').defaultTo('pending'); // 'pending', 'sent', 'cancelled'

    table.timestamp('scheduled_at').notNullable();
    table.timestamp('sent_at');
    table.timestamp('cancelled_at');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['status', 'scheduled_at']);
    table.index('lead_id');
    table.index('tenant_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('follow_ups');
};
