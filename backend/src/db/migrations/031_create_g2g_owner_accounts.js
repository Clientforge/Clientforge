/**
 * Grace to Grace — owner portal logins (separate from tenant dashboard users).
 */
exports.up = function (knex) {
  return knex.schema.createTable('g2g_owner_accounts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username').notNullable();
    table.string('password_hash').notNullable();
    table.boolean('active').defaultTo(true);
    table.timestamp('last_login_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['username']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('g2g_owner_accounts');
};
