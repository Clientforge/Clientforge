/**
 * Persist in-flight eCW Group $export job URL for resume after restarts.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenant_ecw_connections', (table) => {
    table.text('bulk_export_status_url');
    table.timestamp('bulk_export_job_started_at');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenant_ecw_connections', (table) => {
    table.dropColumn('bulk_export_job_started_at');
    table.dropColumn('bulk_export_status_url');
  });
};
