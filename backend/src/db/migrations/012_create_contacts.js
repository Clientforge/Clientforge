exports.up = function (knex) {
  return knex.schema.createTable('contacts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('first_name');
    table.string('last_name');
    table.string('phone').notNullable();
    table.string('email');
    table.jsonb('tags').defaultTo('[]');
    table.string('source').defaultTo('import');
    table.text('notes');
    table.timestamp('last_visit_at');
    table.boolean('unsubscribed').defaultTo(false);
    table.timestamp('unsubscribed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'phone']);
    table.index('tenant_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('contacts');
};
