const db = require('../db/connection');
const smsService = require('./sms.service');
const compliance = require('./compliance.service');
const automationService = require('./appointment-automation.service');
const tenantService = require('./tenant-service.service');
const rebookingCampaign = require('./rebooking-campaign.service');
const {
  getTenantTimezone,
  scheduledTodayInTimezone,
  formatTimeInTimezone,
} = require('../utils/tenantTimezone');

const DEFAULT_WINBACK_DAYS = 90;
const ACTIVE_TODAY = ['scheduled', 'confirmed', 'rescheduled'];

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatTimeShort = (d, timeZone) => formatTimeInTimezone(d, timeZone);

const getWinBackContacts = async (tenantId, limit = 5) => {
  const result = await db.query(
    `WITH last_visits AS (
       SELECT DISTINCT ON (a.contact_id)
         a.contact_id,
         a.id AS appointment_id,
         a.scheduled_at,
         a.service_name,
         a.matched_service_id,
         COALESCE(ts.return_interval_days, $3)::int AS return_days,
         COALESCE(ts.name, a.service_name) AS service_label
       FROM appointments a
       LEFT JOIN tenant_services ts ON ts.id = a.matched_service_id
       WHERE a.tenant_id = $1
         AND a.status NOT IN ('cancelled')
         AND a.scheduled_at <= NOW()
       ORDER BY a.contact_id, a.scheduled_at DESC
     )
     SELECT c.id AS contact_id, c.first_name, c.last_name, c.phone,
            lv.appointment_id, lv.scheduled_at AS last_visit_at,
            lv.service_label, lv.return_days,
            EXTRACT(DAY FROM NOW() - lv.scheduled_at)::int AS days_since_visit
     FROM last_visits lv
     JOIN contacts c ON c.id = lv.contact_id
     WHERE lv.return_days > 0
       AND EXTRACT(DAY FROM NOW() - lv.scheduled_at)::int >= lv.return_days
       AND NOT EXISTS (
         SELECT 1 FROM appointments fut
         WHERE fut.tenant_id = $1
           AND fut.contact_id = lv.contact_id
           AND fut.status = ANY($2::text[])
           AND fut.scheduled_at > NOW()
       )
     ORDER BY lv.scheduled_at ASC
     LIMIT $4`,
    [tenantId, ACTIVE_TODAY, DEFAULT_WINBACK_DAYS, limit],
  );

  return result.rows.map((r) => ({
    contactId: r.contact_id,
    firstName: r.first_name,
    lastName: r.last_name,
    displayName: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.phone || 'Client',
    phone: r.phone,
    lastVisitAt: r.last_visit_at,
    daysSinceVisit: r.days_since_visit,
    serviceName: r.service_label,
    appointmentId: r.appointment_id,
    returnIntervalDays: r.return_days,
  }));
};

const getImpactStats = async (tenantId, timezone) => {
  const start = monthStart();
  const tz = timezone || await getTenantTimezone(tenantId);
  const todayClause = scheduledTodayInTimezone('scheduled_at', 3);
  const [missedCalls, remindersSent, appointmentsToday, needsReply, winBackRows] = await Promise.all([
    db.query(
      `SELECT COUNT(*)::int AS count FROM messages
       WHERE tenant_id = $1 AND message_type = 'missed_call_followup'
         AND direction = 'outbound' AND created_at >= $2`,
      [tenantId, start],
    ),
    db.query(
      `SELECT COUNT(*)::int AS count FROM appointment_workflow_jobs
       WHERE tenant_id = $1 AND job_type = 'reminder' AND status = 'sent'
         AND sent_at >= $2`,
      [tenantId, start],
    ),
    db.query(
      `SELECT COUNT(*)::int AS count FROM appointments
       WHERE tenant_id = $1
         AND status = ANY($2::text[])
         AND ${todayClause}`,
      [tenantId, ACTIVE_TODAY, tz],
    ),
    db.query(
      `SELECT COUNT(*)::int AS count FROM (
         SELECT DISTINCT ON (COALESCE(contact_id::text, 'l-' || lead_id::text))
           direction
         FROM messages
         WHERE tenant_id = $1
           AND (contact_id IS NOT NULL OR lead_id IS NOT NULL)
         ORDER BY COALESCE(contact_id::text, 'l-' || lead_id::text), created_at DESC
       ) latest WHERE direction = 'inbound'`,
      [tenantId],
    ),
    getWinBackContacts(tenantId, 100),
  ]);

  return {
    missedCallsCaptured: missedCalls.rows[0]?.count ?? 0,
    remindersSent: remindersSent.rows[0]?.count ?? 0,
    appointmentsToday: appointmentsToday.rows[0]?.count ?? 0,
    needsReplyCount: needsReply.rows[0]?.count ?? 0,
    winBackDueCount: winBackRows.length,
  };
};

