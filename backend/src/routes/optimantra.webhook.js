const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/connection');
const { normalizeOptimantraPayload } = require('../adapters/optimantra.adapter');
const { normalizeOptimantraSuperbillPayload } = require('../adapters/optimantra-superbill.adapter');
const appointmentService = require('../services/appointment.service');
const appointmentWorkflowService = require('../services/appointment-workflow.service');
const optimantraCheckoutService = require('../services/optimantra-checkout.service');

function verifyWebhookSecret(req, secret) {
  if (!secret) return true;
  const header = req.headers['x-optimantra-webhook-secret'] || req.query.secret;
  return header === secret;
}

async function loadTenant(tenantId) {
  const tenantResult = await db.query(
    'SELECT id, active, optimantra_webhook_secret FROM tenants WHERE id = $1',
    [tenantId],
  );
  return tenantResult.rows[0] || null;
}

async function handleOptimantraBookingWebhook(req, res, next) {
  try {
    const { tenantId } = req.params;
    const tenant = await loadTenant(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }
    if (!verifyWebhookSecret(req, tenant.optimantra_webhook_secret)) {
      console.warn('[WEBHOOK][OPTIMANTRA] Invalid secret for tenant', tenantId);
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const body = req.body || {};
    console.log(
      '[WEBHOOK][OPTIMANTRA] Booking received for tenant',
      tenantId,
      'keys:',
      Object.keys(body).join(', ') || '(empty)',
    );

    const normalized = normalizeOptimantraPayload(body);
    if (!normalized) {
      console.warn('[WEBHOOK][OPTIMANTRA] Unrecognized booking payload — skipping');
      return res.status(200).json({ received: true, skipped: 'Unrecognized payload' });
    }

    const { contact, appointment } = normalized;

    if (!contact.phone && !contact.email) {
      console.warn('[WEBHOOK][OPTIMANTRA] No phone or email in payload — skipping');
      return res.status(200).json({ received: true, skipped: 'No contact info' });
    }

    const result = await appointmentService.processBookingEvent(tenant.id, {
      eventType: normalized.eventType,
      contact,
      appointment,
      contactSource: 'optimantra',
    });

    await appointmentWorkflowService.dispatchWorkflows(tenant.id, result);

    return res.status(200).json({
      success: true,
      eventType: result.eventType,
      appointmentId: result.appointmentId,
      contactId: result.contactId,
    });
  } catch (err) {
    return next(err);
  }
}

async function handleOptimantraSuperbillWebhook(req, res, next) {
  try {
    const { tenantId } = req.params;
    const tenant = await loadTenant(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }
    if (!verifyWebhookSecret(req, tenant.optimantra_webhook_secret)) {
      console.warn('[WEBHOOK][OPTIMANTRA-SUPERBILL] Invalid secret for tenant', tenantId);
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const body = req.body || {};
    console.log(
      '[WEBHOOK][OPTIMANTRA-SUPERBILL] Checkout received for tenant',
      tenantId,
      'keys:',
      Object.keys(body).join(', ') || '(empty)',
    );

    const normalized = normalizeOptimantraSuperbillPayload(body);
    if (!normalized) {
      console.warn('[WEBHOOK][OPTIMANTRA-SUPERBILL] Unrecognized payload — skipping');
      return res.status(200).json({ received: true, skipped: 'Unrecognized payload' });
    }

    if (!normalized.contact.phone && !normalized.contact.email) {
      console.warn('[WEBHOOK][OPTIMANTRA-SUPERBILL] No phone or email — skipping');
      return res.status(200).json({ received: true, skipped: 'No contact info' });
    }

    const result = await optimantraCheckoutService.processSuperbillCheckout(tenant.id, normalized);

    return res.status(200).json({
      success: true,
      duplicate: !!result.duplicate,
      checkoutId: result.checkoutId,
      appointmentId: result.appointmentId,
      contactId: result.contactId,
      servicesRecorded: result.servicesRecorded,
      jobsScheduled: result.jobsScheduled ?? 0,
      skipped: result.skipped || null,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST|PUT /api/v1/webhook/optimantra/:tenantId
 * OptiMantra appointment booked webhook.
 */
router.post('/:tenantId', handleOptimantraBookingWebhook);
router.put('/:tenantId', handleOptimantraBookingWebhook);

/**
 * POST|PUT /api/v1/webhook/optimantra/:tenantId/superbill
 * OptiMantra Superbill Checkout — post-visit automations (OptiMantra tenants only).
 */
router.post('/:tenantId/superbill', handleOptimantraSuperbillWebhook);
router.put('/:tenantId/superbill', handleOptimantraSuperbillWebhook);

module.exports = router;
