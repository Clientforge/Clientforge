/**
 * APPOINTMENT_WORKFLOW_JOBS — Scheduled reminder, confirmation, post-visit, no-show messages.
 * Worker polls for scheduled_at <= NOW() and status = 'pending'.
 */
exports.up = function (knex) {
  return knex.schema.createTable('appointment_workflow_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('appointment_id').notNullable().references('id').inTable('appointments').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');

    table.string('job_type').notNullable(); // confirmation | reminder | reschedule | cancellation | post_visit | no_show
    table.string('channel').defaultTo('sms'); // sms | email
    table.text('message_body');
    table.string('email_subject');

    table.timestamp('scheduled_at').notNullable();
    table.string('status').defaultTo('pending'); // pending | sent | cancelled | failed
    table.timestamp('sent_at');
    table.timestamp('cancelled_at');

    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index(['tenant_id', 'status', 'scheduled_at']);
    table.index('appointment_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('appointment_workflow_jobs');
};