const getTodayAppointments = async (tenantId, timezone) => {
  const tz = timezone || await getTenantTimezone(tenantId);
  const todayClause = scheduledTodayInTimezone('a.scheduled_at', 3);
  const result = await db.query(
    `SELECT a.id, a.scheduled_at, a.timezone, a.service_name, a.status,
            c.id AS contact_id, c.first_name, c.last_name, c.phone
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE a.tenant_id = $1
       AND a.status = ANY($2::text[])
       AND ${todayClause}
     ORDER BY a.scheduled_at ASC`,
    [tenantId, ACTIVE_TODAY, tz],
  );

  const appointments = [];
  for (const row of result.rows) {
    const displayTz = row.timezone || tz;
    const jobsResult = await db.query(
      `SELECT job_type, status, scheduled_at, sent_at
       FROM appointment_workflow_jobs
       WHERE appointment_id = $1 AND job_type IN ('reminder', 'confirmation')
       ORDER BY scheduled_at ASC`,
      [row.id],
    );
    const jobs = jobsResult.rows;
    const reminderSent = jobs.some((j) => j.job_type === 'reminder' && j.status === 'sent');
    const nextPending = jobs.find((j) => j.status === 'pending' && new Date(j.scheduled_at) > new Date());

    let automationStatus = null;
    let automationLabel = null;
    if (reminderSent) {
      automationStatus = 'reminded';
      automationLabel = 'Reminded';
    } else if (nextPending) {
      automationStatus = 'scheduled';
      automationLabel = `Sending ${formatTimeShort(nextPending.scheduled_at, displayTz)}`;
    }

    appointments.push({
      id: row.id,
      scheduledAt: row.scheduled_at,
      timezone: displayTz,
      serviceName: row.service_name,
      status: row.status,
      contactId: row.contact_id,
      contactName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone || 'Client',
      automationStatus,
      automationLabel,
    });
  }

  return appointments;
};

const classifyConversationBadge = async (tenantId, contactId, leadId, lastDirection, lastMessageType) => {
  if (contactId) {
    const future = await db.query(
      `SELECT 1 FROM appointments
       WHERE tenant_id = $1 AND contact_id = $2
         AND status = ANY($3::text[]) AND scheduled_at > NOW()
       LIMIT 1`,
      [tenantId, contactId, ACTIVE_TODAY],
    );
    if (future.rows.length > 0) {
      return { badge: 'booked', label: 'Booked' };
    }
  }

  if (lastMessageType === 'ai_reply' && lastDirection === 'outbound') {
    return { badge: 'ai_resolved', label: 'AI resolved' };
  }

  if (lastDirection === 'inbound') {
    return { badge: 'pending', label: 'Pending' };
  }

  return { badge: 'active', label: 'Active' };
};

