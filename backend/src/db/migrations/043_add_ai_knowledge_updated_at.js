/**
 * Track when AI-relevant business profile fields change so conversation
 * context can exclude stale pre-update messages.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.timestamp('ai_knowledge_updated_at');
  });
  await knex('tenants').update({
    ai_knowledge_updated_at: knex.ref('updated_at'),
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('ai_knowledge_updated_at');
  });
};
