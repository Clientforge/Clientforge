exports.up = function (knex) {
  return knex.schema.alterTable('campaign_messages', (table) => {
    table.integer('step').defaultTo(1);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('campaign_messages', (table) => {
    table.dropColumn('step');
  });
};