const getRecentConversations = async (tenantId, limit = 8) => {
  const result = await db.query(
    `SELECT DISTINCT ON (participant_key)
            participant_key, body, direction, message_type, created_at,
            contact_id, lead_id, first_name, last_name, phone
     FROM (
       SELECT COALESCE(m.contact_id::text, 'l-' || m.lead_id::text) AS participant_key,
              m.body, m.direction, m.message_type, m.created_at,
              m.contact_id, m.lead_id,
              COALESCE(c.first_name, l.first_name) AS first_name,
              COALESCE(c.last_name, l.last_name) AS last_name,
              COALESCE(c.phone, l.phone) AS phone
       FROM messages m
       LEFT JOIN contacts c ON c.id = m.contact_id
       LEFT JOIN leads l ON l.id = m.lead_id
       WHERE m.tenant_id = $1
         AND (m.contact_id IS NOT NULL OR m.lead_id IS NOT NULL)
         AND NOT EXISTS (
           SELECT 1 FROM conversation_archives ca
           WHERE ca.tenant_id = $1
             AND (
               (ca.participant_type = 'contact' AND ca.participant_id = m.contact_id)
               OR (ca.participant_type = 'lead' AND ca.participant_id = m.lead_id)
             )
         )
     ) t
     ORDER BY participant_key, created_at DESC`,
    [tenantId],
  );

  const conversations = [];
  for (const row of result.rows.slice(0, limit * 2)) {
    const { badge, label } = await classifyConversationBadge(
      tenantId,
      row.contact_id,
      row.lead_id,
      row.direction,
      row.message_type,
    );
    conversations.push({
      participantType: row.contact_id ? 'contact' : 'lead',
      participantId: row.contact_id || row.lead_id,
      displayName: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.phone || 'Unknown',
      preview: (row.body || '').replace(/\n/g, ' ').trim().slice(0, 80),
      createdAt: row.created_at,
      badge,
      badgeLabel: label,
    });
  }

  conversations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return conversations.slice(0, limit);
};

const ACTIVITY_LABELS = {
  missed_call_followup: (row) => `Missed call captured — text sent to ${row.phone || 'client'}`,
  ai_reply: (row) => `AI replied to ${row.display_name || 'a client'}`,
  keyword_welcome: (row) => `Keyword welcome sent to ${row.display_name || 'new contact'}`,
  appointment_reminder: (row) => `Reminder sent to ${row.display_name || 'client'}`,
  appointment_confirmation: (row) => `Confirmation sent to ${row.display_name || 'client'}`,
  appointment_review_request: (row) => `Review request sent to ${row.display_name || 'client'}`,
  appointment_rebooking_initial: (row) => `Rebooking nudge sent to ${row.display_name || 'client'}`,
  manual: (row) => `Message sent to ${row.display_name || 'client'}`,
};

const getLiveActivity = async (tenantId, limit = 12) => {
  const messagesResult = await db.query(
    `SELECT m.id, m.message_type AS kind, m.created_at AS at,
            COALESCE(NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''),
                     NULLIF(TRIM(COALESCE(l.first_name, '') || ' ' || COALESCE(l.last_name, '')), ''),
                     c.phone, l.phone) AS display_name,
            COALESCE(c.phone, l.phone) AS phone
     FROM messages m
     LEFT JOIN contacts c ON c.id = m.contact_id
     LEFT JOIN leads l ON l.id = m.lead_id
     WHERE m.tenant_id = $1 AND m.direction = 'outbound'
       AND m.message_type IN (
         'missed_call_followup', 'ai_reply', 'keyword_welcome', 'manual',
         'appointment_reminder', 'appointment_confirmation', 'appointment_review_request',
         'appointment_rebooking_initial', 'appointment_rebooking'
       )
     ORDER BY m.created_at DESC
     LIMIT 30`,
    [tenantId],
  );

  const jobsResult = await db.query(
    `SELECT j.id, j.job_type AS kind, j.sent_at AS at,
            COALESCE(NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''), c.phone) AS display_name,
            c.phone
     FROM appointment_workflow_jobs j
     JOIN contacts c ON c.id = j.contact_id
     WHERE j.tenant_id = $1 AND j.status = 'sent' AND j.sent_at IS NOT NULL
     ORDER BY j.sent_at DESC
     LIMIT 30`,
    [tenantId],
  );

  const combined = [
    ...messagesResult.rows.map((r) => ({ source: 'message', ...r })),
    ...jobsResult.rows.map((r) => ({ source: 'job', ...r })),
  ];
  combined.sort((a, b) => new Date(b.at) - new Date(a.at));

  return combined.slice(0, limit).map((row) => {
    const jobKind = row.source === 'job' ? `appointment_${row.kind}` : row.kind;
    const labelFn = ACTIVITY_LABELS[jobKind] || ACTIVITY_LABELS[row.kind];
    const text = labelFn
      ? labelFn(row)
      : `Automation activity for ${row.display_name || 'client'}`;

    let icon = 'message';
    if (row.kind === 'missed_call_followup') icon = 'phone';
    else if (row.kind === 'reminder' || row.kind === 'confirmation') icon = 'calendar';
    else if (String(row.kind).includes('rebooking')) icon = 'rebook';
    else if (row.kind === 'ai_reply') icon = 'ai';
    else if (row.kind === 'review_request') icon = 'star';

    return {
      id: `${row.source}-${row.id}`,
      icon,
      text,
      at: row.at,
    };
  });
};

