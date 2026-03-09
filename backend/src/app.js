const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const errorHandler = require('./middleware/errorHandler');
const authenticate = require('./middleware/auth');
const tenantScope = require('./middleware/tenantScope');
const requireSuperAdmin = require('./middleware/superadmin');
const config = require('./config');

const app = express();

// --------------- GLOBAL MIDDLEWARE ---------------

app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    if (req.originalUrl?.startsWith('/api/v1/webhook/calendly')) {
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

// --------------- PUBLIC ROUTES ---------------

app.use('/api/v1/auth',    require('./routes/auth.routes'));
app.use('/api/v1/webhook', require('./routes/webhook.routes'));
app.use('/api/v1/webhook/calendly', require('./routes/calendly.webhook'));

// --------------- PROTECTED ROUTES ---------------

app.use('/api/v1/leads',     authenticate, tenantScope, require('./routes/leads.routes'));
app.use('/api/v1/sms',       require('./routes/sms.routes'));
app.use('/api/v1/dashboard', authenticate, tenantScope, require('./routes/dashboard.routes'));
app.use('/api/v1/settings',  authenticate, tenantScope, require('./routes/settings.routes'));
app.use('/api/v1/contacts',  authenticate, tenantScope, require('./routes/contacts.routes'));
app.use('/api/v1/campaigns', authenticate, tenantScope, require('./routes/campaigns.routes'));
app.use('/api/v1/admin',     authenticate, requireSuperAdmin, require('./routes/admin.routes'));

// --------------- STATIC FILES (production) ---------------

// Landing page (marketing site) at /
const LANDING_DIR = path.join(__dirname, '../../landing');
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(LANDING_DIR, 'privacy.html'));
});
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

// React app assets
const FRONTEND_DIR = path.join(__dirname, '../../frontend/dist');
app.use(express.static(FRONTEND_DIR));

// React SPA fallback for /login, /register, /dashboard, etc.
app.get(/^\/(?!api).*/, (req, res, next) => {
  const fs = require('fs');
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
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
