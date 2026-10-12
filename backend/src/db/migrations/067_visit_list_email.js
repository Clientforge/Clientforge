/**
 * Daily visit CSV emails (Bay Area Heart interim) → post-visit review automations.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('visit_list_email_automations').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('visit_list_email_messages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('message_id', 512).notNullable().unique();
    table.string('inbox_email', 320).notNullable();
    table.string('from_address', 512);
    table.string('subject', 1024);
    table.timestamp('received_at');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.string('parse_status', 64).notNullable();
    table.jsonb('stats');
    table.text('error_message');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'created_at']);
    table.index('parse_status');
  });

  await knex('tenants')
    .where(function whereBayArea() {
      this.where('name', 'ilike', '%Bay Area Heart%')
        .orWhere('name', 'ilike', '%Bay Area%Health%');
    })
    .update({ visit_list_email_automations: true });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('visit_list_email_messages');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('visit_list_email_automations');
  });
};