const sendWinBackNudge = async (tenantId, contactId) => {
  const hasFuture = await rebookingCampaign.hasFutureBooking(tenantId, contactId);
  if (hasFuture) {
    throw Object.assign(new Error('Client already has an upcoming appointment'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const contactResult = await db.query(
    'SELECT id, first_name, last_name, phone, unsubscribed FROM contacts WHERE id = $1 AND tenant_id = $2',
    [contactId, tenantId],
  );
  if (contactResult.rows.length === 0) {
    throw Object.assign(new Error('Contact not found'), { statusCode: 404, isOperational: true });
  }
  const contact = contactResult.rows[0];
  if (contact.unsubscribed) {
    throw Object.assign(new Error('Contact has opted out of messages'), {
      statusCode: 400,
      isOperational: true,
    });
  }

  const canSend = await compliance.canSendToContact(contactId);
  if (!canSend) {
    throw Object.assign(new Error('Cannot send to this contact'), { statusCode: 400, isOperational: true });
  }

  const apptResult = await db.query(
    `SELECT id, service_name, scheduled_at FROM appointments
     WHERE tenant_id = $1 AND contact_id = $2
       AND status NOT IN ('cancelled') AND scheduled_at <= NOW()
     ORDER BY scheduled_at DESC LIMIT 1`,
    [tenantId, contactId],
  );
  if (apptResult.rows.length === 0) {
    throw Object.assign(new Error('No past visit found for this client'), {
      statusCode: 400,
      isOperational: true,
    });
  }
  const appointment = apptResult.rows[0];

  const tenantResult = await db.query(
    'SELECT name, phone_number, booking_link FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantResult.rows[0];
  const config = await automationService.getAutomations(tenantId);
  const matched = await tenantService.matchService(tenantId, appointment.service_name);

  const vars = {
    firstName: contact.first_name || 'there',
    lastName: contact.last_name || '',
    businessName: tenant.name || 'us',
    serviceName: matched?.name || appointment.service_name || 'your visit',
    bookingLink: tenant.booking_link || '',
    appointmentDate: new Date(appointment.scheduled_at).toLocaleDateString('en-US'),
    appointmentTime: formatTimeShort(appointment.scheduled_at),
    reviewLink: '',
  };

  const template =
    matched?.rebookMessage
    || config.rebooking?.steps?.[0]?.message
    || 'Hi {firstName}! It\'s time to book your next visit with {businessName}. {bookingLink}';

  const body = automationService.renderTemplate(template, vars);

  await smsService.sendSms({
    tenantId,
    contactId,
    to: contact.phone,
    from: tenant.phone_number,
    body,
    messageType: 'appointment_rebooking_initial',
  });

  return { sent: true, contactId };
};

const getOverview = async (tenantId) => {
  const timezone = await getTenantTimezone(tenantId);
  const [impact, todayAppointments, recentConversations, liveActivity, winBack] = await Promise.all([
    getImpactStats(tenantId, timezone),
    getTodayAppointments(tenantId, timezone),
    getRecentConversations(tenantId),
    getLiveActivity(tenantId),
    getWinBackContacts(tenantId, 5),
  ]);

  return {
    timezone,
    impact,
    todayAppointments,
    recentConversations,
    liveActivity,
    winBack,
  };
};

module.exports = {
  getOverview,
  getWinBackContacts,
  sendWinBackNudge,
};
