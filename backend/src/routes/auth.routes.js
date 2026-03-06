const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const authenticate = require('../middleware/auth');

// POST /api/v1/auth/register — Create tenant + first admin user
router.post('/register', async (req, res, next) => {
  try {
    const { businessName, industry, email, password, firstName, lastName } = req.body;

    if (!businessName || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: businessName, email, password',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters',
      });
    }

    const result = await authService.registerTenant({
      businessName,
      industry,
      email,
      password,
      firstName,
      lastName,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login — Authenticate and return JWT
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: email, password',
      });
    }

    const result = await authService.login({ email, password });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh — Refresh access token
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refreshToken' });
    }

    const tokens = await authService.refreshAccessToken(refreshToken);

    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/auth/me — Get current user profile (protected)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
