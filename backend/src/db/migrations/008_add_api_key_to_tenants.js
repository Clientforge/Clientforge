/**
 * Add api_key to tenants for external webhook authentication.
 * Forms, ad platforms, and Zapier use this key to push leads
 * without needing a JWT.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.string('api_key').unique();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('api_key');
  });
};
