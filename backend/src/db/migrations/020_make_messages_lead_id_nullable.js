/**
 * Allow messages to be sent without a lead (e.g. appointment workflows to contacts).
 */
exports.up = function (knex) {
  return knex.raw('ALTER TABLE messages ALTER COLUMN lead_id DROP NOT NULL');
};

exports.down = function (knex) {
  return knex.raw('ALTER TABLE messages ALTER COLUMN lead_id SET NOT NULL');
};
