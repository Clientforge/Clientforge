/**
 * Auto shop master service classification — Southlake / Shopmonkey Phase 1.
 * Ten master categories with follow-up intervals; cached Shopmonkey service → category mappings.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('auto_shop_master_categories', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('slug').notNullable();
    table.string('name').notNullable();
    table.integer('follow_up_interval_days').notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'slug']);
    table.index(['tenant_id', 'sort_order']);
  });

  await knex.schema.createTable('auto_shop_service_mappings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.string('service_name_normalized').notNullable();
    table.string('service_name_display').notNullable();
    table.uuid('master_category_id').notNullable()
      .references('id').inTable('auto_shop_master_categories').onDelete('CASCADE');
    table.string('match_source').notNullable().defaultTo('keyword');
    table.integer('confidence').notNullable().defaultTo(80);
    table.integer('hit_count').notNullable().defaultTo(1);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'service_name_normalized']);
    table.index(['tenant_id', 'master_category_id']);
  });

  await knex.schema.createTable('auto_shop_visit_service_classifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tenant_id').notNullable().references('id').inTable('tenants').onDelete('CASCADE');
    table.uuid('appointment_id').references('id').inTable('appointments').onDelete('CASCADE');
    table.uuid('contact_id').notNullable().references('id').inTable('contacts').onDelete('CASCADE');
    table.string('shopmonkey_order_id');
    table.string('shopmonkey_service_id');
    table.string('service_name').notNullable();
    table.string('service_name_normalized').notNullable();
    table.uuid('master_category_id').notNullable()
      .references('id').inTable('auto_shop_master_categories').onDelete('CASCADE');
    table.string('match_source').notNullable();
    table.integer('confidence').notNullable().defaultTo(80);
    table.integer('follow_up_interval_days').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['tenant_id', 'appointment_id', 'service_name_normalized']);
    table.index(['tenant_id', 'contact_id']);
    table.index(['tenant_id', 'shopmonkey_order_id']);
  });

  const tenants = await knex('tenants')
    .whereRaw('name ILIKE ? OR name ILIKE ?', ['%southlake%', '%autocare%'])
    .select('id');

  const {
    MASTER_CATEGORIES,
    SEED_SERVICE_MAPPINGS,
  } = require('../../services/auto-shop-classification.constants');

  for (const tenant of tenants) {
    const categoryIds = {};
    for (const cat of MASTER_CATEGORIES) {
      const [row] = await knex('auto_shop_master_categories')
        .insert({
          tenant_id: tenant.id,
          slug: cat.slug,
          name: cat.name,
          follow_up_interval_days: cat.followUpIntervalDays,
          sort_order: cat.sortOrder,
        })
        .returning(['id', 'slug']);
      categoryIds[row.slug] = row.id;
    }

    for (const mapping of SEED_SERVICE_MAPPINGS) {
      const categoryId = categoryIds[mapping.categorySlug];
      if (!categoryId) continue;
      const normalized = mapping.serviceName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      await knex('auto_shop_service_mappings').insert({
        tenant_id: tenant.id,
        service_name_normalized: normalized,
        service_name_display: mapping.serviceName,
        master_category_id: categoryId,
        match_source: 'seed',
        confidence: 100,
        hit_count: 0,
      }).onConflict(['tenant_id', 'service_name_normalized']).ignore();
    }
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('auto_shop_visit_service_classifications');
  await knex.schema.dropTableIfExists('auto_shop_service_mappings');
  await knex.schema.dropTableIfExists('auto_shop_master_categories');
};
