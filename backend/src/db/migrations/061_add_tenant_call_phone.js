/**
 * Customer call number for SMS CTAs — separate from SMS outbound phone_number.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.string('call_phone');
  });

  await knex('tenants')
    .whereRaw('name ILIKE ? OR name ILIKE ?', ['%southlake%', '%autocare%'])
    .update({ call_phone: '+17709618500' });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('call_phone');
  });
};
