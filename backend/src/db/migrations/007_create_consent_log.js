/**
 * CONSENT_LOG — Compliance audit trail.
 *
 * Records when and how consent was given or revoked.
 * Critical for TCPA compliance.
 */
exports.up = function (knex) {
  return knex.schema.createTable('consent_log', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('lead_id').notNullable().references('id').inTable('leads').onDelete('CASCADE');

    table.string('event_type').notNullable(); // 'consent_given', 'opt_out', 'opt_in'
    table.string('source'); // 'web_form', 'ad_platform', 'manual', 'sms_stop', 'sms_start'
    table.string('ip_address');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('lead_id');
    table.index('tenant_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('consent_log');
};
