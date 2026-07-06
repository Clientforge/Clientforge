const db = require('../db/connection');
const appointmentService = require('./appointment.service');
const smsService = require('./sms.service');
const emailService = require('./email.service');
const compliance = require('./compliance.service');
const automationService = require('./appointment-automation.service');
const tenantService = require('./tenant-service.service');
const rebookingCampaign = require('./rebooking-campaign.service');
const {
  DEFAULT_FOLLOWUP_MESSAGE,
  coercePositiveInt,
} = require('./service-followup-campaign.service');

const PRE_VISIT_CATEGORIES = ['confirmations', 'reminders'];
const POST_VISIT_CATEGORIES = ['post_appointment', 'review_requests'];

const isOptimantraCheckoutMode = (tenant, appointment) => (
  !!tenant?.optimantra_checkout_automations
  && appointment?.provider === 'optimantra'
);

const categoriesForBookingDispatch = (tenant, appointment) => {
  if (isOptimantraCheckoutMode(tenant, appointment)) {
    return PRE_VISIT_CATEGORIES;
  }
  return automationService.CATEGORY_KEYS.filter((key) => key !== 'rebooking');
};

const shouldScheduleRebookingOnBooking = (tenant, appointment) => (
  !isOptimantraCheckoutMode(tenant, appointment)
);

/**
 * Dispatch workflows based on booking event type.
 * Called after appointment.service.processBookingEvent.
 */
