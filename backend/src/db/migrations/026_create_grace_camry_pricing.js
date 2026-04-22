/**
 * Grace to Grace — static Camry (2005–2017) rule table + request log.
 * Used only by the public /grace-estimate path when vehicle matches rules.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('vehicle_price_rules', (table) => {
    table.increments('id').primary();
    table.text('make').notNullable();
    table.text('model').notNullable();
    table.text('year_band').notNullable();
    table.text('condition').notNullable();
    table.integer('price_low').notNullable();
    table.integer('price_high').notNullable();
    table.unique(['make', 'model', 'year_band', 'condition'], 'vehicle_price_rules_rule_unique');
  });

  const rows = [
    ['Toyota', 'Camry', '2005-2008', 'non_running', 300, 1500],
    ['Toyota', 'Camry', '2009-2012', 'non_running', 300, 2500],
    ['Toyota', 'Camry', '2013-2015', 'non_running', 400, 3000],
    ['Toyota', 'Camry', '2016-2017', 'non_running', 500, 3200],
    ['Toyota', 'Camry', '2005-2008', 'running', 1500, 5500],
    ['Toyota', 'Camry', '2009-2012', 'running', 2000, 8000],
    ['Toyota', 'Camry', '2013-2015', 'running', 3500, 9000],
    ['Toyota', 'Camry', '2016-2017', 'running', 4500, 10500],
    ['Toyota', 'Camry', '2005-2008', 'accident', 800, 6500],
    ['Toyota', 'Camry', '2009-2012', 'accident', 1200, 7000],
    ['Toyota', 'Camry', '2013-2015', 'accident', 1500, 8000],
    ['Toyota', 'Camry', '2016-2017', 'accident', 2000, 9000],
  ].map(([make, model, year_band, condition, price_low, price_high]) => ({
    make,
    model,
    year_band,
    condition,
    price_low,
    price_high,
  }));

  await knex('vehicle_price_rules').insert(rows);

  await knex.schema.createTable('pricing_requests', (table) => {
    table.increments('id').primary();
    table.text('vin');
    table.text('make').notNullable();
    table.text('model').notNullable();
    table.integer('year').notNullable();
    table.text('condition').notNullable();
    table.integer('final_offer').notNullable();
    table.integer('price_low').notNullable();
    table.integer('price_high').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('pricing_requests');
  await knex.schema.dropTableIfExists('vehicle_price_rules');
};
