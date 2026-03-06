/**
 * QUALIFICATION_RULES — Per-tenant scoring configuration.
 *
 * Each tenant defines questions, scoring options, and a threshold.
 * The state machine uses these rules to score leads deterministically.
 */
exports.up = function (knex) {
  return knex.schema.createTable('qualification_rules', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');

    // Rule configuration stored as structured JSON
    // Format: { questions: [{ key, prompt, type, options, scores }], threshold: number }
    table.jsonb('rules').notNullable();

    // The minimum total score to reach QUALIFIED status
    table.integer('qualification_threshold').defaultTo(7);

    // Template messages for each qualification question
    table.jsonb('question_templates');

    table.boolean('active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('tenant_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('qualification_rules');
};
