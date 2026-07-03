/**
 * Birthday Campaign — contact DOB, per-tenant config, send dedupe by calendar year.
 */
exports.up = function (knex) {
  return knex.schema
    .alterTable('contacts', (table) => {
      table.date('date_of_birth');
    })
    .alterTable('tenants', (table) => {
      table.jsonb('birthday_campaign_config');
    })
    .createTable('birthday_campaign_sends', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
      table.integer('calendar_year').notNullable();
      table.uuid('message_id').references('id').inTable('messages').onDelete('SET NULL');
      table.timestamp('sent_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'contact_id', 'calendar_year']);
      table.index(['tenant_id', 'calendar_year']);
    })
    .createTable('birthday_campaign_daily_runs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
      table.date('run_date').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());

      table.unique(['tenant_id', 'run_date']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('birthday_campaign_daily_runs')
    .dropTableIfExists('birthday_campaign_sends')
    .alterTable('tenants', (table) => {
      table.dropColumn('birthday_campaign_config');
    })
    .alterTable('contacts', (table) => {
      table.dropColumn('date_of_birth');
    });
};
