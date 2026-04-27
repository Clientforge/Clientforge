const path = require('path');

/**
 * Replaces all rows in vehicle_valuation_bands with the canonical JSON
 * (built by scripts/buildVehicleValuationBands.js from compact tuples).
 */
exports.up = async function (knex) {
  const data = require(path.join(__dirname, '../../data/vehicleValuationBands.json'));
  await knex('vehicle_valuation_bands').del();
  await knex.batchInsert('vehicle_valuation_bands', data, 100);
};

exports.down = async function (knex) {
  await knex('vehicle_valuation_bands').del();
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
