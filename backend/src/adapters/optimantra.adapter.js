/**
 * OptiMantra outbound webhook → canonical booking event (same shape as Calendly / email adapters).
 *
 * Confirmed live payload fields (Sluice Drip Spa sample):
 *   firstName, lastName, phone, email, patientDOB, apptDate, apptStartTime
 *
 * Enable in OptiMantra webhook when available: service/treatment type, appointment ID.
 */

const crypto = require('crypto');

const PHONE_KEYS = [
  'phone', 'phoneNumber', 'phone_number', 'mobile', 'mobilePhone', 'cellPhone', 'cell',
  'patientPhone', 'patient_phone', 'contactPhone', 'primaryPhone',
  'patient.phone', 'contact.phone',
];

const EMAIL_KEYS = [
  'email', 'emailAddress', 'email_address', 'patientEmail', 'patient_email',
  'patient.email', 'contact.email',
];

const FIRST_NAME_KEYS = [
  'firstName', 'first_name', 'fname', 'givenName', 'patientFirstName',
  'patient.firstName', 'patient.first_name',
];

const LAST_NAME_KEYS = [
  'lastName', 'last_name', 'lname', 'surname', 'patientLastName',
  'patient.lastName', 'patient.last_name',
];

const FULL_NAME_KEYS = [
  'name', 'fullName', 'full_name', 'patientName', 'patient_name', 'clientName',
  'patient.name', 'contact.name',
];

const APPOINTMENT_ID_KEYS = [
  'appointmentId', 'appointment_id', 'apptId', 'appt_id', 'id', 'bookingId', 'booking_id',
  'appointment.id',
];

const APPT_DATE_KEYS = [
  'apptDate', 'appt_date', 'appointmentDate', 'appointment_date', 'scheduledAt', 'scheduled_at',
  'dateTime', 'date_time',
];

const APPT_START_TIME_KEYS = ['apptStartTime', 'appt_start_time', 'startTime', 'start_time'];

const SERVICE_NAME_KEYS = [
  'serviceName', 'service_name', 'service', 'treatment', 'treatmentName', 'treatment_name',
  'appointmentType', 'appointment_type', 'procedure', 'visitType', 'visit_type', 'reason',
  'apptType', 'appt_type',
];

const TIMEZONE_KEYS = ['timezone', 'timeZone', 'time_zone', 'tz'];

const DURATION_KEYS = ['durationMinutes', 'duration_minutes', 'duration', 'length'];

const EVENT_TYPE_KEYS = ['eventType', 'event_type', 'trigger', 'action', 'event', 'status'];

const CANCEL_PATTERNS = /cancel/i;
const RESCHEDULE_PATTERNS = /reschedul/i;

const EMBEDDED_TIME_PATTERN = /\d{1,2}:\d{2}/;

function getByPath(obj, path) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path.includes('.')) return obj[path];
  return path.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, obj);
}

