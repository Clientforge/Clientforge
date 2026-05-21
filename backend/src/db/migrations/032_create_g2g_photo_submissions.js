/**
 * Grace to Grace — vehicle photo submissions tied to leads, with team review links.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('g2g_photo_submissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').references('id').inTable('tenants').onDelete('SET NULL');
    table.uuid('lead_id').references('id').inTable('leads').onDelete('SET NULL');
    table.string('review_token', 64).notNullable().unique();
    table.string('session_id', 80);
    table.jsonb('contact').notNullable();
    table.jsonb('vehicle').notNullable();
    table.jsonb('estimate').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('lead_id');
    table.index('created_at');
    table.index(['tenant_id', 'created_at']);
  });

  await knex.schema.createTable('g2g_photo_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('submission_id')
      .notNullable()
      .references('id')
      .inTable('g2g_photo_submissions')
      .onDelete('CASCADE');
    table.string('storage_path', 512).notNullable();
    table.string('mime_type', 128).notNullable();
    table.string('original_filename', 255);
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('submission_id');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('g2g_photo_files');
  await knex.schema.dropTableIfExists('g2g_photo_submissions');
};
