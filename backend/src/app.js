const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const authenticate = require('./middleware/auth');
const tenantScope = require('./middleware/tenantScope');
const requireSuperAdmin = require('./middleware/superadmin');
const config = require('./config');
const trackedLinkService = require('./services/trackedLink.service');

const app = express();

/** Prevent stale SPA shells after frontend deploys (hashed assets still cache long-term). */
function staticWithFreshIndex(rootDir) {
  return express.static(rootDir, {
    setHeaders(res, filePath) {
      if (path.basename(filePath) === 'index.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  });
}

// --------------- GLOBAL MIDDLEWARE ---------------

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (
      req.originalUrl?.startsWith('/api/v1/webhook/calendly')
      || req.originalUrl?.startsWith('/api/v1/webhook/meta')
      || req.originalUrl?.startsWith('/api/v1/webhook/square')
    ) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true }));

if (config.env !== 'test') {
  app.use(morgan('short'));
}

// --------------- HEALTH CHECK ---------------

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'clientforge-ai',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Public, unauthenticated helpers (CORS-friendly for static demo sites)
app.use('/api/v1/public', require('./routes/public.routes'));

// Grace to Grace owner portal (JWT distinct from tenant dashboard — see middleware/g2gOwnerAuth.js)
app.use('/api/v1/g2g-owner', require('./routes/g2gOwner.routes'));

// --------------- PUBLIC ROUTES ---------------

app.use('/api/v1/auth',    require('./routes/auth.routes'));
app.use('/api/v1/webhook', require('./routes/webhook.routes'));
app.use('/api/v1/webhook/calendly', require('./routes/calendly.webhook'));
app.use('/api/v1/webhook/optimantra', require('./routes/optimantra.webhook'));
app.use('/api/v1/webhook/square', require('./routes/square.webhook'));
app.use('/api/v1/webhook/google-calendar', require('./routes/googleCalendar.webhook'));
app.use('/api/v1/webhook/meta', require('./routes/meta.webhook'));
app.use('/api/v1/voice',   require('./routes/voice.routes'));

const googleCalendarService = require('./services/googleCalendar.service');
const squareService = require('./services/square.service');
const instagramService = require('./services/instagram.service');
app.get('/api/v1/integrations/google-calendar/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(googleCalendarService.appSettingsUrl(`tab=integration&gcal=error&reason=${encodeURIComponent(error)}`));
  }
  try {
    if (!code || !state) throw new Error('Missing OAuth code or state');
    await googleCalendarService.handleOAuthCallback(code, state);
    return res.redirect(googleCalendarService.appSettingsUrl('tab=integration&gcal=connected'));
  } catch (err) {
    console.error('[GCAL] OAuth callback failed:', err.message);
    return res.redirect(
      googleCalendarService.appSettingsUrl(`tab=integration&gcal=error&reason=${encodeURIComponent(err.message)}`),
    );
  }
});

app.get('/api/v1/integrations/square/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.redirect(squareService.appSettingsUrl(
      `tab=integration&square=error&reason=${encodeURIComponent(errorDescription || error)}`,
    ));
  }
  try {
    if (!code || !state) throw new Error('Missing OAuth code or state');
    await squareService.handleOAuthCallback(code, state);
    return res.redirect(squareService.appSettingsUrl('tab=integration&square=connected'));
  } catch (err) {
    console.error('[SQUARE] OAuth callback failed:', err.message);
    return res.redirect(
      squareService.appSettingsUrl(`tab=integration&square=error&reason=${encodeURIComponent(err.message)}`),
    );
  }
});

app.get('/api/v1/integrations/instagram/callback', async (req, res) => {
  const { code, state, error, error_description: errorDescription } = req.query;
  if (error) {
    return res.redirect(instagramService.appSettingsUrl(
      `tab=integration&instagram=error&reason=${encodeURIComponent(errorDescription || error)}`,
    ));
  }
  try {
    if (!code || !state) throw new Error('Missing OAuth code or state');
    await instagramService.handleOAuthCallback(code, state);
    return res.redirect(instagramService.appSettingsUrl('tab=integration&instagram=connected'));
  } catch (err) {
    console.error('[IG] OAuth callback failed:', err.message);
    return res.redirect(
      instagramService.appSettingsUrl(`tab=integration&instagram=error&reason=${encodeURIComponent(err.message)}`),
    );
  }
});

// --------------- PROTECTED ROUTES ---------------

app.use('/api/v1/leads',     authenticate, tenantScope, require('./routes/leads.routes'));
app.use('/api/v1/sms',       require('./routes/sms.routes'));
app.use('/api/v1/dashboard', authenticate, tenantScope, require('./routes/dashboard.routes'));
app.use('/api/v1/settings',  authenticate, tenantScope, require('./routes/settings.routes'));
app.use('/api/v1/integrations/google-calendar', authenticate, tenantScope, require('./routes/googleCalendar.routes'));
app.use('/api/v1/integrations/square', authenticate, tenantScope, require('./routes/square.routes'));
app.use('/api/v1/integrations/instagram', authenticate, tenantScope, require('./routes/instagram.routes'));
app.use('/api/v1/contacts',      authenticate, tenantScope, require('./routes/contacts.routes'));
app.use('/api/v1/conversations', authenticate, tenantScope, require('./routes/conversations.routes'));
app.use('/api/v1/campaigns', authenticate, tenantScope, require('./routes/campaigns.routes'));
app.use('/api/v1/automations', authenticate, tenantScope, require('./routes/automations.routes'));
app.use('/api/v1/admin',     authenticate, requireSuperAdmin, require('./routes/admin.routes'));

