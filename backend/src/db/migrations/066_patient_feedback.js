/**
 * Private review feedback (1–3 stars) captured per tenant — Bay Area Heart first.
 */
exports.up = async function up(knex) {
  await knex.schema.alterTable('tenants', (table) => {
    table.boolean('patient_feedback_enabled').notNullable().defaultTo(false);
    table.string('patient_review_flow', 120);
  });

  await knex.schema.createTable('patient_feedback', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('review_flow', 120).notNullable();
    table.smallint('stars').notNullable();
    table.jsonb('categories').notNullable().defaultTo('[]');
    table.text('comment');
    table.timestamp('submitted_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'submitted_at']);
    table.index('review_flow');
  });

  await knex('tenants')
    .where(function whereBayArea() {
      this.where('name', 'ilike', '%Bay Area Heart%')
        .orWhere('name', 'ilike', '%Bay Area%Health%');
    })
    .update({
      patient_feedback_enabled: true,
      patient_review_flow: 'bay-area-heart-review',
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('patient_feedback');
  await knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('patient_review_flow');
    table.dropColumn('patient_feedback_enabled');
  });
};
