/** Extract booking fields from forwarded confirmation email bodies. */

const US_PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const MONTH_INDEX = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const TZ_ABBREV = {
  EST: 'America/New_York',
  EDT: 'America/New_York',
  CST: 'America/Chicago',
  CDT: 'America/Chicago',
  MST: 'America/Denver',
  MDT: 'America/Denver',
  PST: 'America/Los_Angeles',
  PDT: 'America/Los_Angeles',
  UTC: 'UTC',
};

function normalizeBusinessName(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|pllc)\b\.?/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripHtml(html) {
  return String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalize line breaks and timezone suffixes before parsing. */
function normalizeEmailBodyForParsing(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(
      /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s*\n+\s*(EST|EDT|PST|PDT|CST|CDT|MST|MDT|UTC)\.?/gi,
      '$1 $2',
    )
    .replace(
      /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))\s+(EST|EDT|PST|PDT|CST|CDT|MST|MDT|UTC)\./gi,
      '$1 $2',
    );
}

function pickLabelValue(text, labels) {
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\n|\\r)${label}\\s*:?\\s*(.+?)(?:\\n|$)`, 'im');
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function parseName(raw) {
  const name = String(raw ?? '').trim();
  if (!name) return { firstName: null, lastName: null };
  const parts = name.split(/\s+/);
  return {
    firstName: parts[0] || null,
    lastName: parts.slice(1).join(' ') || null,
  };
}

function resolveTimezone(abbrev, fallbackTz) {
  if (!abbrev) return fallbackTz;
  return TZ_ABBREV[abbrev.toUpperCase()] || fallbackTz;
}

function parseWallClockParts(datePart, timePart) {
  const dateStr = String(datePart || '').trim();
  const timeStr = String(timePart || '').trim();
  if (!dateStr || !timeStr) return null;

  let year;
  let month;
  let day;

  const longDate = dateStr.match(/(?:[A-Za-z]+day,?\s+)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (longDate) {
    const monthIdx = MONTH_INDEX[longDate[1].toLowerCase()];
    if (monthIdx === undefined) return null;
    month = monthIdx + 1;
    day = Number(longDate[2]);
    year = Number(longDate[3]);
  } else {
    const slashDate = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (slashDate) {
      month = Number(slashDate[1]);
      day = Number(slashDate[2]);
      year = Number(slashDate[3]);
      if (year < 100) year += 2000;
    } else {
      const isoDate = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (!isoDate) return null;
      year = Number(isoDate[1]);
      month = Number(isoDate[2]);
      day = Number(isoDate[3]);
    }
  }

  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if (!timeMatch) return null;

  let hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const ampm = (timeMatch[3] || '').toUpperCase();

  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

  return { year, month, day, hour, minute };
}

function getTimezoneOffsetMinutesAt(ianaTz, utcDate) {
  if (ianaTz === 'UTC') return 0;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTz,
    timeZoneName: 'longOffset',
  });
  const parts = formatter.formatToParts(utcDate);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value || '';
  const match = tzPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === '+' ? 1 : -1;
  const hours = Number(match[2]);
  const mins = Number(match[3] || 0);
  return sign * (hours * 60 + mins);
}

function wallTimeInZoneToUtc(parts, ianaTz) {
  if (ianaTz === 'UTC') {
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  let utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  for (let i = 0; i < 4; i += 1) {
    const offsetMin = getTimezoneOffsetMinutesAt(ianaTz, new Date(utcMs));
    const nextUtcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
      - offsetMin * 60 * 1000;
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

  const d = new Date(utcMs);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function tryParseCombinedDateTime(datePart, timePart, tzAbbrev, fallbackTz) {
  const parts = parseWallClockParts(datePart, timePart);
  if (!parts) return null;

  const ianaTz = resolveTimezone(tzAbbrev, fallbackTz);
  const scheduledAt = wallTimeInZoneToUtc(parts, ianaTz);
  if (!scheduledAt) return null;

  return {
    scheduledAt,
    timezone: ianaTz,
  };
}

function parseDateTime(text, fallbackTz = 'America/New_York') {
  const normalized = normalizeEmailBodyForParsing(text);
  const tzSuffix = '(?:\\s+(EST|EDT|PST|PDT|CST|CDT|MST|MDT|UTC))?';
  const patterns = [
    new RegExp(
      `(?:booked for|appointment (?:is|on|at)|scheduled for|(?:has been )?rescheduled for)\\s+`
      + `([A-Za-z]+day,?\\s+[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}),?\\s+at\\s+(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))${tzSuffix}`,
      'i',
    ),
    new RegExp(
      `([A-Za-z]+day,?\\s+[A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}),?\\s+at\\s+(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))${tzSuffix}`,
      'i',
    ),
    new RegExp(
      `([A-Za-z]+\\s+\\d{1,2},?\\s+\\d{4}),?\\s+at\\s+(\\d{1,2}:\\d{2}\\s*(?:AM|PM|am|pm))${tzSuffix}`,
      'i',
    ),
    /(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+at\s+(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i,
    /(\d{4}-\d{2}-\d{2}),?\s+at\s+(\d{1,2}:\d{2})/i,
  ];

  for (const re of patterns) {
    const m = normalized.match(re);
    if (!m) continue;
    const parsed = tryParseCombinedDateTime(m[1], m[2], m[3], fallbackTz);
    if (parsed) return parsed;
  }

  const dateOnly = pickLabelValue(normalized, ['Appointment date', 'Date', 'When']);
  const timeOnly = pickLabelValue(normalized, ['Appointment time', 'Time', 'Start time']);
  if (dateOnly && timeOnly) {
    const parsed = tryParseCombinedDateTime(dateOnly, timeOnly, null, fallbackTz);
    if (parsed) return parsed;
  }

  return { scheduledAt: null, timezone: fallbackTz };
}

function parseBusinessNameFromGreeting(text) {
  const patterns = [
    /^Hello\s+(.+?)(?:,\s*|\s*\n\s*)/im,
    /^Hi\s+(.+?)(?:,\s*|\s*\n\s*)/im,
    /^Dear\s+(.+?)(?:,\s*|\s*\n\s*)/im,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return null;
}

function detectEventType(subject, text) {
  const blob = `${subject} ${text}`.toLowerCase();
  if (/\b(cancelled|canceled|cancellation)\b/.test(blob)) return 'booking.cancelled';
  if (/\b(rescheduled|reschedule|updated appointment|changed)\b/.test(blob)) return 'booking.rescheduled';
  return 'booking.created';
}

function detectProvider(fromAddress, subject, text) {
  const from = String(fromAddress || '').toLowerCase();
  const blob = `${from} ${subject} ${text}`.toLowerCase();
  if (from.includes('glossgenius') || blob.includes('glossgenius')) return 'email_glossgenius';
  if (from.includes('squareup') || from.includes('square.com') || blob.includes('square appointments')) {
    return 'email_square';
  }
  if (from.includes('vagaro')) return 'email_vagaro';
  if (from.includes('calendly')) return 'email_calendly';
  return 'email_forward';
}

/**
 * @param {{ subject?: string, fromAddress?: string, bodyText?: string, bodyHtml?: string }} input
 */
function parseBookingEmail(input) {
  const subject = String(input.subject || '').trim();
  const fromAddress = String(input.fromAddress || '').trim();
  const rawBody = String(input.bodyText || '').trim() || stripHtml(input.bodyHtml || '');
  const bodyText = normalizeEmailBodyForParsing(rawBody);

  const eventType = detectEventType(subject, bodyText);
  const provider = detectProvider(fromAddress, subject, bodyText);

  const customerName =
    pickLabelValue(bodyText, [
      'Client name',
      'Customer name',
      'Guest name',
      'Name',
      'Client',
      'Customer',
    ]) || null;

  const businessName =
    pickLabelValue(bodyText, [
      'Business name',
      'Business',
      'Salon',
      'Location name',
      'Location',
      'With',
    ]) || parseBusinessNameFromGreeting(rawBody);

  const serviceName =
    pickLabelValue(bodyText, [
      'Service',
      'Services',
      'Appointment type',
      'Treatment',
      'Booked service',
    ]) || null;

  let customerEmail =
    pickLabelValue(bodyText, ['Client email', 'Customer email', 'Email', 'Guest email']) || null;
  if (!customerEmail) {
    const emails = bodyText.match(EMAIL_RE) || [];
    customerEmail = emails.find((e) => !e.toLowerCase().includes('clientforge-ai.com')) || null;
  }

  let customerPhone =
    pickLabelValue(bodyText, [
      'Client phone',
      'Customer phone',
      'Phone Number',
      'Phone number',
      'Phone',
      'Mobile',
      'Cell',
    ]) || null;
  if (!customerPhone) {
    const phones = bodyText.match(US_PHONE_RE) || [];
    customerPhone = phones[0] || null;
  }

  const { firstName, lastName } = parseName(customerName);
  const { scheduledAt, timezone } = parseDateTime(bodyText);

  const confidence =
    (scheduledAt ? 0.35 : 0)
    + (businessName ? 0.25 : 0)
    + (firstName ? 0.15 : 0)
    + (customerPhone || customerEmail ? 0.15 : 0)
    + (serviceName ? 0.1 : 0);

  return {
    eventType,
    provider,
    businessName,
    serviceName,
    customerName,
    customerEmail,
    customerPhone,
    firstName,
    lastName,
    scheduledAt,
    timezone,
    confidence: Math.min(1, confidence),
    bodyTextPreview: rawBody.slice(0, 500),
  };
}

module.exports = {
  parseBookingEmail,
  normalizeBusinessName,
  stripHtml,
  normalizeEmailBodyForParsing,
  parseBusinessNameFromGreeting,
  parseDateTime,
  wallTimeInZoneToUtc,
  parseWallClockParts,
};
