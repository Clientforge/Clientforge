const express = require('express');
const router = express.Router();
const adminService = require('../services/admin.service');

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await adminService.getPlatformStats();
    res.json(stats);
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

module.exports = router;
