const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  corsOrigin: process.env.CORS_ORIGIN || '*',

  db: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    pool: {
      min: 2,
      max: 10,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  sms: {
    mode: process.env.SMS_MODE || 'mock',
    provider: process.env.SMS_PROVIDER || 'twilio',
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    defaultFrom: process.env.TWILIO_DEFAULT_FROM || '+15551234567',
  },

  telnyx: {
    apiKey: process.env.TELNYX_API_KEY,
    messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID,
    defaultFrom: process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_DEFAULT_FROM,
  },

  email: {
    mode: process.env.EMAIL_MODE || 'mock',
    resendApiKey: process.env.RESEND_API_KEY,
    defaultFrom: process.env.EMAIL_DEFAULT_FROM || 'ClientForge.ai <noreply@clientforge.ai>',
  },

  instagram: {
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
    redirectUri: process.env.META_REDIRECT_URI,
  },
};

if (config.env === 'production') {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  if (config.sms.mode === 'live') {
    if (process.env.TWILIO_DEFAULT_FROM || process.env.SMS_PROVIDER === 'twilio') {
      required.push('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN');
    }
    if (process.env.TELNYX_PHONE_NUMBER || process.env.TELNYX_DEFAULT_FROM || process.env.SMS_PROVIDER === 'telnyx') {
      required.push('TELNYX_API_KEY');
    }
  }
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[CONFIG] Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }
}

module.exports = config;
