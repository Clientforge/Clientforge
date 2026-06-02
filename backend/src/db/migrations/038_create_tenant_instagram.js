/**
 * Instagram DM connection per tenant (Meta / Messenger Platform for Instagram).
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('tenant_instagram_connections', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().unique().references('id').inTable('tenants').onDelete('CASCADE');

      table.string('page_id').notNullable();
      table.string('page_name');
      table.string('instagram_business_account_id').notNullable();
      table.string('instagram_username');

      table.text('access_token_enc').notNullable();
      table.timestamp('token_expires_at');

      table.boolean('sync_enabled').notNullable().defaultTo(true);
      table.text('last_webhook_error');

      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('instagram_business_account_id');
      table.index('page_id');
    })
    .createTable('instagram_conversations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.string('instagram_user_id', 64).notNullable();
      table.string('instagram_username');
      table.string('display_name');
      table.uuid('contact_id').references('id').inTable('contacts').onDelete('SET NULL');
      table.boolean('ai_auto_reply_override');
      table.timestamp('last_message_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'instagram_user_id']);
      table.index(['tenant_id', 'last_message_at']);
    })
    .createTable('instagram_messages', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('conversation_id').notNullable().references('id').inTable('instagram_conversations').onDelete('CASCADE');
      table.string('direction').notNullable(); // inbound | outbound
      table.text('body').notNullable();
      table.string('meta_message_id', 128);
      table.string('message_type').defaultTo('manual'); // inbound | manual | ai_reply
      table.string('delivery_status');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'meta_message_id']);
      table.index(['conversation_id', 'created_at']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('instagram_messages')
    .dropTableIfExists('instagram_conversations')
    .dropTableIfExists('tenant_instagram_connections');
};
