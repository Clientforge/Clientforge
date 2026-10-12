const express = require('express');
const router = express.Router();
const patientFeedbackService = require('../services/patientFeedback.service');

router.get('/', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await patientFeedbackService.listFeedback(req.tenantId, { page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
