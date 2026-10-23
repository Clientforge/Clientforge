/**
 * eClinicalWorks Backend Bulk — Group $export cursor per tenant.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenant_ecw_connections', (table) => {
    table.string('connection_mode').notNullable().defaultTo('single_patient');
    table.string('ecw_group_id');
    table.timestamp('last_bulk_export_at');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenant_ecw_connections', (table) => {
    table.dropColumn('last_bulk_export_at');
    table.dropColumn('ecw_group_id');
    table.dropColumn('connection_mode');
  });
};
