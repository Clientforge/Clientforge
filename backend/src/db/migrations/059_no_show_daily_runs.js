/**
 * Daily run lock for Sluice no-show batch (7 PM clinic timezone).
 */
exports.up = function (knex) {
  return knex.schema.createTable('no_show_daily_runs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.date('run_date').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['tenant_id', 'run_date']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('no_show_daily_runs');
};
