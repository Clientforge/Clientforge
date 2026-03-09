const db = require('../db/connection');
const smsService = require('../services/sms.service');
const compliance = require('../services/compliance.service');

const POLL_INTERVAL_MS = 60 * 1000; // 1 minute

/**
 * Process due appointment workflow jobs (reminders, post-visit follow-ups).
 * Picks up rows where status = 'pending' AND scheduled_at <= NOW().
 */
const processDueAppointmentJobs = async () => {
  const result = await db.query(
    `SELECT j.*, c.phone, c.first_name, c.unsubscribed,
            t.phone_number AS tenant_phone, t.name AS tenant_name
     FROM appointment_workflow_jobs j
     JOIN contacts c ON c.id = j.contact_id
     JOIN tenants t ON t.id = j.tenant_id
     WHERE j.status = 'pending'
       AND j.scheduled_at <= NOW()
     ORDER BY j.scheduled_at ASC
     LIMIT 50`,
  );

  const jobs = result.rows;
  if (jobs.length === 0) return 0;

  console.log(`[APPT-WORKER] Processing ${jobs.length} appointment job(s)...`);

  let sentCount = 0;

  for (const job of jobs) {
    try {
      if (job.unsubscribed) {
        await db.query(
          `UPDATE appointment_workflow_jobs SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
          [job.id],
        );
        continue;
      }

      const canSend = await compliance.canSendToContact(job.contact_id);
      if (!canSend) {
        await db.query(
          `UPDATE appointment_workflow_jobs SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
          [job.id],
        );
        continue;
      }

      if (!job.phone) {
        await db.query(
          `UPDATE appointment_workflow_jobs SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1`,
          [job.id],
        );
        continue;
      }

      if (job.channel === 'sms' && job.message_body) {
        await smsService.sendSms({
          tenantId: job.tenant_id,
          leadId: null,
          to: job.phone,
          from: job.tenant_phone || undefined,
          body: job.message_body,
          messageType: `appointment_${job.job_type}`,
        });
      }

      await db.query(
        `UPDATE appointment_workflow_jobs SET status = 'sent', sent_at = NOW() WHERE id = $1`,
        [job.id],
      );
      sentCount++;
    } catch (err) {
      console.error(`[APPT-WORKER] Failed job ${job.id}:`, err.message);
      await db.query(
        `UPDATE appointment_workflow_jobs SET status = 'failed' WHERE id = $1`,
        [job.id],
      );
    }
  }

  if (sentCount > 0) {
    console.log(`[APPT-WORKER] Sent ${sentCount} message(s)`);
  }

  return sentCount;
};

const startWorker = () => {
  console.log(`[APPT-WORKER] Appointment worker started (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  const run = async () => {
    try {
      await processDueAppointmentJobs();
    } catch (err) {
      console.error('[APPT-WORKER] Unexpected error:', err.message);
    }
  };

  run();
  setInterval(run, POLL_INTERVAL_MS);
};

module.exports = {
  processDueAppointmentJobs,
  startWorker,
};
