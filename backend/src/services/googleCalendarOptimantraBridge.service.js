/**
 * Sluice Drip Spa — Google Calendar → OptiMantra appointment bridge.
 *
 * OptiMantra webhooks create bookings; Google Calendar sync updates those rows on
 * reschedule/cancel without creating duplicate google_calendar appointments.
 */

const db = require('../db/connection');
const appointmentWorkflowService = require('./appointment-workflow.service');

const ACTIVE_STATUSES = ['scheduled', 'confirmed', 'rescheduled'];
const SAME_TIME_MS = 60 * 1000;

function parseEventStartMs(googleEvent) {
  const raw = googleEvent?.start?.dateTime || googleEvent?.start?.date;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Classify a calendar event relative to an existing OptiMantra appointment.
 * @returns {'booking.cancelled' | 'booking.rescheduled' | 'booking.unchanged'}
 */
function classifyCalendarChange(googleEvent, existingAppointment) {
  if (googleEvent?.status === 'cancelled') {
    return 'booking.cancelled';
  }

  const newMs = parseEventStartMs(googleEvent);
  const oldMs = new Date(existingAppointment.scheduled_at).getTime();

  if (newMs == null || Number.isNaN(oldMs)) {
    return 'booking.unchanged';
  }

  if (Math.abs(newMs - oldMs) <= SAME_TIME_MS) {
    return 'booking.unchanged';
  }

  return 'booking.rescheduled';
}

async function findLinkedOptimantraAppointment(tenantId, googleEventId) {
  const result = await db.query(
    `SELECT id, contact_id, scheduled_at, status, provider, google_calendar_event_id, service_name
     FROM appointments
     WHERE tenant_id = $1
       AND provider = 'optimantra'
       AND google_calendar_event_id = $2
     LIMIT 1`,
    [tenantId, googleEventId],
  );
  return result.rows[0] || null;
}

async function findOptimantraAppointmentByContactTime(tenantId, contactId, scheduledAt) {
  const result = await db.query(
    `SELECT id, contact_id, scheduled_at, status, provider, google_calendar_event_id, service_name
     FROM appointments
     WHERE tenant_id = $1
       AND contact_id = $2
       AND provider = 'optimantra'
       AND status = ANY($3::text[])
       AND ABS(EXTRACT(EPOCH FROM (scheduled_at - $4::timestamptz))) <= 60
     ORDER BY scheduled_at DESC
     LIMIT 1`,
    [tenantId, contactId, ACTIVE_STATUSES, scheduledAt],
  );
  return result.rows[0] || null;
}

/**
 * Pick the OptiMantra row most likely rescheduled to `scheduledAtMs` when the calendar
 * event id changed or the DB time still reflects the old slot.
 */
function pickRescheduleCandidateAppointments(rows, googleEventId, scheduledAtMs) {
  if (!rows?.length || scheduledAtMs == null || Number.isNaN(scheduledAtMs)) {
    return null;
  }

  const timeMoved = rows.filter((row) => {
    const oldMs = new Date(row.scheduled_at).getTime();
    return !Number.isNaN(oldMs) && Math.abs(scheduledAtMs - oldMs) > SAME_TIME_MS;
  });
  if (timeMoved.length === 0) return null;

  const linkedOther = timeMoved.filter(
    (row) => row.google_calendar_event_id && row.google_calendar_event_id !== googleEventId,
  );
  const pool = linkedOther.length > 0 ? linkedOther : timeMoved;

  pool.sort((a, b) => {
    const diffA = Math.abs(scheduledAtMs - new Date(a.scheduled_at).getTime());
    const diffB = Math.abs(scheduledAtMs - new Date(b.scheduled_at).getTime());
    return diffA - diffB;
  });

  const bestDiff = Math.abs(scheduledAtMs - new Date(pool[0].scheduled_at).getTime());
  const tied = pool.filter(
    (row) => Math.abs(scheduledAtMs - new Date(row.scheduled_at).getTime()) === bestDiff,
  );
  return tied.length === 1 ? tied[0] : null;
}

/**
 * When OptiMantra creates a new Google event on reschedule (new event id), match the
 * previously linked active OptiMantra row whose old time is closest to the calendar slot.
 */
async function findStaleOptimantraAppointment(tenantId, contactId, googleEventId, scheduledAt) {
  const scheduledAtMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(scheduledAtMs)) return null;

  const upcoming = await db.query(
    `SELECT id, contact_id, scheduled_at, status, provider, google_calendar_event_id, service_name
     FROM appointments
     WHERE tenant_id = $1
       AND contact_id = $2
       AND provider = 'optimantra'
       AND status = ANY($3::text[])
       AND scheduled_at > NOW() - INTERVAL '1 day'`,
    [tenantId, contactId, ACTIVE_STATUSES],
  );

  return pickRescheduleCandidateAppointments(upcoming.rows, googleEventId, scheduledAtMs);
}

