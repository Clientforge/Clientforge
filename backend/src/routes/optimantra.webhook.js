const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/connection');
const { normalizeOptimantraPayload } = require('../adapters/optimantra.adapter');
const appointmentService = require('../services/appointment.service');
const appointmentWorkflowService = require('../services/appointment-workflow.service');

function verifyWebhookSecret(req, secret) {
  if (!secret) return true;
  const header = req.headers['x-optimantra-webhook-secret'] || req.query.secret;
  return header === secret;
}

async function handleOptimantraWebhook(req, res, next) {
  try {
    const { tenantId } = req.params;

    const tenantResult = await db.query(
      'SELECT id, active, optimantra_webhook_secret FROM tenants WHERE id = $1',
      [tenantId],
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];
    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }

    if (!verifyWebhookSecret(req, tenant.optimantra_webhook_secret)) {
      console.warn('[WEBHOOK][OPTIMANTRA] Invalid secret for tenant', tenantId);
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const body = req.body || {};
    console.log(
      '[WEBHOOK][OPTIMANTRA] Received for tenant',
      tenantId,
      'keys:',
      Object.keys(body).join(', ') || '(empty)',
    );

    const normalized = normalizeOptimantraPayload(body);
    if (!normalized) {
      console.warn('[WEBHOOK][OPTIMANTRA] Unrecognized payload shape — skipping');
      return res.status(200).json({ received: true, skipped: 'Unrecognized payload' });
    }

    const { eventType, contact, appointment } = normalized;

    if (!contact.phone && !contact.email) {
      console.warn('[WEBHOOK][OPTIMANTRA] No phone or email in payload — skipping');
      return res.status(200).json({ received: true, skipped: 'No contact info' });
    }

    const result = await appointmentService.processBookingEvent(tenant.id, {
      eventType,
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

/**
 * POST|PUT /api/v1/webhook/optimantra/:tenantId
 *
 * OptiMantra outbound webhook (Marketing → CRM Integration → Out-Bound Webhooks).
 * OptiMantra typically sends PUT requests.
 */
router.post('/:tenantId', handleOptimantraWebhook);
router.put('/:tenantId', handleOptimantraWebhook);

module.exports = router;
