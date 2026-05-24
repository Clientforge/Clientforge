const db = require('../db/connection');

const REBOOKING_JOB_TYPES = [
  'rebooking',
  'rebooking_initial',
  'rebooking_followup_1',
  'rebooking_followup_2',
];

const isRebookingJobType = (jobType) => REBOOKING_JOB_TYPES.includes(jobType);

/**
 * True when the contact has a future appointment on the calendar (excluding optional source visit).
 */
const hasFutureBooking = async (tenantId, contactId, { excludeAppointmentId } = {}) => {
  const params = [tenantId, contactId];
  let excludeClause = '';
  if (excludeAppointmentId) {
    params.push(excludeAppointmentId);
    excludeClause = ` AND id != $${params.length}`;
  }

  const result = await db.query(
    `SELECT 1 FROM appointments
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status IN ('scheduled', 'confirmed', 'rescheduled')
       AND scheduled_at > NOW()
       ${excludeClause}
     LIMIT 1`,
    params,
  );

  return result.rows.length > 0;
};

/**
 * Cancel all pending rebooking jobs for a contact (across all source appointments).
 */
const cancelRebookingJobsForContact = async (tenantId, contactId) => {
  const result = await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND job_type = ANY($3::text[])
       AND status = 'pending'
     RETURNING id`,
    [tenantId, contactId, REBOOKING_JOB_TYPES],
  );

  if (result.rowCount > 0) {
    console.log(
      `[REBOOKING] Cancelled ${result.rowCount} pending rebooking job(s) for contact ${contactId}`,
    );
  }

  return result.rowCount;
};

module.exports = {
  REBOOKING_JOB_TYPES,
  isRebookingJobType,
  hasFutureBooking,
  cancelRebookingJobsForContact,
};
