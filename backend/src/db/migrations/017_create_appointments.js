/**
 * APPOINTMENTS — Booking events from Calendly, Acuity, etc.
 * Canonical record per booking, linked to contact.
 */
exports.up = function (knex) {
  return knex.schema.createTable('appointments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');

    table.string('external_id').notNullable(); // Provider's booking ID (e.g. Calendly invitee URI)
    table.string('provider').notNullable().defaultTo('calendly'); // calendly | acuity | square
    table.string('status').notNullable().defaultTo('scheduled'); // scheduled | confirmed | rescheduled | cancelled | completed | no_show

    table.timestamp('scheduled_at').notNullable();
    table.string('timezone').defaultTo('America/New_York');
    table.string('service_name');
    table.integer('duration_minutes');

    table.jsonb('raw_payload'); // For debugging/audit
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'external_id']);
    table.index('tenant_id');
    table.index('contact_id');
    table.index(['tenant_id', 'status']);
    table.index(['tenant_id', 'scheduled_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('appointments');
};
