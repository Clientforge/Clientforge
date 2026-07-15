/**
 * Link OptiMantra appointments to Google Calendar events (Sluice bridge).
 */
exports.up = function (knex) {
  return knex.schema.alterTable('appointments', (table) => {
    table.string('google_calendar_event_id');
    table.index(['tenant_id', 'google_calendar_event_id']);
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('appointments', (table) => {
    table.dropIndex(['tenant_id', 'google_calendar_event_id']);
    table.dropColumn('google_calendar_event_id');
  });
};
