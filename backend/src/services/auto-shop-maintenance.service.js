const db = require('../db/connection');
const { isShopmonkeyTenant } = require('../config/shopmonkeyTenant');
const appointmentService = require('./appointment.service');
const rebookingCampaign = require('./rebooking-campaign.service');

const JOB_TYPE_PREFIX = 'maintenance_reminder_';

const DEFAULT_REMINDER_MESSAGE =
  'Hi {firstName}! Based on your recent visit to {businessName}, it\'s time to schedule your next {categoryName} service ({serviceList}). Book here: {bookingLink}';

const MAINTENANCE_JOB_TYPE_SQL = `job_type LIKE 'maintenance_reminder_%'`;

function jobTypeForCategorySlug(slug) {
  return `${JOB_TYPE_PREFIX}${slug}`;
}

function isMaintenanceReminderJobType(jobType) {
  if (!jobType) return false;
  return String(jobType).startsWith(JOB_TYPE_PREFIX);
}

function slugFromJobType(jobType) {
  if (!isMaintenanceReminderJobType(jobType)) return null;
  return String(jobType).slice(JOB_TYPE_PREFIX.length);
}

function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function formatServiceList(names) {
  const list = (names || []).filter(Boolean);
  if (list.length === 0) return 'service';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list[0]}, ${list[1]}, and others`;
}

function groupClassificationsByCategory(classifications = []) {
  const groups = new Map();
  for (const item of classifications) {
    const slug = item.slug || item.categorySlug;
    if (!slug) continue;
    if (!groups.has(slug)) {
      groups.set(slug, {
        slug,
        categoryId: item.categoryId,
        categoryName: item.name || item.categoryName,
        followUpIntervalDays: item.followUpIntervalDays,
        serviceNames: [],
      });
    }
    const group = groups.get(slug);
    if (item.serviceName) group.serviceNames.push(item.serviceName);
    if (item.followUpIntervalDays != null) {
      group.followUpIntervalDays = item.followUpIntervalDays;
    }
    if (item.name || item.categoryName) {
      group.categoryName = item.name || item.categoryName;
    }
  }
  return [...groups.values()];
}

async function getTenantContext(tenantId) {
  const result = await db.query(
    'SELECT name, booking_link FROM tenants WHERE id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

async function getMaintenanceSettings(tenantId) {
  const result = await db.query(
    `SELECT maintenance_reminder_enabled
     FROM tenant_shopmonkey_connections
     WHERE tenant_id = $1`,
    [tenantId],
  );
  return {
    enabled: result.rows[0]?.maintenance_reminder_enabled !== false,
  };
}

async function getCategoryReminderConfig(tenantId, slug) {
  const result = await db.query(
    `SELECT id, slug, name, follow_up_interval_days, reminder_enabled, reminder_message
     FROM auto_shop_master_categories
     WHERE tenant_id = $1 AND slug = $2
     LIMIT 1`,
    [tenantId, slug],
  );
  return result.rows[0] || null;
}

async function hasPendingMaintenanceJobs(tenantId, contactId, appointmentId) {
  const result = await db.query(
    `SELECT 1 FROM appointment_workflow_jobs
     WHERE tenant_id = $1
       AND contact_id = $2
       AND appointment_id = $3
       AND status = 'pending'
       AND ${MAINTENANCE_JOB_TYPE_SQL}
     LIMIT 1`,
    [tenantId, contactId, appointmentId],
  );
  return result.rows.length > 0;
}

async function cancelMaintenanceReminderJobs(tenantId, contactId, appointmentId) {
  const params = [tenantId, contactId];
  let appointmentClause = '';
  if (appointmentId) {
    params.push(appointmentId);
    appointmentClause = ` AND appointment_id = $${params.length}`;
  }

  const result = await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE tenant_id = $1
       AND contact_id = $2
       AND status = 'pending'
       AND ${MAINTENANCE_JOB_TYPE_SQL}
       ${appointmentClause}
     RETURNING id`,
    params,
  );

  if (result.rowCount > 0) {
    console.log(
      `[AUTO-SHOP] Cancelled ${result.rowCount} pending maintenance reminder job(s) for contact ${contactId}`,
    );
  }

  return result.rowCount;
}

