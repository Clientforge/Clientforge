exports.up = async function (knex) {
  await knex.schema.alterTable('campaigns', (table) => {
    table.string('channel').defaultTo('sms');
  });

  await knex.schema.alterTable('campaign_messages', (table) => {
    table.string('channel').defaultTo('sms');
    table.string('email_subject');
  });

  await knex.schema.alterTable('tenants', (table) => {
    table.string('email_from_name');
    table.string('email_from_address');
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable('campaigns', (table) => {
    table.dropColumn('channel');
  });
  await knex.schema.alterTable('campaign_messages', (table) => {
    table.dropColumn('channel');
    table.dropColumn('email_subject');
  });
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('email_from_name');
    table.dropColumn('email_from_address');
  });
};
