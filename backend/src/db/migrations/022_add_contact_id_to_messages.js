/**
 * Add contact_id to messages for contact-based conversations (missed-call, appointments, campaigns).
 */
exports.up = function (knex) {
  return knex.schema.alterTable('messages', (table) => {
    table.uuid('contact_id').references('id').inTable('contacts').onDelete('SET NULL');
  }).then(() => {
    return knex.raw('CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id)');
  });
};

exports.down = function (knex) {
  return knex.raw('DROP INDEX IF EXISTS idx_messages_contact_id')
    .then(() => knex.schema.alterTable('messages', (table) => {
      table.dropColumn('contact_id');
    }));
};
