const db = require('../db/connection');
const { isSluiceTenant } = require('../config/sluiceTenant');
const { DEFAULT_TIMEZONE } = require('../utils/tenantTimezone');
const appointmentWorkflowService = require('./appointment-workflow.service');

/** 7:00 PM clinic timezone on the appointment day. */
const SLUICE_NO_SHOW_SEND_HOUR = 19;

const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'rescheduled'];

const claimDailyRun = async (tenantId, runDate) => {
  const result = await db.query(
    `INSERT INTO no_show_daily_runs (tenant_id, run_date)
     VALUES ($1, $2)
     ON CONFLICT (tenant_id, run_date) DO NOTHING
     RETURNING id`,
    [tenantId, runDate],
  );
  return result.rows.length > 0;
};

const findAppointmentsWithoutCheckout = async (tenantId, timezone) => {
  const tz = timezone || DEFAULT_TIMEZONE;
  const result = await db.query(
    `SELECT a.id, a.contact_id, a.scheduled_at, a.service_name, a.status
     FROM appointments a
     WHERE a.tenant_id = $1
       AND a.provider = 'optimantra'
       AND a.status = ANY($4::text[])
       AND (a.scheduled_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
       AND a.scheduled_at <= (
         (((NOW() AT TIME ZONE $2)::date + make_interval(hours => $3)) AT TIME ZONE $2)
       )
       AND NOT EXISTS (
         SELECT 1 FROM visit_checkouts vc
         WHERE vc.tenant_id = a.tenant_id
           AND vc.contact_id = a.contact_id
           AND (vc.checked_out_at AT TIME ZONE $2)::date = (NOW() AT TIME ZONE $2)::date
       )
       AND NOT EXISTS (
         SELECT 1 FROM appointment_workflow_jobs j
         WHERE j.appointment_id = a.id
           AND j.job_type = 'no_show'
           AND j.status IN ('sent', 'pending')
       )
     ORDER BY a.scheduled_at ASC`,
    [tenantId, tz, SLUICE_NO_SHOW_SEND_HOUR, ACTIVE_APPOINTMENT_STATUSES],
  );
  return result.rows;
};

const getLocalDateKey = (timezone) => {
  const tz = timezone || DEFAULT_TIMEZONE;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
};

const getLocalHour = (timezone) => {
  const tz = timezone || DEFAULT_TIMEZONE;
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date()));
  return hour === 24 ? 0 : hour;
};

const processNoShowForTenant = async (tenantRow) => {
  if (!isSluiceTenant(tenantRow.id)) {
    return { sent: 0, skipped: true, reason: 'not_sluice' };
  }
  if (!tenantRow.optimantra_checkout_automations) {
    return { sent: 0, skipped: true, reason: 'checkout_mode_disabled' };
  }

  const timezone = tenantRow.timezone || DEFAULT_TIMEZONE;
  const localHour = getLocalHour(timezone);
  if (localHour !== SLUICE_NO_SHOW_SEND_HOUR) {
    return { sent: 0, skipped: true, reason: 'not_send_hour' };
  }

  const runDate = getLocalDateKey(timezone);
  const claimed = await claimDailyRun(tenantRow.id, runDate);
  if (!claimed) {
    return { sent: 0, skipped: true, reason: 'already_ran_today' };
  }

  const appointments = await findAppointmentsWithoutCheckout(tenantRow.id, timezone);
  if (appointments.length === 0) {
    console.log(`[NO-SHOW] Tenant ${tenantRow.id}: no appointments without checkout on ${runDate}`);
    return { sent: 0, appointments: 0 };
  }

  console.log(`[NO-SHOW] Tenant ${tenantRow.id}: processing ${appointments.length} appointment(s) on ${runDate}`);

  let sent = 0;
  for (const appointment of appointments) {
    try {
      const result = await appointmentWorkflowService.dispatchNoShowWorkflow(tenantRow.id, {
        contactId: appointment.contact_id,
        appointmentId: appointment.id,
      });
      if (result.sent) sent += 1;
    } catch (err) {
      console.error(`[NO-SHOW] Failed for appointment ${appointment.id}:`, err.message);
    }
  }

  return { sent, appointments: appointments.length };
};

const processAllSluiceNoShowChecks = async () => {
  const result = await db.query(
    `SELECT id, name, timezone, optimantra_checkout_automations
     FROM tenants
     WHERE active = true`,
  );

  let totalSent = 0;
  for (const tenant of result.rows) {
    if (!isSluiceTenant(tenant.id)) continue;
    try {
      const outcome = await processNoShowForTenant(tenant);
      if (outcome.sent) totalSent += outcome.sent;
    } catch (err) {
      console.error(`[NO-SHOW] Tenant ${tenant.id} error:`, err.message);
    }
  }

  return totalSent;
};

module.exports = {
  SLUICE_NO_SHOW_SEND_HOUR,
  findAppointmentsWithoutCheckout,
  getLocalDateKey,
  getLocalHour,
  processNoShowForTenant,
  processAllSluiceNoShowChecks,
};
