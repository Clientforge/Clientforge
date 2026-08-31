/**
 * Auto shop maintenance reminder SMS — Phase 2 (Southlake / Shopmonkey).
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('auto_shop_master_categories', (table) => {
    table.boolean('reminder_enabled').notNullable().defaultTo(true);
    table.text('reminder_message');
  });

  await knex.schema.alterTable('tenant_shopmonkey_connections', (table) => {
    table.boolean('maintenance_reminder_enabled').notNullable().defaultTo(true);
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('tenant_shopmonkey_connections', (table) => {
    table.dropColumn('maintenance_reminder_enabled');
  });

  await knex.schema.alterTable('auto_shop_master_categories', (table) => {
    table.dropColumn('reminder_message');
    table.dropColumn('reminder_enabled');
  });
};
