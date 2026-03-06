# ClientForge.ai — Deployment Guide

## Architecture

```
┌─────────────────────────────────────────┐
│            ClientForge.ai               │
│                                         │
│  ┌──────────┐    ┌──────────────────┐   │
│  │  React   │    │  Express API     │   │
│  │  (Vite)  │───▶│  + Follow-up     │   │
│  │  :5173   │    │  Worker  :3000   │   │
│  └──────────┘    └──────┬───────────┘   │
│                         │               │
│                  ┌──────▼───────────┐   │
│                  │  PostgreSQL      │   │
│                  │  :5432           │   │
│                  └──────────────────┘   │
└─────────────────────────────────────────┘
```

## Option 1: Docker Compose (Recommended)

The simplest way to deploy. Runs everything in containers.

```bash
# 1. Copy env template
cp .env.production .env

# 2. Edit .env with your real values
#    - Set JWT_SECRET to a random string (openssl rand -hex 32)
#    - Set DB_PASSWORD to a strong password
#    - Add Twilio credentials if using live SMS

# 3. Build and start
docker-compose up -d --build

# 4. Run database migrations
docker-compose exec app node_modules/.bin/knex migrate:latest --knexfile knexfile.js

# 5. Check health
curl http://localhost:3000/health
```

### Useful commands

```bash
docker-compose logs -f app      # View API logs
docker-compose logs -f db       # View DB logs
docker-compose restart app      # Restart the API
docker-compose down             # Stop everything
docker-compose down -v          # Stop + delete data
```

---

## Option 2: Manual / VPS Deployment

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Steps

```bash
# 1. Clone and install
cd "ClientForge AI"
cd frontend && npm ci && npm run build && cd ..
cd backend && npm ci --omit=dev && cd ..

# 2. Set up PostgreSQL
createdb leadflow

# 3. Configure environment
cp .env.production backend/.env
# Edit backend/.env with your values

# 4. Run migrations
cd backend
npx knex migrate:latest
cd ..

# 5. Start the server
cd backend
NODE_ENV=production node src/index.js
```

For production, use a process manager:

```bash
# Using PM2
npm install -g pm2
cd backend
pm2 start src/index.js --name clientforge-ai
pm2 save
pm2 startup
```

---

## Option 3: Platform Deployment (Railway / Render / Fly.io)

### Railway
1. Connect your GitHub repo
2. Set root directory to `backend`
3. Add a PostgreSQL service
4. Set environment variables from `.env.production`
5. Build command: `cd ../frontend && npm ci && npm run build && cd ../backend && npm ci`
6. Start command: `npx knex migrate:latest && node src/index.js`

### Render
1. Create a Web Service pointing to repo
2. Build command: `cd frontend && npm ci && npm run build && cd ../backend && npm ci`
3. Start command: `cd backend && npx knex migrate:latest && node src/index.js`
4. Add a PostgreSQL database
5. Set environment variables

---

## Post-Deployment Checklist

- [ ] Database migrations ran successfully
- [ ] Health check returns OK: `GET /health`
- [ ] Register a test account via the UI
- [ ] JWT_SECRET is a random string (not the default)
- [ ] CORS_ORIGIN is set to your domain
- [ ] Twilio credentials configured (or SMS_MODE=mock for testing)
- [ ] Twilio webhook URL set to `https://yourdomain.com/api/v1/sms/inbound`
- [ ] SSL/HTTPS configured (use platform TLS or a reverse proxy)
- [ ] Backup strategy for PostgreSQL data

## Twilio Setup

1. Get a phone number from [twilio.com/console](https://twilio.com/console)
2. Set these environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_DEFAULT_FROM` (your Twilio phone number)
   - `SMS_MODE=live`
3. Configure Twilio webhooks in your Twilio console:
   - **Inbound messages URL**: `https://yourdomain.com/api/v1/sms/inbound`
   - **Status callback URL**: `https://yourdomain.com/api/v1/sms/status`

## Webhook Integration

External systems send leads via:

```bash
POST https://yourdomain.com/api/v1/webhook/leads
Header: x-api-key: <tenant_api_key>
Body: { "firstName": "...", "phone": "+1...", "source": "..." }
```

Generate an API key from the Settings page in the app.
