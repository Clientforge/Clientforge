const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const smsService = require('./sms.service');
const emailService = require('./email.service');
const compliance = require('./compliance.service');
const automationService = require('./appointment-automation.service');
const tenantService = require('./tenant-service.service');

/**
 * Dispatch workflows based on booking event type.
 * Called after appointment.service.processBookingEvent.
 */
const dispatchWorkflows = async (tenantId, { contactId, appointmentId, eventType }) => {
  const [tenantRow, contactRow, appointmentRow] = await Promise.all([
    db.query(
      `SELECT name, phone_number, timezone, booking_link, email_from_name, email_from_address,
              appointment_automation_config
       FROM tenants WHERE id = $1`,
      [tenantId],
    ),
    db.query('SELECT first_name, last_name, phone, email, unsubscribed FROM contacts WHERE id = $1', [contactId]),
    db.query('SELECT scheduled_at, service_name, timezone FROM appointments WHERE id = $1', [appointmentId]),
  ]);

  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const appointment = appointmentRow.rows[0];

  if (!tenant || !contact || !appointment) {
    console.warn('[APPT-WORKFLOW] Missing tenant, contact, or appointment — skipping dispatch');
    return;
  }

  const config = automationService.normalizeConfig(tenant.appointment_automation_config);
  const templateContext = { tenant, contact, appointment };
  const vars = automationService.buildTemplateVars(templateContext);

  if (eventType === 'booking.cancelled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    await sendEventMessage(tenantId, contactId, contact, tenant, config.event_messages.cancellation, vars, 'cancellation');
    return;
  }

  if (eventType === 'booking.rescheduled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    await sendEventMessage(tenantId, contactId, contact, tenant, config.event_messages.reschedule, vars, 'reschedule');
    await scheduleAutomationSteps(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
    await scheduleRebooking(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
    return;
  }

  if (eventType === 'booking.created') {
    await scheduleAutomationSteps(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
    await scheduleRebooking(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
  }
};

const scheduleAutomationSteps = async (
  tenantId,
  appointmentId,
  contactId,
  contact,
  tenant,
  appointment,
  config,
  vars,
) => {
  const appointmentTime = new Date(appointment.scheduled_at);

  for (const category of automationService.CATEGORY_KEYS) {
    if (category === 'rebooking') continue;
    const section = config[category];
    if (!section?.enabled) continue;

    const jobType = automationService.JOB_TYPE_BY_CATEGORY[category];

    for (const step of section.steps || []) {
      if (!step.enabled || !step.message) continue;

      const runAt = new Date(appointmentTime.getTime() + step.offset_minutes * 60 * 1000);
      if (step.offset_minutes !== 0 && runAt <= new Date()) continue;

      const body = automationService.renderTemplate(step.message, vars);
      const emailSubject = automationService.renderTemplate(step.email_subject, vars);
      const channels = automationService.channelsForStep(step.channel);

      for (const channel of channels) {
        if (step.offset_minutes === 0) {
          await deliverMessage(tenantId, contactId, contact, tenant, {
            channel,
            body,
            emailSubject,
            messageType: jobType,
          });
        } else {
          await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, jobType, {
            scheduledAt: runAt.toISOString(),
            channel,
            messageBody: body,
            emailSubject: channel === 'email' ? emailSubject : null,
          });
        }
      }
    }
  }
};

const scheduleRebooking = async (
  tenantId,
  appointmentId,
  contactId,
  contact,
  tenant,
  appointment,
  config,
  vars,
) => {
  const appointmentTime = new Date(appointment.scheduled_at);
  const matched = await tenantService.matchService(tenantId, appointment.service_name);

  if (matched) {
    await tenantService.setAppointmentMatchedService(appointmentId, matched.id);
  }

  const rebookStep = (config.rebooking?.steps || []).find((s) => s.enabled !== false && s.message);
  const channel = rebookStep?.channel || 'sms';

  let offsetDays = null;
  let message = null;
  let emailSubject = null;
  let source = 'generic';

  if (matched?.rebookingEnabled && Number.isFinite(matched.returnIntervalDays) && matched.returnIntervalDays > 0) {
    offsetDays = matched.returnIntervalDays;
    message = matched.rebookMessage || rebookStep?.message || null;
    emailSubject = matched.rebookEmailSubject || rebookStep?.email_subject || null;
    source = 'service';
  } else if (config.rebooking?.enabled && rebookStep) {
    offsetDays = Math.max(1, Math.round(rebookStep.offset_minutes / (60 * 24)));
    message = rebookStep.message;
    emailSubject = rebookStep.email_subject;
    source = 'generic';
  }

  if (!offsetDays || !message) return;

  const runAt = new Date(appointmentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  if (runAt <= new Date()) return;

  const serviceVars = {
    ...vars,
    serviceName: matched?.name || appointment.service_name || vars.serviceName,
  };

  const body = automationService.renderTemplate(message, serviceVars);
  const subject = automationService.renderTemplate(
    emailSubject || 'Time to rebook — {businessName}',
    serviceVars,
  );

  const channels = automationService.channelsForStep(channel);
  for (const ch of channels) {
    await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, 'rebooking', {
      scheduledAt: runAt.toISOString(),
      channel: ch,
      messageBody: body,
      emailSubject: ch === 'email' ? subject : null,
    });
  }

  console.log(
    `[APPT-WORKFLOW] Scheduled ${source} rebooking in ${offsetDays}d for appointment ${appointmentId}`
    + (matched ? ` (${matched.name})` : ''),
  );
};

const sendEventMessage = async (tenantId, contactId, contact, tenant, eventConfig, vars, messageType) => {
  if (!eventConfig?.enabled || !eventConfig.message) return;

  const body = automationService.renderTemplate(eventConfig.message, vars);
  const emailSubject = automationService.renderTemplate(eventConfig.email_subject, vars);
  const channels = automationService.channelsForStep(eventConfig.channel);

  for (const channel of channels) {
    await deliverMessage(tenantId, contactId, contact, tenant, {
      channel,
      body,
      emailSubject,
      messageType,
    });
  }
};

const deliverMessage = async (tenantId, contactId, contact, tenant, { channel, body, emailSubject, messageType }) => {
  if (channel === 'sms') {
    if (!contact.phone || contact.unsubscribed) return;
    await sendAppointmentSms(tenantId, contactId, contact.phone, tenant.phone_number, body, messageType);
    return;
  }

  if (channel === 'email') {
    if (!contact.email || contact.unsubscribed) return;
    await sendAppointmentEmail(tenantId, contactId, contact.email, tenant, emailSubject, body, messageType);
  }
};

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
      contactId,
      to,
      from,
      body,
      messageType: `appointment_${messageType}`,
    });
  } catch (err) {
    console.error(`[APPT-WORKFLOW] Failed to send ${messageType} SMS to contact ${contactId}:`, err.message);
  }
};

const sendAppointmentEmail = async (tenantId, contactId, to, tenant, subject, body, messageType) => {
  try {
    const canSend = await compliance.canSendToContact(contactId);
    if (!canSend) {
      console.log(`[APPT-WORKFLOW] Contact ${contactId} unsubscribed — skipping email`);
      return;
    }
    await emailService.sendEmail({
      tenantId,
      to,
      fromName: tenant.email_from_name || tenant.name,
      fromAddress: tenant.email_from_address || undefined,
      subject: subject || `Message from ${tenant.name || 'ClientForge'}`,
      body,
    });
  } catch (err) {
    console.error(`[APPT-WORKFLOW] Failed to send ${messageType} email to contact ${contactId}:`, err.message);
  }
};

module.exports = { dispatchWorkflows };
