const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboard.service');

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await dashboardService.getStats(req.tenantId);
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/funnel', async (req, res, next) => {
  try {
    const funnel = await dashboardService.getFunnel(req.tenantId);
    res.json(funnel);
  } catch (err) { next(err); }
});

router.get('/speed-to-lead', async (req, res, next) => {
  try {
    const data = await dashboardService.getSpeedToLead(req.tenantId);
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/recent-leads', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const leads = await dashboardService.getRecentLeads(req.tenantId, limit);
    res.json({ leads });
  } catch (err) { next(err); }
});

module.exports = router;
