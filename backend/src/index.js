require('dotenv').config();

const app = require('./app');
const config = require('./config');
const db = require('./db/connection');
const followupWorker = require('./workers/followup.worker');
const campaignWorker = require('./workers/campaign.worker');
const appointmentWorker = require('./workers/appointment.worker');

const startServer = async () => {
  try {
    await db.query('SELECT NOW()');
    console.log('[DB] PostgreSQL connected');
  } catch (err) {
    console.warn('[DB] PostgreSQL not available — running without database');
    console.warn(`[DB] ${err.message}`);
  }

  app.listen(config.port, () => {
    console.log(`[SERVER] ClientForge.ai API running on port ${config.port}`);
    console.log(`[SERVER] Environment: ${config.env}`);
    console.log(`[SERVER] SMS mode: ${config.sms.mode}`);
    console.log(`[SERVER] Health check: http://localhost:${config.port}/health`);

    followupWorker.startWorker();
    campaignWorker.startWorker();
    appointmentWorker.startWorker();
  });
};

startServer();