const dispatchWorkflows = async (tenantId, { contactId, appointmentId, eventType }) => {
  const [tenantRow, contactRow, appointmentRow] = await Promise.all([
    db.query(
      `SELECT name, phone_number, timezone, booking_link, email_from_name, email_from_address,
              appointment_automation_config, optimantra_checkout_automations,
              service_followup_campaigns_enabled
       FROM tenants WHERE id = $1`,
      [tenantId],
    ),
    db.query('SELECT first_name, last_name, phone, email, unsubscribed FROM contacts WHERE id = $1', [contactId]),
    db.query(
      'SELECT scheduled_at, service_name, timezone, provider, matched_service_id FROM appointments WHERE id = $1',
      [appointmentId],
    ),
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
  const bookingCategories = categoriesForBookingDispatch(tenant, appointment);

  if (eventType === 'booking.cancelled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    await sendEventMessage(tenantId, contactId, contact, tenant, config.event_messages.cancellation, vars, 'cancellation');
    return;
  }

  if (eventType === 'booking.rescheduled') {
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    await sendEventMessage(tenantId, contactId, contact, tenant, config.event_messages.reschedule, vars, 'reschedule');
    await scheduleAutomationSteps(
      tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars,
      { categories: bookingCategories },
    );
    if (shouldScheduleRebookingOnBooking(tenant, appointment)) {
      await scheduleRebooking(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
    }
    return;
  }

  if (eventType === 'booking.created') {
    await rebookingCampaign.cancelRebookingJobsForContact(tenantId, contactId);
    await scheduleAutomationSteps(
      tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars,
      { categories: bookingCategories },
    );
    if (shouldScheduleRebookingOnBooking(tenant, appointment)) {
      await scheduleRebooking(tenantId, appointmentId, contactId, contact, tenant, appointment, config, vars);
    }
  }
};

/**
 * Post-visit workflows after OptiMantra superbill checkout.
 */
const dispatchCheckoutWorkflows = async (tenantId, { contactId, appointmentId, checkedOutAt, primaryServiceName }) => {
  const [tenantRow, contactRow, appointmentRow] = await Promise.all([
    db.query(
      `SELECT name, phone_number, timezone, booking_link, email_from_name, email_from_address,
              appointment_automation_config, optimantra_checkout_automations,
              service_followup_campaigns_enabled
       FROM tenants WHERE id = $1`,
      [tenantId],
    ),
    db.query('SELECT first_name, last_name, phone, email, unsubscribed FROM contacts WHERE id = $1', [contactId]),
    db.query(
      'SELECT scheduled_at, service_name, timezone, provider, matched_service_id FROM appointments WHERE id = $1',
      [appointmentId],
    ),
  ]);

  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const appointment = appointmentRow.rows[0];

  if (!tenant || !contact || !appointment) {
    console.warn('[APPT-WORKFLOW] Checkout dispatch missing context — skipping');
    return { jobsScheduled: 0 };
  }

  if (!tenant.optimantra_checkout_automations) {
    console.log('[APPT-WORKFLOW] Checkout workflows skipped — optimantra_checkout_automations off');
    return { jobsScheduled: 0, skipped: 'checkout_mode_disabled' };
  }

  if (contact.unsubscribed) {
    return { jobsScheduled: 0, skipped: 'unsubscribed' };
  }

  await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE appointment_id = $1
       AND tenant_id = $2
       AND status = 'pending'
       AND (
         job_type IN ('post_visit', 'review_request', 'rebooking', 'rebooking_initial')
         OR job_type LIKE 'rebooking_followup_%'
       )`,
    [appointmentId, tenantId],
  );

  const appointmentForTemplates = {
    ...appointment,
    service_name: primaryServiceName || appointment.service_name,
  };

  const config = automationService.normalizeConfig(tenant.appointment_automation_config);
  const vars = automationService.buildTemplateVars({
    tenant,
    contact,
    appointment: appointmentForTemplates,
  });

  const referenceTime = checkedOutAt || new Date().toISOString();

  const automationJobs = await scheduleAutomationSteps(
    tenantId,
    appointmentId,
    contactId,
    contact,
    tenant,
    appointmentForTemplates,
    config,
    vars,
    {
      skipImmediate: true,
      referenceTime,
      categories: POST_VISIT_CATEGORIES,
    },
  );

  const rebookingResult = await scheduleRebooking(
    tenantId,
    appointmentId,
    contactId,
    contact,
    tenant,
    appointmentForTemplates,
    config,
    vars,
    { referenceTime },
  );

  const rebookingJobs = rebookingResult.scheduledCount || 0;
  const jobsScheduled = automationJobs + rebookingJobs;
  console.log(
    `[APPT-WORKFLOW] Checkout scheduled ${jobsScheduled} job(s) for appointment ${appointmentId}`
    + (rebookingResult.skipReason ? ` (rebooking skipped: ${rebookingResult.skipReason})` : ''),
  );

  return {
    jobsScheduled,
    postVisitJobs: automationJobs,
    rebookingJobs,
    rebookingSkipped: rebookingJobs === 0,
    rebookingSkipReason: rebookingResult.skipReason || null,
    rebookingOffsetDays: rebookingResult.offsetDays || null,
  };
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
  { skipImmediate = false, referenceTime, categories } = {},
) => {
  const appointmentTime = referenceTime
    ? new Date(referenceTime)
    : new Date(appointment.scheduled_at);
  const categoryKeys = categories
    || automationService.CATEGORY_KEYS.filter((key) => key !== 'rebooking');

  let scheduledCount = 0;

  for (const category of categoryKeys) {
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
          if (skipImmediate) continue;
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
          scheduledCount += 1;
        }
      }
    }
  }

  return scheduledCount;
};

const DEFAULT_REBOOKING_STEPS = () => automationService.buildDefaultConfig().rebooking.steps || [];

function pickRebookingMessage(customMessage, step, fallbackStep) {
  const custom = typeof customMessage === 'string' ? customMessage.trim() : '';
  if (custom) return custom;

  const stepMsg = typeof step?.message === 'string' ? step.message.trim() : '';
  if (stepMsg) return stepMsg;

  const fallbackMsg = typeof fallbackStep?.message === 'string' ? fallbackStep.message.trim() : '';
  if (fallbackMsg) return fallbackMsg;

  return '';
}

function pickRebookingEmailSubject(customSubject, step, fallbackStep) {
  const custom = typeof customSubject === 'string' ? customSubject.trim() : '';
  if (custom) return custom;

  const stepSubject = typeof step?.email_subject === 'string' ? step.email_subject.trim() : '';
  if (stepSubject) return stepSubject;

  const fallbackSubject = typeof fallbackStep?.email_subject === 'string'
    ? fallbackStep.email_subject.trim()
    : '';
  if (fallbackSubject) return fallbackSubject;

  return 'Time to rebook — {businessName}';
}

/**
 * Service-specific multi-step follow-up campaigns (e.g. Sluice Drip Spa).
 * Each step fires N days after the visit/checkout reference date.
 */
function planFromServiceFollowUpCampaigns({ matched, referenceDate, serviceFollowupCampaignsEnabled }) {
  if (!serviceFollowupCampaignsEnabled) return null;

  const campaigns = Array.isArray(matched?.followUpCampaigns) ? matched.followUpCampaigns : [];
  const enabledSteps = campaigns.filter((step) => step.enabled !== false && coercePositiveInt(step.intervalDays));
  if (enabledSteps.length === 0) return null;

  if (matched?.rebookingEnabled === false) {
    return {
      offsetDays: null,
      source: 'service_campaign',
      items: [],
      skipReason: 'service auto-rebook is off — enable Auto-rebook on the service and Save services',
    };
  }

  const sorted = [...enabledSteps].sort((a, b) => a.intervalDays - b.intervalDays);
  const defaultSteps = DEFAULT_REBOOKING_STEPS();
  const items = sorted.map((step, index) => {
    const message = (typeof step.message === 'string' && step.message.trim())
      ? step.message.trim()
      : (defaultSteps[index]?.message || DEFAULT_FOLLOWUP_MESSAGE);

    return {
      jobType: index === 0 ? 'rebooking_initial' : `rebooking_followup_${index}`,
      step: { enabled: true, channel: 'sms' },
      message,
      emailSubject: pickRebookingEmailSubject(null, defaultSteps[index], defaultSteps[index]),
      runAt: new Date(referenceDate.getTime() + step.intervalDays * 24 * 60 * 60 * 1000),
      source: 'service_campaign',
      intervalDays: step.intervalDays,
    };
  });

  return {
    offsetDays: sorted[0].intervalDays,
    source: 'service_campaign',
    items,
    skipReason: null,
  };
}

/**
 * Pure rebooking plan — used by scheduleRebooking and tests.
 * @returns {{ offsetDays: number|null, source: string|null, items: array, skipReason: string|null }}
 */
function planRebookingCampaign({
  matched,
  config,
  referenceDate = new Date(),
  serviceFollowupCampaignsEnabled = false,
}) {
  const serviceCampaignPlan = planFromServiceFollowUpCampaigns({
    matched,
    referenceDate,
    serviceFollowupCampaignsEnabled,
  });
  if (serviceCampaignPlan) return serviceCampaignPlan;

  const defaultSteps = DEFAULT_REBOOKING_STEPS();
  const steps = Array.isArray(config?.rebooking?.steps) && config.rebooking.steps.length > 0
    ? config.rebooking.steps
    : defaultSteps;
  const initialStep = steps[0] || defaultSteps[0];
  const followup1Step = steps[1] || defaultSteps[1];
  const followup2Step = steps[2] || defaultSteps[2];
  const followupIntervalDays = coercePositiveInt(config?.rebooking?.followup_interval_days) || 14;

  let offsetDays = null;
  let source = null;
  let skipReason = null;
  const serviceReturnDays = coercePositiveInt(matched?.returnIntervalDays);

  if (matched?.rebookingEnabled !== false && serviceReturnDays) {
    offsetDays = serviceReturnDays;
    source = 'service';
  } else if (config?.rebooking?.enabled && initialStep) {
    offsetDays = Math.max(1, Math.round((initialStep.offset_minutes || 43200) / (60 * 24)));
    source = 'generic';
  } else if (serviceReturnDays && matched?.rebookingEnabled === false) {
    skipReason = 'service auto-rebook is off — enable Auto-rebook on the service and Save services';
  } else if (!config?.rebooking?.enabled) {
    skipReason = 'rebooking workflow is disabled and no service auto-rebook interval applies';
  } else {
    skipReason = 'no return interval configured on the matched service';
  }

  if (!offsetDays) {
    return { offsetDays: null, source: null, items: [], skipReason };
  }

  const initialMessage = pickRebookingMessage(
    matched?.rebookMessage,
    initialStep,
    defaultSteps[0],
  ) || 'Hi {firstName}! It\'s time for your {serviceName} at {businessName}. Book your next visit: {bookingLink}';

  const followup1Message = pickRebookingMessage(null, followup1Step, defaultSteps[1])
    || defaultSteps[1]?.message
    || 'Hi {firstName}! Just checking in — ready to schedule your next {serviceName} at {businessName}? {bookingLink}';
  const followup2Message = pickRebookingMessage(null, followup2Step, defaultSteps[2])
    || defaultSteps[2]?.message
    || 'Hi {firstName}, we\'d still love to see you for your {serviceName}. Book at {businessName}: {bookingLink}';

  const initialRunAt = new Date(referenceDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const followup1RunAt = new Date(initialRunAt.getTime() + followupIntervalDays * 24 * 60 * 60 * 1000);
  const followup2RunAt = new Date(followup1RunAt.getTime() + followupIntervalDays * 24 * 60 * 60 * 1000);

  const items = [
    {
      jobType: 'rebooking_initial',
      step: initialStep,
      message: initialMessage,
      emailSubject: pickRebookingEmailSubject(
        matched?.rebookEmailSubject,
        initialStep,
        defaultSteps[0],
      ),
      runAt: initialRunAt,
      source,
    },
    {
      jobType: 'rebooking_followup_1',
      step: followup1Step,
      message: followup1Message,
      emailSubject: pickRebookingEmailSubject(null, followup1Step, defaultSteps[1]),
      runAt: followup1RunAt,
      source,
    },
    {
      jobType: 'rebooking_followup_2',
      step: followup2Step,
      message: followup2Message,
      emailSubject: pickRebookingEmailSubject(null, followup2Step, defaultSteps[2]),
      runAt: followup2RunAt,
      source,
    },
  ];

  return { offsetDays, source, items, skipReason: null };
}

async function resolveMatchedServiceForRebooking(tenantId, appointment) {
  if (appointment?.matched_service_id) {
    const byId = await tenantService.getServiceById(tenantId, appointment.matched_service_id);
    if (byId) return byId;
  }
  return tenantService.matchService(tenantId, appointment?.service_name);
}

const scheduleRebooking = async (
  tenantId,
  appointmentId,
  contactId,
  contact,
  tenant,
  appointment,
  config,
  vars,
  { referenceTime } = {},
) => {
  const appointmentTime = referenceTime
    ? new Date(referenceTime)
    : new Date(appointment.scheduled_at);
  const matched = await resolveMatchedServiceForRebooking(tenantId, appointment);

  if (matched) {
    await tenantService.setAppointmentMatchedService(appointmentId, matched.id);
  }

  const plan = planRebookingCampaign({
    matched,
    config,
    referenceDate: appointmentTime,
    serviceFollowupCampaignsEnabled: !!tenant?.service_followup_campaigns_enabled,
  });

  if (!plan.offsetDays) {
    console.log(
      `[APPT-WORKFLOW] Rebooking skipped for appointment ${appointmentId}`
      + (plan.skipReason ? `: ${plan.skipReason}` : ''),
    );
    return { scheduledCount: 0, skipReason: plan.skipReason || 'rebooking not configured' };
  }

  const serviceVars = {
    ...vars,
    serviceName: matched?.name || appointment.service_name || vars.serviceName,
  };

  let scheduledCount = 0;
  const now = new Date();
  let skippedFollowUps = 0;

  for (const item of plan.items) {
    if (!item.message?.trim() || !item.runAt || item.runAt <= now) continue;

    const isInitial = item.jobType === 'rebooking_initial';
    const fromLegacyService = item.source === 'service';
    if (item.step?.enabled === false && !fromLegacyService) {
      skippedFollowUps += 1;
      continue;
    }
    if (isInitial && item.step?.enabled === false && !fromLegacyService) continue;

    const body = automationService.renderTemplate(item.message, serviceVars);
    const subject = automationService.renderTemplate(item.emailSubject, serviceVars);
    const channel = item.step?.channel || plan.items[0]?.step?.channel || 'sms';
    const channels = automationService.channelsForStep(channel);

    for (const ch of channels) {
      await appointmentService.scheduleWorkflowJob(tenantId, appointmentId, contactId, item.jobType, {
        scheduledAt: item.runAt.toISOString(),
        channel: ch,
        messageBody: body,
        emailSubject: ch === 'email' ? subject : null,
      });
      scheduledCount += 1;
    }
  }

  if (scheduledCount > 0) {
    console.log(
      `[APPT-WORKFLOW] Scheduled ${plan.source} rebooking campaign (${scheduledCount} job(s))`
      + ` starting ${plan.offsetDays}d after visit for appointment ${appointmentId}`
      + (matched ? ` (${matched.name})` : ''),
    );
    return {
      scheduledCount,
      skipReason: null,
      offsetDays: plan.offsetDays,
      source: plan.source,
    };
  }

  const skipReason = skippedFollowUps > 0
    ? 'rebooking follow-up steps are disabled in Workflows → Rebooking'
    : 'no future send times (checkout date may be too far in the past)';
  console.log(`[APPT-WORKFLOW] Rebooking skipped for appointment ${appointmentId}: ${skipReason}`);
  return { scheduledCount: 0, skipReason, offsetDays: plan.offsetDays, source: plan.source };
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

/**
 * Re-schedule pre-visit automations for an upcoming appointment without sending
 * immediate confirmation/reschedule messages (used after go-live recovery).
 */
const redeployBookingWorkflowsForAppointment = async (tenantId, appointmentId) => {
  const apptResult = await db.query(
    `SELECT id, contact_id, status, scheduled_at, provider
     FROM appointments WHERE id = $1 AND tenant_id = $2`,
    [appointmentId, tenantId],
  );
  const apptRow = apptResult.rows[0];
  if (!apptRow) {
    throw Object.assign(new Error('Appointment not found'), { statusCode: 404, isOperational: true });
  }
  if (!['scheduled', 'rescheduled'].includes(apptRow.status)) {
    return { appointmentId, skipped: true, reason: 'not_upcoming', jobsScheduled: 0 };
  }
  if (new Date(apptRow.scheduled_at) <= new Date()) {
    return { appointmentId, skipped: true, reason: 'past', jobsScheduled: 0 };
  }

  const contactId = apptRow.contact_id;
  const [tenantRow, contactRow, appointmentRow] = await Promise.all([
    db.query(
      `SELECT name, phone_number, timezone, booking_link, email_from_name, email_from_address,
              appointment_automation_config, optimantra_checkout_automations,
              service_followup_campaigns_enabled
       FROM tenants WHERE id = $1`,
      [tenantId],
    ),
    db.query('SELECT first_name, last_name, phone, email, unsubscribed FROM contacts WHERE id = $1', [contactId]),
    db.query(
      `SELECT scheduled_at, service_name, timezone, provider, matched_service_id
       FROM appointments WHERE id = $1`,
      [appointmentId],
    ),
  ]);

  const tenant = tenantRow.rows[0];
  const contact = contactRow.rows[0];
  const appointment = appointmentRow.rows[0];

  if (!tenant || !contact || !appointment) {
    return { appointmentId, skipped: true, reason: 'missing_context', jobsScheduled: 0 };
  }
  if (contact.unsubscribed) {
    return { appointmentId, skipped: true, reason: 'unsubscribed', jobsScheduled: 0 };
  }

  await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
  await rebookingCampaign.cancelRebookingJobsForContact(tenantId, contactId);

  const config = automationService.normalizeConfig(tenant.appointment_automation_config);
  const vars = automationService.buildTemplateVars({ tenant, contact, appointment });
  const bookingCategories = categoriesForBookingDispatch(tenant, appointment);

  const jobsScheduled = await scheduleAutomationSteps(
    tenantId,
    appointmentId,
    contactId,
    contact,
    tenant,
    appointment,
    config,
    vars,
    { categories: bookingCategories, skipImmediate: true },
  );

  let rebookingJobs = 0;
  if (shouldScheduleRebookingOnBooking(tenant, appointment)) {
    const rebookingResult = await scheduleRebooking(
      tenantId,
      appointmentId,
      contactId,
      contact,
      tenant,
      appointment,
      config,
      vars,
    );
    rebookingJobs = rebookingResult.scheduledCount || 0;
  }

  console.log(
    `[APPT-WORKFLOW] Redeployed booking workflows for appointment ${appointmentId}:`
    + ` ${jobsScheduled} pre-visit job(s)`,
  );

  return {
    appointmentId,
    contactId,
    jobsScheduled: jobsScheduled + rebookingJobs,
    preVisitJobs: jobsScheduled,
    rebookingJobs,
  };
};

const redeployUpcomingBookingWorkflows = async (tenantId, { dryRun = false } = {}) => {
  const result = await db.query(
    `SELECT a.id, a.contact_id, a.scheduled_at, a.status,
            c.first_name, c.last_name, c.phone
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE a.tenant_id = $1
       AND a.status IN ('scheduled', 'rescheduled')
       AND a.scheduled_at > NOW()
     ORDER BY a.scheduled_at ASC`,
    [tenantId],
  );

  const outcomes = [];

  for (const row of result.rows) {
    const label = [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone || row.id;
    if (dryRun) {
      outcomes.push({
        appointmentId: row.id,
        contactName: label,
        scheduledAt: row.scheduled_at,
        dryRun: true,
      });
      continue;
    }

    try {
      const outcome = await redeployBookingWorkflowsForAppointment(tenantId, row.id);
      outcomes.push({
        ...outcome,
        contactName: label,
        scheduledAt: row.scheduled_at,
      });
    } catch (err) {
      console.error(`[APPT-WORKFLOW] Redeploy failed for appointment ${row.id}:`, err.message);
      outcomes.push({
        appointmentId: row.id,
        contactName: label,
        scheduledAt: row.scheduled_at,
        error: err.message,
        jobsScheduled: 0,
      });
    }
  }

  const redeployed = outcomes.filter((o) => (o.jobsScheduled || 0) > 0).length;
  const skipped = outcomes.filter((o) => o.skipped).length;
  const failed = outcomes.filter((o) => o.error).length;
  const totalJobs = outcomes.reduce((sum, o) => sum + (o.jobsScheduled || 0), 0);

  return {
    dryRun,
    appointmentsFound: result.rows.length,
    redeployed,
    skipped,
    failed,
    totalJobsScheduled: totalJobs,
    outcomes,
  };
};

module.exports = {
  dispatchWorkflows,
  dispatchCheckoutWorkflows,
  redeployBookingWorkflowsForAppointment,
  redeployUpcomingBookingWorkflows,
  isOptimantraCheckoutMode,
  PRE_VISIT_CATEGORIES,
  POST_VISIT_CATEGORIES,
  planRebookingCampaign,
  pickRebookingMessage,
  coercePositiveInt,
};
