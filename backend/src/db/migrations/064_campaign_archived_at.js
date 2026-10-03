exports.up = (knex) =>
  knex.schema.alterTable('campaigns', (table) => {
    table.timestamp('archived_at').nullable();
    table.index(['tenant_id', 'archived_at']);
  });

exports.down = (knex) =>
  knex.schema.alterTable('campaigns', (table) => {
    table.dropIndex(['tenant_id', 'archived_at']);
    table.dropColumn('archived_at');
  });
