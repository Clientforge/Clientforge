const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const smsService = require('./sms.service');
const emailService = require('./email.service');
const compliance = require('./compliance.service');
const automationService = require('./appointment-automation.service');
const tenantService = require('./tenant-service.service');
const rebookingCampaign = require('./rebooking-campaign.service');

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

  if (eventType === 'booking.unchanged') {
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
    await rebookingCampaign.cancelRebookingJobsForContact(tenantId, contactId);
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

  const steps = config.rebooking?.steps || [];
  const initialStep = steps[0];
  const followup1Step = steps[1];
  const followup2Step = steps[2];
  const followupIntervalDays = config.rebooking?.followup_interval_days || 14;

  let offsetDays = null;
  let source = 'generic';

  if (matched?.rebookingEnabled && Number.isFinite(matched.returnIntervalDays) && matched.returnIntervalDays > 0) {
    offsetDays = matched.returnIntervalDays;
    source = 'service';
  } else if (config.rebooking?.enabled && initialStep) {
    offsetDays = Math.max(1, Math.round(initialStep.offset_minutes / (60 * 24)));
    source = 'generic';
  }

  if (!offsetDays) return;

  const serviceVars = {
    ...vars,
    serviceName: matched?.name || appointment.service_name || vars.serviceName,
  };

  const campaignSteps = [
    {
      jobType: 'rebooking_initial',
      step: initialStep,
      message: matched?.rebookMessage || initialStep?.message || null,
      emailSubject: matched?.rebookEmailSubject || initialStep?.email_subject || null,
      runAt: new Date(appointmentTime.getTime() + offsetDays * 24 * 60 * 60 * 1000),
    },
    {
      jobType: 'rebooking_followup_1',
      step: followup1Step,
      message: followup1Step?.message || null,
      emailSubject: followup1Step?.email_subject || null,
      runAt: null,
    },
    {
      jobType: 'rebooking_followup_2',
      step: followup2Step,
      message: followup2Step?.message || null,
      emailSubject: followup2Step?.email_subject || null,
      runAt: null,
    },
  ];

  campaignSteps[1].runAt = new Date(
    campaignSteps[0].runAt.getTime() + followupIntervalDays * 24 * 60 * 60 * 1000,
  );
  campaignSteps[2].runAt = new Date(
    campaignSteps[1].runAt.getTime() + followupIntervalDays * 24 * 60 * 60 * 1000,
  );

  let scheduledCount = 0;
  const now = new Date();

  for (const item of campaignSteps) {
    if (!item.message || !item.runAt || item.runAt <= now) continue;

    const isInitial = item.jobType === 'rebooking_initial';
    if (!isInitial && (!item.step || item.step.enabled === false)) continue;
    if (isInitial && item.step?.enabled === false && source !== 'service') continue;

    const body = automationService.renderTemplate(item.message, serviceVars);
    const subject = automationService.renderTemplate(
      item.emailSubject || 'Time to rebook — {businessName}',
      serviceVars,
    );
    const channel = item.step.channel || initialStep?.channel || 'sms';
    const channels = automationService.channelsForStep(channel);

    for (const ch of channels) {
      await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, item.jobType, {
        scheduledAt: item.runAt.toISOString(),
        channel: ch,
        messageBody: body,
        emailSubject: ch === 'email' ? subject : null,
      });
      scheduledCount++;
    }
  }

  if (scheduledCount > 0) {
    console.log(
      `[APPT-WORKFLOW] Scheduled ${source} rebooking campaign (${scheduledCount} job(s))`
      + ` starting ${offsetDays}d after visit for appointment ${appointmentId}`
      + (matched ? ` (${matched.name})` : ''),
    );
  }
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
      contactId,
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
