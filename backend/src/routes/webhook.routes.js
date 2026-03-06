const express = require('express');
const router = express.Router();
const leadService = require('../services/lead.service');
const smsService = require('../services/sms.service');

/**
 * POST /api/v1/webhook/leads
 *
 * Public endpoint for external lead intake.
 * Authenticated via API key (header or query param), not JWT.
 *
 * On new lead: triggers instant SMS (Speed-to-Lead).
 */
router.post('/leads', async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key. Provide x-api-key header or api_key query param.' });
    }

    const tenant = await leadService.getTenantByApiKey(apiKey);

    if (!tenant) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }

    const { firstName, lastName, phone, email, source, metadata } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    const result = await leadService.createLead(tenant.id, {
      firstName, lastName, phone, email, source: source || 'webhook', metadata,
    });

    // Trigger instant SMS for NEW leads only
    let smsResult = null;
    if (result.isNew) {
      try {
        smsResult = await smsService.sendInitialContact(tenant.id, result.lead);
      } catch (smsErr) {
        console.error(`[WEBHOOK] SMS trigger failed for lead ${result.lead.id}:`, smsErr.message);
      }
    }

    const statusCode = result.isNew ? 201 : 200;
    res.status(statusCode).json({
      success: true,
      leadId: result.lead.id,
      isNew: result.isNew,
      status: result.isNew ? 'CONTACTED' : result.lead.status,
      speedToLeadMs: smsResult?.speedToLeadMs || null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
