const express = require('express');
const router = express.Router();
const retentionService = require('../services/retention.service');

router.get('/overview', async (req, res, next) => {
  try {
    const overview = await retentionService.getOverview(req.tenantId);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

router.get('/contacts', async (req, res, next) => {
  try {
    const { category, bucket, page, limit } = req.query;
    const data = await retentionService.listContacts(req.tenantId, {
      category: category || 'all',
      bucket: bucket || 'not90d',
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 25, 100),
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
