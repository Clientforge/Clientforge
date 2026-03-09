const crypto = require('crypto');
const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/connection');
const { normalizeCalendlyPayload } = require('../adapters/calendly.adapter');
const appointmentService = require('../services/appointment.service');
const appointmentWorkflowService = require('../services/appointment-workflow.service');

/**
 * POST /api/v1/webhook/calendly/:tenantId
 *
 * Calendly webhook endpoint. Tenant configures this URL in Calendly:
 * https://api.clientforge.ai/api/v1/webhook/calendly/{tenantId}
 *
 * Requires tenant to have calendly_webhook_signing_key set for signature verification.
 */
router.post('/:tenantId', async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    // Validate tenant exists and is active
    const tenantResult = await db.query(
      'SELECT id, active, calendly_webhook_signing_key FROM tenants WHERE id = $1',
      [tenantId],
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const tenant = tenantResult.rows[0];
    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }

    // Verify signature if signing key is configured
    const signingKey = tenant.calendly_webhook_signing_key;
    if (signingKey) {
      const signature = req.headers['calendly-webhook-signature'];
      const rawBody = req.rawBody || JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', signingKey).update(rawBody).digest('hex');
      if (!signature || signature !== expected) {
        console.warn('[WEBHOOK][CALENDLY] Invalid signature for tenant', tenantId);
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }

    const event = req.body?.event;
    if (!event || !['invitee.created', 'invitee.canceled'].includes(event)) {
      return res.status(200).json({ received: true, skipped: 'Unsupported event type' });
    }

    const normalized = normalizeCalendlyPayload(req.body);
    const { eventType, contact, appointment } = normalized;

    // Require phone or email for contact
    if (!contact.phone && !contact.email) {
      console.warn('[WEBHOOK][CALENDLY] No phone or email in payload — skipping');
      return res.status(200).json({ received: true, skipped: 'No contact info' });
    }

    const result = await appointmentService.processBookingEvent(tenant.id, {
      eventType,
      contact,
      appointment,
    });

    await appointmentWorkflowService.dispatchWorkflows(tenant.id, result);

    res.status(200).json({
      success: true,
      eventType,
      appointmentId: result.appointmentId,
      contactId: result.contactId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
