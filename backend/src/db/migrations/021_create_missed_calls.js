/**
 * MISSED_CALLS — Log forwarded calls for text-back feature.
 * When a call is forwarded to our Twilio number (no answer/busy), we log it
 * and optionally send an SMS follow-up.
 */
exports.up = function (knex) {
  return knex.schema.createTable('missed_calls', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('contact_id').references('id').inTable('contacts').onDelete('SET NULL');

    table.string('caller_phone').notNullable();
    table.string('twilio_call_sid');
    table.string('twilio_to_number').notNullable(); // Our number that received the forwarded call

    table.timestamp('sms_sent_at'); // When we sent the follow-up SMS (null if skipped)
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index(['tenant_id', 'caller_phone', 'created_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('missed_calls');
};
