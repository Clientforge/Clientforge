const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');

/**
 * Dispatch workflows based on booking event type.
 * Called after appointment.service.processBookingEvent.
 */
const dispatchWorkflows = async (tenantId, { contactId, appointmentId, eventType }) => {
  const [tenantRow, contactRow, appointmentRow] = await Promise.all([
    db.query('SELECT name, phone_number FROM tenants WHERE id = $1', [tenantId]),
    db.query('SELECT first_name, phone, email, unsubscribed FROM contacts WHERE id = $1', [contactId]),
    db.query('SELECT scheduled_at, service_name FROM appointments WHERE id = $1', [appointmentId]),
  ]);

  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const appointment = appointmentRow.rows[0];

  if (!tenant || !contact || !appointment) {
    console.warn('[APPT-WORKFLOW] Missing tenant, contact, or appointment — skipping dispatch');
    return;
  }

  const firstName = contact.first_name || 'there';
  const businessName = tenant.name || 'us';

  if (eventType === 'booking.cancelled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    if (contact.phone && !contact.unsubscribed) {
      const body = `Hi ${firstName}, your appointment with ${businessName} has been cancelled. Need to reschedule? Reply to this message.`;
      await sendAppointmentSms(tenantId, contactId, contact.phone, tenant.phone_number, body, 'cancellation');
    }
    return;
  }

  if (eventType === 'booking.rescheduled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    if (contact.phone && !contact.unsubscribed) {
      const body = `Hi ${firstName}, your appointment with ${businessName} has been rescheduled. We'll send a reminder before your new time.`;
      await sendAppointmentSms(tenantId, contactId, contact.phone, tenant.phone_number, body, 'reschedule');
    }
    // Schedule new reminder for the rescheduled time
    await scheduleReminder(tenantId, appointmentId, contactId, appointment.scheduled_at);
    return;
  }

  if (eventType === 'booking.created') {
    // Immediate confirmation
    if (contact.phone && !contact.unsubscribed) {
      const body = `Hi ${firstName}! Your appointment with ${businessName} is confirmed. We'll send a reminder before your visit.`;
      await sendAppointmentSms(tenantId, contactId, contact.phone, tenant.phone_number, body, 'confirmation');
    }

    // Schedule reminder (24 hours before)
    await scheduleReminder(tenantId, appointmentId, contactId, appointment.scheduled_at);

    // Schedule post-visit follow-up (24 hours after)
    await schedulePostVisit(tenantId, appointmentId, contactId, appointment.scheduled_at, appointment.service_name);
  }
};

/**
 * Schedule reminder job — 24 hours before appointment.
 */
const scheduleReminder = async (tenantId, appointmentId, contactId, scheduledAt) => {
  const at = new Date(scheduledAt);
  at.setHours(at.getHours() - 24);
  if (at <= new Date()) return; // Don't schedule if already past

  const [tenantRow, contactRow] = await Promise.all([
    db.query('SELECT name, phone_number FROM tenants WHERE id = $1', [tenantId]),
    db.query('SELECT first_name, phone FROM contacts WHERE id = $1', [contactId]),
  ]);
  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const firstName = contact?.first_name || 'there';
  const businessName = tenant?.name || 'us';

  const body = `Hi ${firstName}! Reminder: you have an appointment with ${businessName} tomorrow. Reply if you need to reschedule.`;

  await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, 'reminder', {
    scheduledAt: at.toISOString(),
    channel: 'sms',
    messageBody: body,
  });
};

/**
 * Schedule post-visit follow-up — 24 hours after appointment.
 */
const schedulePostVisit = async (tenantId, appointmentId, contactId, scheduledAt, serviceName) => {
  const at = new Date(scheduledAt);
  at.setHours(at.getHours() + 24);

  const [tenantRow, contactRow] = await Promise.all([
    db.query('SELECT name FROM tenants WHERE id = $1', [tenantId]),
    db.query('SELECT first_name, phone FROM contacts WHERE id = $1', [contactId]),
  ]);
  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const firstName = contact?.first_name || 'there';
  const businessName = tenant?.name || 'us';

  const body = `Hi ${firstName}! Hope your visit to ${businessName} went well. We'd love to see you again — book your next appointment anytime.`;

  await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, 'post_visit', {
    scheduledAt: at.toISOString(),
    channel: 'sms',
    messageBody: body,
  });
};

/**
 * Send SMS for appointment workflow. Uses contact_id (lead_id can be null).
 */
const sendAppointmentSms = async (tenantId, contactId, to, from, body, messageType) => {
  try {
    const canSend = await compliance.canSendToContact(contactId);
    if (!canSend) {
      console.log(`[APPT-WORKFLOW] Contact ${contactId} unsubscribed — skipping`);
      return;
    }
    await smsService.sendSms({
      tenantId,
      leadId: null,
      to,
      from,
      body,
      messageType: `appointment_${messageType}`,
    });
  } catch (err) {
    console.error(`[APPT-WORKFLOW] Failed to send ${messageType} to contact ${contactId}:`, err.message);
  }
};

module.exports = { dispatchWorkflows };
