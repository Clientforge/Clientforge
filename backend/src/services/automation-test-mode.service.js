const db = require('../db/connection');
const { normalizePhone } = require('./lead.service');

async function getTenantAutomationTestConfig(tenantId) {
  if (!tenantId) return null;
  const result = await db.query(
    `SELECT automation_test_mode, automation_test_phone, automation_test_email, automation_live_at
     FROM tenants WHERE id = $1`,
    [tenantId],
  );
  return result.rows[0] || null;
}

function normalizeTestPhone(raw) {
  if (!raw || !String(raw).trim()) return null;
  const digits = normalizePhone(raw).replace(/\D/g, '');
  if (digits.length < 10) return null;
  return normalizePhone(raw);
}

async function buildRecipientLabel({ contactId, leadId, fallbackTo }) {
  if (contactId) {
    const result = await db.query(
      'SELECT first_name, last_name, phone, email FROM contacts WHERE id = $1',
      [contactId],
    );
    const row = result.rows[0];
    if (row) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      const detail = row.phone || row.email || fallbackTo;
      return name ? `${name}${detail ? ` (${detail})` : ''}` : (detail || fallbackTo);
    }
  }

  if (leadId) {
    const result = await db.query(
      'SELECT first_name, last_name, phone FROM leads WHERE id = $1',
      [leadId],
    );
    const row = result.rows[0];
    if (row) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
      const detail = row.phone || fallbackTo;
      return name ? `${name}${detail ? ` (${detail})` : ''}` : (detail || fallbackTo);
    }
  }

  return fallbackTo;
}

async function resolveSmsDestination(tenantId, { contactId, leadId, to, body }) {
  const cfg = await getTenantAutomationTestConfig(tenantId);
  if (!cfg?.automation_test_mode) {
    return { to, body, testMode: false, skipped: false };
  }

  const testPhone = normalizeTestPhone(cfg.automation_test_phone);
  if (!testPhone) {
    console.warn(`[TEST-MODE] Tenant ${tenantId} has test mode ON but no valid test phone — blocking SMS to ${to}`);
    return { to: null, body, testMode: true, skipped: true, reason: 'missing_test_phone' };
  }

  const label = await buildRecipientLabel({ contactId, leadId, fallbackTo: to });
  return {
    to: testPhone,
    body: `[TEST → ${label}]\n${body}`,
    testMode: true,
    skipped: false,
    intendedTo: to,
  };
}

async function resolveEmailDestination(tenantId, { contactId, to, subject, body }) {
  const cfg = await getTenantAutomationTestConfig(tenantId);
  if (!cfg?.automation_test_mode) {
    return { to, subject, body, testMode: false, skipped: false };
  }

  const testEmail = (cfg.automation_test_email || '').trim().toLowerCase();
  if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
    console.warn(`[TEST-MODE] Tenant ${tenantId} has test mode ON but no valid test email — blocking email to ${to}`);
    return { to: null, subject, body, testMode: true, skipped: true, reason: 'missing_test_email' };
  }

  const label = await buildRecipientLabel({ contactId, leadId: null, fallbackTo: to });
  return {
    to: testEmail,
    subject: `[TEST → ${label}] ${subject}`,
    body: `Originally for: ${to}\n\n${body}`,
    testMode: true,
    skipped: false,
    intendedTo: to,
  };
}

async function goLive(tenantId) {
  const cancelled = await db.query(
    `UPDATE appointment_workflow_jobs
     SET status = 'cancelled', cancelled_at = NOW()
     WHERE tenant_id = $1 AND status = 'pending'
     RETURNING id`,
    [tenantId],
  );

  await db.query(
    `UPDATE tenants SET
       automation_test_mode = false,
       automation_live_at = NOW(),
       updated_at = NOW()
     WHERE id = $1`,
    [tenantId],
  );

  return { cancelledPendingJobs: cancelled.rows.length };
}

module.exports = {
  getTenantAutomationTestConfig,
  resolveSmsDestination,
  resolveEmailDestination,
  goLive,
};
