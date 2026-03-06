exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.text('description');
    table.string('target_audience');
    table.string('tone').defaultTo('friendly');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('description');
    table.dropColumn('target_audience');
    table.dropColumn('tone');
  });
};
