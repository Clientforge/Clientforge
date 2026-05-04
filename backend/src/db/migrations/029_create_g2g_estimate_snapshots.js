/**
 * Grace to Grace — funnel analytics: each time a user sees an estimate (before Sell now).
 */
exports.up = async function (knex) {
  await knex.schema.createTable('g2g_estimate_snapshots', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.string('source', 48).notNullable();
    table.string('session_id', 80);
    table.jsonb('input').notNullable();
    table.jsonb('result').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('created_at');
    table.index('source');
    table.index(['tenant_id', 'created_at']);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('g2g_estimate_snapshots');
};
