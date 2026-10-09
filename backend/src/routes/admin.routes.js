const express = require('express');
const router = express.Router();
const adminService = require('../services/admin.service');
const passwordHelpService = require('../services/passwordHelp.service');
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

router.post('/tenants', async (req, res, next) => {
  try {
    const {
      businessName,
      industry,
      email,
      password,
      firstName,
      lastName,
      sendWelcomeEmail,
      sendCredentialsEmail,
    } = req.body || {};
    const result = await adminService.createTenantByAdmin({
      businessName,
      industry,
      email,
      password,
      firstName,
      lastName,
      sendWelcomeEmail: sendWelcomeEmail !== false,
      sendCredentialsEmail: sendCredentialsEmail !== false,
    });
    res.status(201).json(result);
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
    const { phoneNumber, smsProvider } = req.body;
    if (phoneNumber !== undefined) {
      const result = await adminService.updateTenantPhone(req.params.id, phoneNumber, smsProvider);
      return res.json(result);
    }
    if (smsProvider !== undefined) {
      const result = await adminService.updateTenantSmsProvider(req.params.id, smsProvider);
      return res.json(result);
    }
    res.status(400).json({ error: 'phoneNumber or smsProvider is required' });
  } catch (err) { next(err); }
});

router.post('/tenants/:id/send-welcome-email', async (req, res, next) => {
  try {
    const result = await adminService.sendWelcomeEmailToTenant(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/password-help-requests/pending-count', async (req, res, next) => {
  try {
    const count = await passwordHelpService.countPendingPasswordHelpRequests();
    res.json({ count });
  } catch (err) { next(err); }
});

router.get('/password-help-requests', async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await passwordHelpService.listPasswordHelpRequests({
      status: status || 'pending',
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 30, 100),
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.patch('/password-help-requests/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await passwordHelpService.updatePasswordHelpRequestStatus(
      req.params.id,
      req.user.id,
      status,
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/users/:userId/reset-password', async (req, res, next) => {
  try {
    const { password, sendEmail } = req.body;
    const result = await passwordHelpService.resetUserPasswordByAdmin(
      req.params.userId,
      req.user.id,
      {
        password,
        sendEmail: sendEmail !== false,
      },
    );
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
