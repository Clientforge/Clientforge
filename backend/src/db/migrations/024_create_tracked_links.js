/**
 * Tracked short links for SMS (and other channels): click logging + redirect.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('tracked_links', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('token', 64).notNullable().unique();
    table.text('destination_url').notNullable();
    table.uuid('contact_id').references('id').inTable('contacts').onDelete('SET NULL');
    table.uuid('campaign_message_id').references('id').inTable('campaign_messages').onDelete('SET NULL');
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('expires_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('contact_id');
  });

  await knex.schema.createTable('link_clicks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('tracked_link_id')
      .notNullable()
      .references('id')
      .inTable('tracked_links')
      .onDelete('CASCADE');
    table.timestamp('clicked_at').defaultTo(knex.fn.now());
    table.string('user_agent', 512);
    table.string('ip_hash', 128);

    table.index('tracked_link_id');
    table.index('clicked_at');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('link_clicks');
  await knex.schema.dropTableIfExists('tracked_links');
};
