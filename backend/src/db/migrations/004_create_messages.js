/**
 * MESSAGES — Every SMS sent or received, tied to a lead conversation.
 */
exports.up = function (knex) {
  return knex.schema.createTable('messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');

    // Message content
    table.string('direction').notNullable(); // 'inbound' or 'outbound'
    table.text('body').notNullable();
    table.string('from_number');
    table.string('to_number');

    // Twilio tracking
    table.string('twilio_sid');
    table.string('delivery_status');

    // Context
    table.string('message_type'); // 'initial', 'qualification', 'followup', 'booking', 'manual'

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('lead_id');
    table.index(['lead_id', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('messages');
};
