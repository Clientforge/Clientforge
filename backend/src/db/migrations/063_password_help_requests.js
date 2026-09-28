exports.up = async function (knex) {
  await knex.schema.createTable('password_help_requests', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email').notNullable();
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.text('message');
    table.string('status').notNullable().defaultTo('pending');
    table.timestamp('resolved_at');
    table.uuid('resolved_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['status', 'created_at']);
    table.index('email');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('password_help_requests');
};
