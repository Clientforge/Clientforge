/**
 * SMS keyword opt-in: unknown numbers texting a phrase create a contact and get a welcome SMS.
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.boolean('sms_keyword_opt_in_enabled').notNullable().defaultTo(false);
    table.jsonb('sms_keyword_opt_in_phrases').notNullable().defaultTo(knex.raw(`'[]'::jsonb`));
    table.text('sms_keyword_welcome_message').defaultTo('');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('sms_keyword_welcome_message');
    table.dropColumn('sms_keyword_opt_in_phrases');
    table.dropColumn('sms_keyword_opt_in_enabled');
  });
};
