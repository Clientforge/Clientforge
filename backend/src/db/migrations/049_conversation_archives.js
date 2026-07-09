/**
 * Inbox archive — hide threads without deleting messages.
 */
exports.up = function (knex) {
  return knex.schema.createTable('conversation_archives', (table) => {
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('participant_type').notNullable();
    table.uuid('participant_id').notNullable();
    table.timestamp('archived_at').defaultTo(knex.fn.now());
    table.uuid('archived_by').references('id').inTable('users').onDelete('SET NULL');

    table.primary(['tenant_id', 'participant_type', 'participant_id']);
    table.index(['tenant_id', 'archived_at']);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('conversation_archives');
};