async function cancelMaintenanceReminderJobsForContact(tenantId, contactId) {
  return cancelMaintenanceReminderJobs(tenantId, contactId, null);
}

async function scheduleMaintenanceReminders({
  tenantId,
  tenantName,
  contactId,
  appointmentId,
  orderId,
  classifications = [],
  referenceAt,
  forceReschedule = false,
}) {
  if (!isShopmonkeyTenant(tenantId, tenantName)) {
    return { scheduled: false, reason: 'not_shopmonkey_tenant' };
  }

  const settings = await getMaintenanceSettings(tenantId);
  if (!settings.enabled) {
    return { scheduled: false, reason: 'maintenance_reminders_disabled' };
  }

  const groups = groupClassificationsByCategory(classifications);
  if (groups.length === 0) {
    return { scheduled: false, reason: 'no_classifications' };
  }

  if (!forceReschedule) {
    const alreadyScheduled = await hasPendingMaintenanceJobs(tenantId, contactId, appointmentId);
    if (alreadyScheduled) {
      return { scheduled: false, reason: 'already_scheduled' };
    }
  }

  const [tenant, contactRow] = await Promise.all([
    getTenantContext(tenantId),
    db.query(
      'SELECT first_name, phone FROM contacts WHERE id = $1 AND tenant_id = $2',
      [contactId, tenantId],
    ),
  ]);

  const contact = contactRow.rows[0];
  if (!contact?.phone) {
    return { scheduled: false, reason: 'no_phone' };
  }

  const base = referenceAt ? new Date(referenceAt) : new Date();
  if (Number.isNaN(base.getTime())) {
    return { scheduled: false, reason: 'invalid_reference_date' };
  }

  await cancelMaintenanceReminderJobs(tenantId, contactId, appointmentId);

  const businessName = tenant?.name || 'our shop';
  const bookingLink = (tenant?.booking_link || '').trim() || businessName;
  const firstName = contact.first_name || 'there';

  const scheduledJobs = [];
  for (const group of groups) {
    const category = await getCategoryReminderConfig(tenantId, group.slug);
    if (!category || category.reminder_enabled === false) continue;

    const intervalDays = Number(category.follow_up_interval_days);
    if (!Number.isFinite(intervalDays) || intervalDays <= 0) continue;

    const scheduledAt = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);
    if (scheduledAt <= new Date()) continue;

    const categoryName = category.name || group.categoryName || 'maintenance';
    const serviceList = formatServiceList(group.serviceNames);
    const vars = {
      firstName,
      businessName,
      bookingLink,
      categoryName,
      serviceList,
      serviceName: serviceList,
    };

    const template = category.reminder_message?.trim() || DEFAULT_REMINDER_MESSAGE;
    const messageBody = renderTemplate(template, vars);

    await appointmentService.scheduleWorkflowJob(
      tenantId,
      appointmentId,
      contactId,
      jobTypeForCategorySlug(group.slug),
      {
        scheduledAt: scheduledAt.toISOString(),
        channel: 'sms',
        messageBody,
      },
    );

    scheduledJobs.push({
      categorySlug: group.slug,
      categoryName,
      intervalDays,
      scheduledAt: scheduledAt.toISOString(),
      jobType: jobTypeForCategorySlug(group.slug),
    });
  }

  if (scheduledJobs.length === 0) {
    return { scheduled: false, reason: 'no_eligible_categories' };
  }

  return {
    scheduled: true,
    orderId: orderId || null,
    jobs: scheduledJobs,
    jobCount: scheduledJobs.length,
  };
}

module.exports = {
  DEFAULT_REMINDER_MESSAGE,
  JOB_TYPE_PREFIX,
  MAINTENANCE_JOB_TYPE_SQL,
  jobTypeForCategorySlug,
  isMaintenanceReminderJobType,
  slugFromJobType,
  groupClassificationsByCategory,
  formatServiceList,
  renderTemplate,
  scheduleMaintenanceReminders,
  cancelMaintenanceReminderJobs,
  cancelMaintenanceReminderJobsForContact,
  getMaintenanceSettings,
};
