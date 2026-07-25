/**
 * AMY — behavioral health client management (separate from ClientForge contacts).
 */
exports.up = function (knex) {
  return knex.schema
    .createTable('amy_clients', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.timestamp('date_of_birth');
      table.text('diagnosis');
      table.string('insurance_provider');
      table.string('insurance_id');
      table.timestamp('authorization_start');
      table.timestamp('authorization_end');
      table.text('notes');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('amy_authorizations', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('client_id').notNullable().references('id').inTable('amy_clients').onDelete('CASCADE');
      table.string('service_type').notNullable(); // SUPERVISION | ASSESSMENT | PARENT_TRAINING
      table.integer('authorized_minutes').notNullable();
      table.string('unit_display').notNullable().defaultTo('UNITS');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.unique(['client_id', 'service_type']);
    })
    .createTable('amy_rbts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('email');
      table.text('work_schedule').notNullable().defaultTo('[]');
      table.float('supervision_percentage').notNullable().defaultTo(5);
      table.boolean('is_active').notNullable().defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('amy_sessions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('client_id').notNullable().references('id').inTable('amy_clients').onDelete('CASCADE');
      table.uuid('rbt_id').references('id').inTable('amy_rbts').onDelete('SET NULL');
      table.string('service_type').notNullable();
      table.timestamp('date').notNullable();
      table.integer('duration_minutes').notNullable();
      table.text('notes');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['client_id', 'date']);
    })
    .createTable('amy_case_notes', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('client_id').notNullable().references('id').inTable('amy_clients').onDelete('CASCADE');
      table.timestamp('date').notNullable();
      table.string('title');
      table.text('content').notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['client_id', 'date']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('amy_case_notes')
    .dropTableIfExists('amy_sessions')
    .dropTableIfExists('amy_rbts')
    .dropTableIfExists('amy_authorizations')
    .dropTableIfExists('amy_clients');
};
