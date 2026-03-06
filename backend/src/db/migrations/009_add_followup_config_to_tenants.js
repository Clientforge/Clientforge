/**
 * Add per-tenant follow-up configuration.
 *
 * followup_config stores:
 *   - schedule: array of { step, delay_hours, message }
 *   - outreach_window: { enabled, start_hour, end_hour, days }
 *   - initial_message: template for first contact SMS
 *   - booking_message: template for booking link SMS
 */
exports.up = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.jsonb('followup_config').defaultTo(JSON.stringify({
      schedule: [
        { step: 1, delay_hours: 1,   message: "Hey {firstName}, just checking — did you get a chance to book your appointment with {businessName}? Here's the link: {bookingLink}" },
        { step: 2, delay_hours: 4,   message: "Hi {firstName}, spots are filling up! Book yours now: {bookingLink}" },
        { step: 3, delay_hours: 24,  message: "Hi {firstName}, just a friendly reminder — we'd love to help you out. Book here: {bookingLink}" },
        { step: 4, delay_hours: 48,  message: "Hey {firstName}, we've still got a spot reserved for you at {businessName}. Don't miss out: {bookingLink}" },
        { step: 5, delay_hours: 72,  message: "Hi {firstName}, this is your last few days to grab your appointment. Book now: {bookingLink}" },
        { step: 6, delay_hours: 120, message: "{firstName}, we don't want you to miss out. Schedule your visit today: {bookingLink}" },
        { step: 7, delay_hours: 168, message: "Hi {firstName}, final reminder from {businessName}. We'd love to see you — book anytime here: {bookingLink}" }
      ],
      outreach_window: {
        enabled: true,
        start_hour: 9,
        end_hour: 19,
        days: ["mon", "tue", "wed", "thu", "fri", "sat"]
      }
    }));
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('tenants', (table) => {
    table.dropColumn('followup_config');
  });
};