async function findOptimantraAppointmentForCalendarEvent(tenantId, {
  googleEventId,
  contactId,
  scheduledAt,
}) {
  const linked = await findLinkedOptimantraAppointment(tenantId, googleEventId);
  if (linked) return linked;

  const byTime = await findOptimantraAppointmentByContactTime(tenantId, contactId, scheduledAt);
  if (byTime) return byTime;

  return findStaleOptimantraAppointment(tenantId, contactId, googleEventId, scheduledAt);
}

async function applyCalendarBridgeUpdate(tenantId, {
  appointmentRow,
  googleEvent,
  normalized,
  eventType,
}) {
  const contactId = appointmentRow.contact_id;
  const { scheduledAt, timezone, durationMinutes } = normalized.appointment;

  let status = appointmentRow.status;
  if (eventType === 'booking.cancelled') {
    status = 'cancelled';
  } else if (eventType === 'booking.rescheduled') {
    status = 'rescheduled';
  }

  await db.query(
    `UPDATE appointments SET
       google_calendar_event_id = $2,
       status = $3,
       scheduled_at = $4,
       timezone = COALESCE($5, timezone),
       duration_minutes = COALESCE($6, duration_minutes),
       raw_payload = COALESCE(raw_payload, '{}'::jsonb)
         || jsonb_build_object('googleCalendar', $7::jsonb),
       updated_at = NOW()
     WHERE id = $1 AND tenant_id = $8`,
    [
      appointmentRow.id,
      googleEvent.id,
      status,
      scheduledAt,
      timezone || null,
      durationMinutes || null,
      JSON.stringify(googleEvent),
      tenantId,
    ],
  );

  if (eventType !== 'booking.unchanged') {
    await appointmentWorkflowService.dispatchWorkflows(tenantId, {
      contactId,
      appointmentId: appointmentRow.id,
      eventType,
    });
  }

  return {
    contactId,
    appointmentId: appointmentRow.id,
    eventType,
    bridged: true,
  };
}

/**
 * Process a Google Calendar event for Sluice — link or update OptiMantra rows only.
 */
async function processSluiceCalendarEvent(tenantId, googleEvent, normalized, { contactId }) {
  const match = await findOptimantraAppointmentForCalendarEvent(tenantId, {
    googleEventId: googleEvent.id,
    contactId,
    scheduledAt: normalized.appointment.scheduledAt,
  });

  if (!match) {
    return {
      skipped: true,
      reason: 'bridge_no_optimantra_match',
    };
  }

  const eventType = classifyCalendarChange(googleEvent, match);

  const result = await applyCalendarBridgeUpdate(tenantId, {
    appointmentRow: match,
    googleEvent,
    normalized,
    eventType,
  });

  return {
    processed: true,
    bridged: true,
    ...result,
  };
}

module.exports = {
  SAME_TIME_MS,
  ACTIVE_STATUSES,
  classifyCalendarChange,
  parseEventStartMs,
  pickRescheduleCandidateAppointments,
  findOptimantraAppointmentForCalendarEvent,
  applyCalendarBridgeUpdate,
  processSluiceCalendarEvent,
};
