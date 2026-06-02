const db = require('../db/connection');

const DEFAULT_TIMEZONE = 'America/New_York';

/** @returns {Promise<string>} IANA timezone for the tenant */
const getTenantTimezone = async (tenantId) => {
  const result = await db.query('SELECT timezone FROM tenants WHERE id = $1', [tenantId]);
  const tz = result.rows[0]?.timezone?.trim();
  return tz || DEFAULT_TIMEZONE;
};

/**
 * SQL clause: appointment falls on the current calendar day in the given timezone.
 * @param {string} scheduledAtCol - column reference (e.g. "scheduled_at" or "a.scheduled_at")
 * @param {number} tzParamIndex - 1-based $N index for the timezone bind param
 */
const scheduledTodayInTimezone = (scheduledAtCol, tzParamIndex) =>
  `(${scheduledAtCol} AT TIME ZONE $${tzParamIndex})::date = (NOW() AT TIME ZONE $${tzParamIndex})::date`;

const formatTimeInTimezone = (d, timeZone = DEFAULT_TIMEZONE) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timeZone || DEFAULT_TIMEZONE,
  });
};

module.exports = {
  DEFAULT_TIMEZONE,
  getTenantTimezone,
  scheduledTodayInTimezone,
  formatTimeInTimezone,
};
