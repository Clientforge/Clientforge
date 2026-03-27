/**
 * Tenant-level AI auto-reply for inbound SMS; per-lead/contact nullable override.
 * NULL override = use tenant default; true/false = force on/off for that thread.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('ai_auto_reply_enabled').notNullable().defaultTo(false);
  });
  await knex.schema.alterTable('leads', (table) => {
    table.boolean('ai_auto_reply_override').nullable();
  });
  await knex.schema.alterTable('contacts', (table) => {
    table.boolean('ai_auto_reply_override').nullable();
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('contacts', (table) => {
    table.dropColumn('ai_auto_reply_override');
  });
  await knex.schema.alterTable('leads', (table) => {
    table.dropColumn('ai_auto_reply_override');
  });
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('ai_auto_reply_enabled');
  });
};
