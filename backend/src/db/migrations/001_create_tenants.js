/**
 * TENANTS — Each business is a tenant with isolated data.
 */
exports.up = function (knex) {
  return knex.schema.createTable('tenants', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.string('industry');
    table.string('timezone').defaultTo('America/New_York');
    table.string('phone_number');
    table.string('booking_link');
    table.string('plan').defaultTo('starter');
    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('tenants');
};
