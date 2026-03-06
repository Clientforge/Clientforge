/**
 * LEADS — Core entity. Every inbound lead, always scoped by tenant_id.
 *
 * States: NEW → CONTACTED → QUALIFYING → QUALIFIED → BOOKED | UNRESPONSIVE
 */
exports.up = function (knex) {
  return knex.schema.createTable('leads', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');

    // Contact info
    table.string('first_name');
    table.string('last_name');
    table.string('phone').notNullable();
    table.string('email');
    table.string('source');

    // State machine
    table.string('status').defaultTo('NEW').notNullable();
    table.integer('qualification_score').defaultTo(0);
    table.integer('current_question_index').defaultTo(0);

    // Speed-to-lead tracking
    table.timestamp('first_contact_at');
    table.integer('speed_to_lead_ms');

    // Follow-up tracking
    table.integer('followup_step').defaultTo(0);
    table.timestamp('next_followup_at');

    // Booking
    table.boolean('booking_link_sent').defaultTo(false);
    table.timestamp('booked_at');

    // Compliance
    table.boolean('unsubscribed').defaultTo(false);
    table.timestamp('unsubscribed_at');

    // Metadata
    table.jsonb('metadata');
    table.timestamp('last_activity_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('status');
    table.index('phone');
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('leads');
};
