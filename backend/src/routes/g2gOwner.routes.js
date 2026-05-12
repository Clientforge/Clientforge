const express = require('express');
const authenticateG2gOwner = require('../middleware/g2gOwnerAuth');
const g2gOwnerAuthService = require('../services/g2gOwnerAuth.service');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const result = await g2gOwnerAuthService.login({ username, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateG2gOwner, async (req, res, next) => {
  try {
    const profile = await g2gOwnerAuthService.getProfile(req.g2gOwner.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
