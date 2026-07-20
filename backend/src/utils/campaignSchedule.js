const { DEFAULT_TIMEZONE } = require('./tenantTimezone');

const DEFAULT_SEND_TIME = '10:00';

const getLocalParts = (date, timeZone) => {
  const tz = timeZone || DEFAULT_TIMEZONE;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
  };
};

const addCalendarDays = ({ year, month, day }, days) => {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
};

/**
 * Convert a wall-clock datetime in `timeZone` to a UTC Date.
 */
const zonedTimeToUtc = ({ year, month, day, hour, minute }, timeZone) => {
  const tz = timeZone || DEFAULT_TIMEZONE;
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let i = 0; i < 8; i += 1) {
    const parts = getLocalParts(new Date(utcMs), tz);
    const targetDayMs = Date.UTC(year, month - 1, day);
    const actualDayMs = Date.UTC(parts.year, parts.month - 1, parts.day);
    const dayDiff = Math.round((targetDayMs - actualDayMs) / 86400000);
    const minuteDiff = dayDiff * 24 * 60
      + ((hour * 60 + minute) - (parts.hour * 60 + parts.minute));

    if (minuteDiff === 0) break;
    utcMs += minuteDiff * 60 * 1000;
  }

  return new Date(utcMs);
};

/**
 * Parse HH:MM or legacy numeric hour (birthday-style).
 * @returns {{ hour: number, minute: number } | null}
 */
const parseSendTime = (value) => {
  if (value == null || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const hour = Math.floor(value);
    if (hour >= 0 && hour <= 23) return { hour, minute: 0 };
    return null;
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

/**
 * Schedule a campaign wave in the tenant timezone.
 * Without send_time, preserves legacy behavior (launch + delay_days × 24h).
 */
const computeWaveScheduledAt = ({
  launchedAt,
  delayDays = 0,
  sendTime,
  timezone,
}) => {
  const anchor = launchedAt instanceof Date ? launchedAt : new Date(launchedAt);
  const days = Math.max(0, parseInt(delayDays, 10) || 0);
  const parsed = parseSendTime(sendTime);

  if (!parsed) {
    return new Date(anchor.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const tz = timezone || DEFAULT_TIMEZONE;
  const launchLocal = getLocalParts(anchor, tz);
  const targetDate = addCalendarDays(launchLocal, days);
  const scheduled = zonedTimeToUtc({
    ...targetDate,
    hour: parsed.hour,
    minute: parsed.minute,
  }, tz);

  if (days === 0 && scheduled <= anchor) {
    return anchor;
  }

  return scheduled;
};

const formatSendTimeLabel = (sendTime, timeZone = DEFAULT_TIMEZONE) => {
  const parsed = parseSendTime(sendTime);
  if (!parsed) return null;

  const probe = zonedTimeToUtc({
    year: 2026,
    month: 6,
    day: 15,
    hour: parsed.hour,
    minute: parsed.minute,
  }, timeZone);

  return probe.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  });
};

const normalizeScheduleWave = (wave) => {
  if (!wave || typeof wave !== 'object') return wave;
  const out = { ...wave };
  if (out.send_time == null && out.sendTime != null) {
    out.send_time = out.sendTime;
    delete out.sendTime;
  }
  if (out.send_time == null && out.send_hour != null) {
    const hour = parseInt(out.send_hour, 10);
    if (hour >= 0 && hour <= 23) {
      out.send_time = `${String(hour).padStart(2, '0')}:00`;
    }
  }
  return out;
};

const normalizeSchedule = (schedule) => {
  if (!Array.isArray(schedule)) return [];
  return schedule.map(normalizeScheduleWave);
};

module.exports = {
  DEFAULT_SEND_TIME,
  parseSendTime,
  computeWaveScheduledAt,
  formatSendTimeLabel,
  normalizeSchedule,
  normalizeScheduleWave,
  zonedTimeToUtc,
  getLocalParts,
};
