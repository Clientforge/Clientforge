const express = require('express');
const router = express.Router();
const adminService = require('../services/admin.service');
const { getG2gEstimateSnapshots } = require('../services/graceEstimateSnapshot.service');

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getPlatformStats();
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/g2g-estimate-snapshots', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await getG2gEstimateSnapshots({
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/tenants', async (req, res, next) => {
  try {
    const { page, limit, search, sortBy, sortOrder } = req.query;
    const result = await adminService.getTenantList({
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
      search, sortBy, sortOrder,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/tenants/:id', async (req, res, next) => {
  try {
    const detail = await adminService.getTenantDetail(req.params.id);
    res.json(detail);
  } catch (err) { next(err); }
});

router.patch('/tenants/:id', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    const result = await adminService.updateTenantPhone(req.params.id, phoneNumber);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/tenants/:id/send-welcome-email', async (req, res, next) => {
  try {
    const result = await adminService.sendWelcomeEmailToTenant(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