function pickFirst(raw, keys) {
  for (const key of keys) {
    const value = getByPath(raw, key);
    if (value == null) continue;
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function splitFullName(full) {
  const cleaned = String(full || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return { firstName: null, lastName: null };
  const parts = cleaned.split(' ');
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function hasEmbeddedTime(dateStr) {
  return EMBEDDED_TIME_PATTERN.test(String(dateStr));
}

/**
 * Parse OptiMantra apptStartTime — "20:00", "20:00:00", or "8:00 PM".
 */
function parseApptStartTime(timeStr) {
  const text = String(timeStr).trim();
  const m24 = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    return {
      hours: parseInt(m24[1], 10),
      minutes: parseInt(m24[2], 10),
    };
  }

  const m12 = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let hours = parseInt(m12[1], 10);
    const minutes = parseInt(m12[2], 10);
    const ampm = m12[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  return null;
}

/**
 * Parse OptiMantra apptDate strings and ISO timestamps to ISO string.
 * Supports "Thu Jun 25 20:00:00 2026" and "Wed Jun 11 2025 09:00:00 GMT-0400 (...)".
 */
function parseScheduledAt(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString();

  const text = String(raw).trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  return null;
}

/**
 * Resolve appointment datetime from apptDate and optional apptStartTime.
 * When apptDate has no time component, apptStartTime is applied (local server TZ).
 */
function resolveScheduledAt(payload) {
  const apptDate = pickFirst(payload, APPT_DATE_KEYS);
  const apptStartTime = pickFirst(payload, APPT_START_TIME_KEYS);

  if (!apptDate && !apptStartTime) return null;

  if (apptDate && hasEmbeddedTime(apptDate)) {
    return parseScheduledAt(apptDate);
  }

  if (apptDate && apptStartTime) {
    const base = new Date(apptDate);
    const timeParts = parseApptStartTime(apptStartTime);
    if (!Number.isNaN(base.getTime()) && timeParts) {
      base.setHours(timeParts.hours, timeParts.minutes, 0, 0);
      return base.toISOString();
    }
  }

  return parseScheduledAt(apptDate || apptStartTime);
}

function parseDurationMinutes(raw) {
  if (raw == null || raw === '') return 30;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).replace(/\D/g, ''), 10);
  if (!Number.isNaN(n) && n > 0) return n;
  return 30;
}

function resolveEventType(raw) {
  const hint = pickFirst(raw, EVENT_TYPE_KEYS);
  if (hint) {
    if (CANCEL_PATTERNS.test(hint)) return 'booking.cancelled';
    if (RESCHEDULE_PATTERNS.test(hint)) return 'booking.rescheduled';
  }

  const status = pickFirst(raw, ['status', 'appointmentStatus', 'appointment_status']);
  if (status) {
    if (CANCEL_PATTERNS.test(status)) return 'booking.cancelled';
    if (RESCHEDULE_PATTERNS.test(status)) return 'booking.rescheduled';
  }

  return 'booking.created';
}

function resolveExternalId(raw) {
  const id = pickFirst(raw, APPOINTMENT_ID_KEYS);
  if (!id) return null;
  if (String(id).startsWith('optimantra:')) return String(id);
  return `optimantra:${id}`;
}

/**
 * @param {object} raw OptiMantra webhook body (flat or lightly nested)
 * @returns {{ eventType: string, contact: object, appointment: object } | null}
 */
function normalizeOptimantraPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : raw;

  let firstName = pickFirst(payload, FIRST_NAME_KEYS);
  let lastName = pickFirst(payload, LAST_NAME_KEYS);

  if (!firstName) {
    const fromFull = splitFullName(pickFirst(payload, FULL_NAME_KEYS));
    firstName = fromFull.firstName;
    lastName = lastName || fromFull.lastName;
  }

  const phone = pickFirst(payload, PHONE_KEYS);
  const email = pickFirst(payload, EMAIL_KEYS);
  const scheduledAt = resolveScheduledAt(payload);
  const externalId = resolveExternalId(payload);
  const serviceName = pickFirst(payload, SERVICE_NAME_KEYS) || 'Appointment';
  const timezone = pickFirst(payload, TIMEZONE_KEYS) || 'America/New_York';
  const durationMinutes = parseDurationMinutes(pickFirst(payload, DURATION_KEYS));
  const eventType = resolveEventType(payload);

  if (!externalId && !scheduledAt && !phone && !email) {
    return null;
  }

  const appointmentExternalId = externalId
    || `optimantra:${cryptoFallbackId(payload, scheduledAt, phone, email)}`;

  return {
    eventType,
    contact: {
      firstName,
      lastName,
      phone,
      email,
    },
    appointment: {
      externalId: appointmentExternalId,
      provider: 'optimantra',
      scheduledAt: scheduledAt || new Date().toISOString(),
      timezone,
      serviceName,
      durationMinutes,
      rawPayload: raw,
    },
  };
}

function cryptoFallbackId(payload, scheduledAt, phone, email) {
  const seed = JSON.stringify({
    scheduledAt,
    phone,
    email,
    service: pickFirst(payload, SERVICE_NAME_KEYS),
  });
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24);
}

module.exports = {
  normalizeOptimantraPayload,
  pickFirst,
  parseScheduledAt,
  resolveScheduledAt,
  parseApptStartTime,
  resolveEventType,
  resolveExternalId,
  splitFullName,
};
