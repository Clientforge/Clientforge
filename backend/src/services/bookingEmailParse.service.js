/** Extract booking fields from forwarded confirmation email bodies. */

const US_PHONE_RE = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

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

function tryParseCombinedDateTime(datePart, timePart, tzAbbrev, fallbackTz) {
  const combined = `${datePart} ${timePart || ''}`.trim();
  const d = new Date(combined);
  if (Number.isNaN(d.getTime())) return null;
  return {
    scheduledAt: d.toISOString(),
    timezone: resolveTimezone(tzAbbrev, fallbackTz),
  };
}

function parseDateTime(text, fallbackTz = 'America/New_York') {
  const tzSuffix = '(?:\\s+(EST|EDT|PST|PDT|CST|CDT|MST|MDT|UTC))?';
  const patterns = [
    new RegExp(
      `(?:booked for|appointment (?:is|on|at)|scheduled for)\\s+`
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
    const m = text.match(re);
    if (!m) continue;
    const parsed = tryParseCombinedDateTime(m[1], m[2], m[3], fallbackTz);
    if (parsed) return parsed;
  }

  const dateOnly = pickLabelValue(text, ['Appointment date', 'Date', 'When']);
  const timeOnly = pickLabelValue(text, ['Appointment time', 'Time', 'Start time']);
  if (dateOnly && timeOnly) {
    const parsed = tryParseCombinedDateTime(dateOnly, timeOnly, null, fallbackTz);
    if (parsed) return parsed;
  }

  return { scheduledAt: null, timezone: fallbackTz };
}

function parseBusinessNameFromGreeting(text) {
  const patterns = [
    /^Hello\s+(.+?),\s*$/im,
    /^Hi\s+(.+?),\s*$/im,
    /^Dear\s+(.+?),\s*$/im,
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
  const bodyText = String(input.bodyText || '').trim()
    || stripHtml(input.bodyHtml || '');

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
    ]) || parseBusinessNameFromGreeting(bodyText);

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
    bodyTextPreview: bodyText.slice(0, 500),
  };
}

module.exports = {
  parseBookingEmail,
  normalizeBusinessName,
  stripHtml,
  parseBusinessNameFromGreeting,
  parseDateTime,
};
