/**
 * Public landing page — Free Revenue Recovery Assessment form submissions.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('revenue_assessment_submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('practice_name', 200).notNullable();
    table.string('website', 500);
    table.string('patient_count_range', 48);
    table.string('follow_up_process', 120);
    table.text('growth_challenge');
    table.string('first_name', 80).notNullable();
    table.string('last_name', 80).notNullable();
    table.string('email', 254).notNullable();
    table.string('phone', 32);
    table.string('utm_source', 120);
    table.string('utm_medium', 120);
    table.string('utm_campaign', 120);
    table.string('utm_content', 120);
    table.string('referrer', 500);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('created_at');
    table.index('email');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('revenue_assessment_submissions');
};
