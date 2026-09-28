const express = require('express');
const router = express.Router();
const authService = require('../services/auth.service');
const authenticate = require('../middleware/auth');
const config = require('../config');
const {
  loginLimiter,
  registerLimiter,
  refreshLimiter,
  passwordHelpLimiter,
} = require('../middleware/authRateLimit');
const passwordHelpService = require('../services/passwordHelp.service');

// POST /api/v1/auth/register — Create tenant + first admin user
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    if (!config.allowPublicRegister) {
      return res.status(403).json({
        error: 'Registration is disabled. Contact ClientForge to get access.',
      });
    }

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

// POST /api/v1/auth/password-help-request — User locked out; notifies platform admin (no self-serve reset)
router.post('/password-help-request', passwordHelpLimiter, async (req, res, next) => {
  try {
    await passwordHelpService.submitPasswordHelpRequest({
      email: req.body?.email,
      message: req.body?.message,
    });
    res.json({
      ok: true,
      message: 'If an account exists for that email, our team will follow up shortly.',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login — Authenticate and return JWT
router.post('/login', loginLimiter, async (req, res, next) => {
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
router.post('/refresh', refreshLimiter, async (req, res, next) => {
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
