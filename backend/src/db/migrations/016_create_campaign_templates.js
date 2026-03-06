/**
 * Campaign templates — Reusable campaign structures for future campaigns.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('campaign_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('channel').defaultTo('sms');
    table.jsonb('schedule').defaultTo('[]');
    table.jsonb('audience_filter').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('campaign_templates');
};
