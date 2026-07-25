/** @typedef {'SUPERVISION' | 'ASSESSMENT' | 'PARENT_TRAINING'} ServiceType */

const SERVICE_TYPES = ['SUPERVISION', 'ASSESSMENT', 'PARENT_TRAINING'];

function minutesToUnits(minutes) {
  return Math.round((minutes / 15) * 100) / 100;
}

function hoursToMinutes(hours) {
  return Math.round(hours * 60);
}

function unitsToMinutes(units) {
  return Math.round(units * 15);
}

function parseDuration(value, unit) {
  if (unit === 'UNITS') return unitsToMinutes(value);
  return unit === 'HOURS' ? hoursToMinutes(value) : value;
}

function formatPercent(used, total) {
  if (total <= 0) return 0;
  return Math.round((used / total) * 1000) / 10;
}

function formatClientName(firstName, lastName) {
  return `${firstName} ${lastName}`;
}

function daysUntil(date) {
  if (!date) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function sumSessionMinutes(sessions, serviceType) {
  return sessions
    .filter((s) => s.service_type === serviceType || s.serviceType === serviceType)
    .reduce((sum, s) => sum + (s.duration_minutes ?? s.durationMinutes ?? 0), 0);
}

function computeAuthorizationStats(authorizedMinutes, usedMinutes, serviceType, unitDisplay = 'UNITS') {
  const remainingMinutes = Math.max(0, authorizedMinutes - usedMinutes);
  const percentUsed = formatPercent(usedMinutes, authorizedMinutes);
  const percentRemaining = authorizedMinutes > 0 ? Math.round((100 - percentUsed) * 10) / 10 : 0;
  return {
    serviceType,
    authorizedMinutes,
    usedMinutes,
    remainingMinutes,
    authorizedUnits: minutesToUnits(authorizedMinutes),
    usedUnits: minutesToUnits(usedMinutes),
    remainingUnits: minutesToUnits(remainingMinutes),
    percentUsed,
    percentRemaining,
    unitDisplay,
  };
}

module.exports = {
  SERVICE_TYPES,
  minutesToUnits,
  parseDuration,
  formatClientName,
  daysUntil,
  sumSessionMinutes,
  computeAuthorizationStats,
};
