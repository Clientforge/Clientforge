const path = require('path');

/**
 * Reload vehicle_valuation_bands from built JSON (includes supplemental makes).
 * Run `node scripts/buildVehicleValuationBands.js` before migrating.
 */
exports.up = async function (knex) {
  const data = require(path.join(__dirname, '../../data/vehicleValuationBands.json'));
  await knex('vehicle_valuation_bands').del();
  await knex.batchInsert('vehicle_valuation_bands', data, 100);
};

exports.down = async function () {
  /* Forward-only: bands data is not versioned per migration. Restore from backup if needed. */
};