// --------------- STATIC FILES (production) ---------------

// Landing page (marketing site) at /
const LANDING_DIR = path.join(__dirname, '../../landing');
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'privacy.html'));
});
app.get('/terms', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'terms.html'));
});
app.get('/sms-consent', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'sms-consent.html'));
});
app.get('/contact-opt-in', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'contact-opt-in.html'));
});
app.get('/review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'restaurant-review.html'));
});
app.get('/review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'restaurant-review-feedback.html'));
});
app.get('/review/google', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'restaurant-review-google.html'));
});
app.get('/penthos-review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'penthos-kitchen-review.html'));
});
app.get('/penthos-review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'penthos-kitchen-review-feedback.html'));
});
app.get('/penthos-review/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'penthos-kitchen-review-thanks.html'));
});
app.get('/boniks-review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'boniks-cuisine-review.html'));
});
app.get('/boniks-review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'boniks-cuisine-review-feedback.html'));
});
app.get('/boniks-review/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'boniks-cuisine-review-thanks.html'));
});
app.get('/cherished-review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'cherished-aesthetics-review.html'));
});
app.get('/cherished-review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'cherished-aesthetics-review-feedback.html'));
});
app.get('/cherished-review/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'cherished-aesthetics-review-thanks.html'));
});
app.get('/sluice-review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'sluice-drip-spa-review.html'));
});
app.get('/sluice-review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'sluice-drip-spa-review-feedback.html'));
});
app.get('/sluice-review/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'sluice-drip-spa-review-thanks.html'));
});
app.get('/soothing-intention-review', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'soothing-intention-review.html'));
});
app.get('/soothing-intention-review/feedback', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'soothing-intention-review-feedback.html'));
});
app.get('/soothing-intention-review/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'soothing-intention-review-thanks.html'));
});
app.get('/cherished-onboarding', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'cherished-aesthetics-onboarding.html'));
});
app.get('/cherished-onboarding/thanks', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'cherished-aesthetics-onboarding-thanks.html'));
});

/** Grace to Grace — internal team vehicle photo review (secret link per submission). */
app.get('/g2g-review/:token', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'g2g-vehicle-review.html'));
});

/** SMS-friendly tracked redirects — before SPA fallback */
app.get('/r/:token', trackedLinkService.handleRedirect);

app.get('/services/website-creation', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'services/website-creation.html'));
});
app.get('/services/advertising-management', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'services/advertising-management.html'));
});
app.get('/services/marketing-automation', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'services/marketing-automation.html'));
});
app.get('/services/performance-tracking', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'services/performance-tracking.html'));
});
app.use(express.static(LANDING_DIR));

// Grace to Grace demo SPA — https://<host>/grace-to-grace/
const G2G_DIR = path.join(__dirname, '../../grace-to-grace-web/dist');
app.use('/grace-to-grace', staticWithFreshIndex(G2G_DIR));
app.get(/^\/grace-to-grace\/?.*$/, (req, res, next) => {
  const rel = req.path.replace(/^\/grace-to-grace\/?/, '');
  const lastSeg = rel.split('/').filter(Boolean).pop() || '';
  if (lastSeg.includes('.')) {
    return res.status(404).type('text').send('Not found');
  }
  const g2gIndex = path.join(G2G_DIR, 'index.html');
  if (!fs.existsSync(g2gIndex)) {
    return res.status(503).json({
      error: 'Grace to Grace not built',
      message:
        'grace-to-grace-web/dist is missing. On the server run: cd backend && npm run build (or npm run build:grace-to-grace). Ensure Render/rootDir is backend and the repo includes grace-to-grace-web.',
    });
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.sendFile(g2gIndex);
});

// React app assets (main ClientForge dashboard SPA)
const FRONTEND_DIR = path.join(__dirname, '../../frontend/dist');
app.use(staticWithFreshIndex(FRONTEND_DIR));

// React SPA fallback for /login, /register, /dashboard, etc. (not /grace-to-grace)
app.get(/^\/(?!api).*/, (req, res, next) => {
  if (req.path === '/grace-to-grace' || req.path.startsWith('/grace-to-grace/')) {
    return next();
  }
  if (req.path === '/penthos-review' || req.path.startsWith('/penthos-review/')) {
    return next();
  }
  if (req.path === '/boniks-review' || req.path.startsWith('/boniks-review/')) {
    return next();
  }
  if (req.path === '/cherished-review' || req.path.startsWith('/cherished-review/')) {
    return next();
  }
  if (req.path === '/sluice-review' || req.path.startsWith('/sluice-review/')) {
    return next();
  }
  if (req.path === '/soothing-intention-review' || req.path.startsWith('/soothing-intention-review/')) {
    return next();
  }
  if (req.path === '/cherished-onboarding' || req.path.startsWith('/cherished-onboarding/')) {
    return next();
  }
  if (req.path === '/g2g-review' || req.path.startsWith('/g2g-review/')) {
    return next();
  }
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(indexPath);
  }
  next();
});

// --------------- 404 HANDLER ---------------

app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `No route matches ${req.method} ${req.originalUrl}`,
  });
});

// --------------- ERROR HANDLER ---------------

app.use(errorHandler);

module.exports = app;
