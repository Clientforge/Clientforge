/**
 * G2G — worst/best dollar bands by make, model, and model-year span.
 * `year_from` / `year_to` are **inclusive**. Overlapping ranges: lookup prefers the **narrower** span.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('vehicle_valuation_bands', (table) => {
    table.increments('id').primary();
    table.text('make').notNullable();
    table.text('model').notNullable();
    table.integer('year_from').notNullable();
    table.integer('year_to').notNullable();
    table.integer('worst_min').notNullable();
    table.integer('worst_max').notNullable();
    table.integer('best_min').notNullable();
    table.integer('best_max').notNullable();
  });

  await knex.raw(`
    CREATE INDEX vehicle_valuation_bands_lookup_idx
    ON vehicle_valuation_bands (lower(btrim(make)), lower(btrim(model)), year_from, year_to);
  `);

  /** Corolla (Toyota) — from provided JSON; 2019–2021 best is single value → min=max. */
  const corolla = [
    [2000, 2003, 105, 150, 515, 1780],
    [2003, 2005, 150, 395, 1385, 1780],
    [2005, 2008, 250, 395, 1385, 1730],
    [2009, 2012, 285, 445, 2585, 3600],
    [2013, 2015, 480, 485, 3795, 3945],
    [2016, 2018, 405, 575, 3785, 4635],
    [2019, 2021, 480, 620, 4755, 4755],
  ].map(([year_from, year_to, worst_min, worst_max, best_min, best_max]) => ({
    make: 'Toyota',
    model: 'Corolla',
    year_from,
    year_to,
    worst_min: Math.min(worst_min, worst_max),
    worst_max: Math.max(worst_min, worst_max),
    best_min: Math.min(best_min, best_max),
    best_max: Math.max(best_min, best_max),
  }));

  await knex('vehicle_valuation_bands').insert(corolla);
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('vehicle_valuation_bands');
};
