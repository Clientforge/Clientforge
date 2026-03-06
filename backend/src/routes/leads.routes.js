const express = require('express');
const router = express.Router();
const leadService = require('../services/lead.service');
const smsService = require('../services/sms.service');

// POST /api/v1/leads — Create a new lead (from authenticated dashboard user)
router.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, phone, email, source, metadata } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'phone is required' });
    }

    const result = await leadService.createLead(req.tenantId, {
      firstName, lastName, phone, email, source: source || 'manual', metadata,
    });

    // Trigger instant SMS for NEW leads only
    let smsResult = null;
    if (result.isNew) {
      try {
        smsResult = await smsService.sendInitialContact(req.tenantId, result.lead);
      } catch (smsErr) {
        console.error(`[LEADS] SMS trigger failed for lead ${result.lead.id}:`, smsErr.message);
      }
    }

    const statusCode = result.isNew ? 201 : 200;
    res.status(statusCode).json({
      ...result,
      speedToLeadMs: smsResult?.speedToLeadMs || null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leads — List leads with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, status, source, search, sortBy, sortOrder } = req.query;

    const result = await leadService.listLeads(req.tenantId, {
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 25, 100),
      status,
      source,
      search,
      sortBy,
      sortOrder,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/leads/:id — Get single lead with conversation thread
router.get('/:id', async (req, res, next) => {
  try {
    const result = await leadService.getLeadById(req.tenantId, req.params.id);

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
