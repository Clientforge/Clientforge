/**
 * USERS — Tenant staff who log into the dashboard.
 * Every user belongs to exactly one tenant.
 */
exports.up = function (knex) {
  return knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('email').notNullable();
    table.string('password_hash').notNullable();
    table.string('first_name');
    table.string('last_name');
    table.string('role').defaultTo('admin');
    table.boolean('active').defaultTo(true);
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['email', 'tenant_id']);
    table.index('tenant_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('users');
};
