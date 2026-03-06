const db = require('../db/connection');

const DEFAULT_SCHEDULE = [
  { step: 1, delay_hours: 1,   message: "Hey {firstName}, just checking - did you get a chance to book with {businessName}. Here is the link: {bookingLink}" },
  { step: 2, delay_hours: 4,   message: "Hi {firstName}, spots are filling up! Book yours now: {bookingLink}" },
  { step: 3, delay_hours: 24,  message: "Hi {firstName}, just a friendly reminder - we would love to help you out. Book here: {bookingLink}" },
  { step: 4, delay_hours: 48,  message: "Hey {firstName}, we still have a spot reserved for you at {businessName}. Do not miss out: {bookingLink}" },
  { step: 5, delay_hours: 72,  message: "Hi {firstName}, last few days to grab your appointment. Book now: {bookingLink}" },
  { step: 6, delay_hours: 120, message: "{firstName}, we do not want you to miss out. Book today: {bookingLink}" },
  { step: 7, delay_hours: 168, message: "Hi {firstName}, final reminder from {businessName}. Book anytime here: {bookingLink}" },
];

const DEFAULT_OUTREACH_WINDOW = {
  enabled: true,
  start_hour: 9,
  end_hour: 19,
  days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

const DAY_MAP = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

/**
 * Apply the outreach window to a proposed send time.
 * If the time falls outside the window, push it to the next valid slot.
 */
const applyOutreachWindow = (proposedTime, window, timezone) => {
  if (!window || !window.enabled) return proposedTime;

  const tz = timezone || 'America/New_York';
  let adjusted = new Date(proposedTime);

  // Try up to 14 days ahead to find a valid slot
  for (let attempt = 0; attempt < 14 * 24; attempt++) {
    const localStr = adjusted.toLocaleString('en-US', { timeZone: tz });
    const local = new Date(localStr);
    const hour = local.getHours();
    const dayName = DAY_MAP[local.getDay()];

    const isAllowedDay = window.days.includes(dayName);
    const isAllowedHour = hour >= window.start_hour && hour < window.end_hour;

    if (isAllowedDay && isAllowedHour) {
      return adjusted;
    }

    // If it's too late in the day or not an allowed day, jump to next day at start_hour
    if (!isAllowedDay || hour >= window.end_hour) {
      // Move to next day at start_hour
      local.setDate(local.getDate() + 1);
      local.setHours(window.start_hour, 0, 0, 0);
      adjusted = new Date(local.toLocaleString('en-US', { timeZone: tz }));
      // Convert back to UTC-ish by calculating offset
      const utcTarget = new Date(adjusted);
      adjusted = utcTarget;
    } else if (hour < window.start_hour) {
      // Too early — bump to start_hour same day
      local.setHours(window.start_hour, 0, 0, 0);
      adjusted = new Date(local);
    } else {
      // Shouldn't reach here, but move 1 hour forward
      adjusted = new Date(adjusted.getTime() + 60 * 60 * 1000);
    }
  }

  return adjusted;
};

/**
 * Interpolate template variables in a message.
 */
const interpolateMessage = (template, vars) => {
  return template
    .replace(/\{firstName\}/g, vars.firstName || 'there')
    .replace(/\{lastName\}/g, vars.lastName || '')
    .replace(/\{businessName\}/g, vars.businessName || '')
    .replace(/\{bookingLink\}/g, vars.bookingLink || '')
    .replace(/\{phone\}/g, vars.phone || '');
};

/**
 * Schedule follow-up messages for a lead based on the tenant's config.
 * Called after a booking link is sent.
 */
const scheduleFollowUps = async (leadId, tenantId) => {
  // Get tenant config
  const tenantResult = await db.query(
    'SELECT name, booking_link, timezone, followup_config FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantResult.rows[0];

  // Get lead info
  const leadResult = await db.query(
    'SELECT first_name, last_name, phone FROM leads WHERE id = $1',
    [leadId],
  );
  const lead = leadResult.rows[0];

  // Parse tenant config or use defaults
  const config = tenant.followup_config || {};
  const schedule = config.schedule || DEFAULT_SCHEDULE;
  const outreachWindow = config.outreach_window || DEFAULT_OUTREACH_WINDOW;

  const bookingLink = tenant.booking_link || 'https://calendly.com/your-link';
  const now = new Date();

  const templateVars = {
    firstName: lead.first_name || 'there',
    lastName: lead.last_name || '',
    businessName: tenant.name,
    bookingLink,
    phone: lead.phone,
  };

  // Cancel any existing pending follow-ups for this lead
  await db.query(
    `UPDATE follow_ups SET status = 'cancelled', cancelled_at = NOW() WHERE lead_id = $1 AND status = 'pending'`,
    [leadId],
  );

  // Schedule each step
  for (const step of schedule) {
    const rawTime = new Date(now.getTime() + step.delay_hours * 60 * 60 * 1000);
    const scheduledAt = applyOutreachWindow(rawTime, outreachWindow, tenant.timezone);
    const messageBody = interpolateMessage(step.message, templateVars);

    await db.query(
      `INSERT INTO follow_ups (tenant_id, lead_id, step, message_body, status, scheduled_at)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [tenantId, leadId, step.step, messageBody, scheduledAt],
    );
  }

  // Update lead follow-up tracking
  await db.query(
    `UPDATE leads SET followup_step = 0, next_followup_at = $1, updated_at = NOW() WHERE id = $2`,
    [new Date(now.getTime() + (schedule[0]?.delay_hours || 1) * 60 * 60 * 1000), leadId],
  );

  console.log(`[FOLLOWUP] Scheduled ${schedule.length} follow-ups for lead ${leadId}`);
};

/**
 * Cancel all pending follow-ups for a lead.
 * Called when: lead replies, lead books, lead opts out.
 */
const cancelFollowUps = async (leadId) => {
  const result = await db.query(
    `UPDATE follow_ups
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE lead_id = $1 AND status = 'pending'
     RETURNING id`,
    [leadId],
  );

  const count = result.rowCount;
  if (count > 0) {
    console.log(`[FOLLOWUP] Cancelled ${count} pending follow-ups for lead ${leadId}`);
  }

  // Clear next_followup on the lead
  await db.query(
    'UPDATE leads SET next_followup_at = NULL, updated_at = NOW() WHERE id = $1',
    [leadId],
  );

  return count;
};

module.exports = {
  scheduleFollowUps,
  cancelFollowUps,
  applyOutreachWindow,
  interpolateMessage,
  DEFAULT_SCHEDULE,
  DEFAULT_OUTREACH_WINDOW,
};
