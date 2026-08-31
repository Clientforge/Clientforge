const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db/connection');
const shopmonkeyService = require('../services/shopmonkey.service');

async function loadTenant(tenantId) {
  const result = await db.query(
    'SELECT id, active, name FROM tenants WHERE id = $1',
    [tenantId],
  );
  return result.rows[0] || null;
}

/**
 * POST /api/v1/webhook/shopmonkey/:tenantId
 * Shopmonkey webhook (tenant-scoped — Southlake Autocare only in UI, any tenant with connection works).
 */
router.post('/:tenantId', async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const tenant = await loadTenant(tenantId);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    if (!tenant.active) {
      return res.status(403).json({ error: 'Tenant account is deactivated' });
    }

    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const result = await shopmonkeyService.handleWebhook(
      tenantId,
      rawBody,
      req.headers,
      req.body || {},
    );

    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
