exports.up = async function (knex) {
  await knex.schema.createTable('campaigns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('name').notNullable();
    table.string('type').defaultTo('broadcast');
    table.string('status').defaultTo('draft');
    table.text('message_body');
    table.jsonb('audience_filter').defaultTo('{}');
    table.jsonb('schedule').defaultTo('[]');
    table.integer('total_recipients').defaultTo(0);
    table.integer('sent_count').defaultTo(0);
    table.integer('failed_count').defaultTo(0);
    table.integer('reply_count').defaultTo(0);
    table.integer('optout_count').defaultTo(0);
    table.timestamp('launched_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
    table.index('status');
  });

  await knex.schema.createTable('campaign_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('campaign_id').notNullable().references('id').inTable('campaigns').onDelete('CASCADE');
    table.uuid('tenant_id').notNullable();
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.text('message_body').notNullable();
    table.string('status').defaultTo('pending');
    table.string('external_id');
    table.timestamp('scheduled_at');
    table.timestamp('sent_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('campaign_id');
    table.index(['status', 'scheduled_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('campaign_messages');
  await knex.schema.dropTableIfExists('campaigns');
};
