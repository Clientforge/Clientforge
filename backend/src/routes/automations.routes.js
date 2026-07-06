const express = require('express');
const router = express.Router();
const automationService = require('../services/appointment-automation.service');
const appointmentWorkflowService = require('../services/appointment-workflow.service');
const birthdayCampaignService = require('../services/birthday-campaign.service');
const dashboardService = require('../services/automation-dashboard.service');
const tenantService = require('../services/tenant-service.service');
const aiService = require('../services/ai.service');

router.get('/appointment-records', async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    const result = await dashboardService.listAppointmentRecords(req.tenantId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      status,
      search,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/appointment-records/:id', async (req, res, next) => {
  try {
    const record = await dashboardService.getAppointmentRecord(req.tenantId, req.params.id);
    res.json(record);
  } catch (err) { next(err); }
});

router.post('/appointment-records/:id/cancel-workflows', async (req, res, next) => {
  try {
    const result = await dashboardService.cancelAllPendingWorkflowJobs(req.tenantId, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/appointment-records/:id/redeploy-checkout-workflows', async (req, res, next) => {
  try {
    const result = await dashboardService.redeployCheckoutWorkflows(req.tenantId, req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/appointment-records/:appointmentId/workflow-jobs/:jobId/cancel', async (req, res, next) => {
  try {
    const result = await dashboardService.cancelWorkflowJob(
      req.tenantId,
      req.params.appointmentId,
      req.params.jobId,
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/booking-emails', async (req, res, next) => {
  try {
    const { page, limit, parseStatus } = req.query;
    const result = await dashboardService.listBookingEmails(req.tenantId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      parseStatus,
    });
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/booking-emails/:id', async (req, res, next) => {
  try {
    const email = await dashboardService.getBookingEmail(req.tenantId, req.params.id);
    res.json(email);
  } catch (err) { next(err); }
});

router.get('/booking-email-setup', async (req, res, next) => {
  try {
    const setup = await dashboardService.getBookingEmailSetup(req.tenantId);
    res.json(setup);
  } catch (err) { next(err); }
});

router.put('/booking-email-setup', async (req, res, next) => {
  try {
    const setup = await dashboardService.updateBookingEmailAliases(req.tenantId, req.body.aliases);
    res.json(setup);
  } catch (err) { next(err); }
});

router.post('/generate-messages', async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }
    const result = await aiService.generateAppointmentMessages(req.tenantId, category);
    res.json(result);
  } catch (err) { next(err); }
});

router.post('/refine-messages', async (req, res, next) => {
  try {
    const { category, currentSteps, instruction } = req.body;
    if (!category || !instruction) {
      return res.status(400).json({ error: 'category and instruction are required' });
    }
    const result = await aiService.refineAppointmentMessages(
      req.tenantId,
      category,
      currentSteps || [],
      instruction,
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/appointments', async (req, res, next) => {
  try {
    const config = await automationService.getAutomations(req.tenantId);
    res.json(config);
  } catch (err) { next(err); }
});

router.put('/appointments', async (req, res, next) => {
  try {
    const updated = await automationService.updateAutomations(req.tenantId, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.post('/redeploy-upcoming-booking-workflows', async (req, res, next) => {
  try {
    const dryRun = req.body?.dryRun === true || req.query.dryRun === 'true';
    const result = await appointmentWorkflowService.redeployUpcomingBookingWorkflows(
      req.tenantId,
      { dryRun },
    );
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/birthday/upcoming', async (req, res, next) => {
  try {
    const upcoming = await birthdayCampaignService.getBirthdaysThisWeek(req.tenantId);
    res.json(upcoming);
  } catch (err) { next(err); }
});

router.get('/birthday', async (req, res, next) => {
  try {
    const config = await birthdayCampaignService.getBirthdayCampaign(req.tenantId);
    res.json(config);
  } catch (err) { next(err); }
});

router.put('/birthday', async (req, res, next) => {
  try {
    const updated = await birthdayCampaignService.updateBirthdayCampaign(req.tenantId, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/services', async (req, res, next) => {
  try {
    const result = await tenantService.listServicesWithMeta(req.tenantId);
    res.json(result);
  } catch (err) { next(err); }
});

router.put('/services', async (req, res, next) => {
  try {
    const result = await tenantService.replaceServices(req.tenantId, req.body.services);
    res.json(result);
  } catch (err) { next(err); }
});

module.exports = router;
