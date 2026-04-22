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
2. Set **root directory** to `backend`
3. Add a **PostgreSQL** service and attach `DATABASE_URL` to the web service
4. **Build command:** `npm install && npm run build`  
   (from `backend`, this runs `build:webapps` — builds `../grace-to-grace-web` and `../frontend`)
5. **Start command:** `npx knex migrate:latest && npm start`
6. Set environment variables from `backend/.env.example` (production values)

### Render (current setup)

Single **Web Service** + **PostgreSQL**. The API serves the built Vite apps (`frontend/dist`, `grace-to-grace-web/dist`) from Express — no separate static host required.

1. **Create PostgreSQL** in the same region as the web service. Set **`DATABASE_URL`** on the web service to that database (or use Render’s **Connect** to inject it).
2. **Create Web Service** from this repo (e.g. branch `main`):
   - **Root Directory:** `backend`  
   - **Build Command:** `npm install && npm run build`  
   - **Start Command:** `npx knex migrate:latest && npm start`  
   - **Health Check Path:** `/health`
3. **Environment variables** (see `backend/.env.example` for the full list). Minimum in production:
   - `NODE_ENV=production`
   - `JWT_SECRET` — strong random (e.g. `openssl rand -hex 32`)
   - `DATABASE_URL` — from the Render PostgreSQL instance (required for Knex migrations)
   - `CORS_ORIGIN` — e.g. `https://<your-service>.onrender.com` or your custom domain
   - `BASE_URL` — same public URL as the service (webhooks, links in emails)
   - `DB_SSL=true` if connections require SSL (use what works with Render Postgres)
4. **Open the app** at Render’s default URL, e.g. `https://<name>.onrender.com` — test `/health`, then `/demo/grace-to-grace`.
5. **Custom domain (e.g. `app.clientforge.ai`):** Web Service → **Custom Domains** → add the hostname, then at your DNS provider add the **CNAME** (or A records) Render shows. Until that DNS exists, the domain will not resolve (`DNS_PROBE_FINISHED_NXDOMAIN` = DNS, not application code).
6. The repo’s `render.example.yaml` matches the same **rootDir**, build, start, and health check for Blueprint-style deploys.

**Render: Docker (alternative)** — If you use **Environment: Docker** instead of Node: set **Root Directory** to **empty** (repository root) so Render finds the root `Dockerfile`. The multi-stage `Dockerfile` builds **`frontend/`** and **`grace-to-grace-web/`**, then runs migrations + the API. Do **not** set root to `backend` for Docker, or the build will look for `backend/Dockerfile` and fail.

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

## SMS Provider Setup

### Option A: Twilio

1. Get a phone number from [twilio.com/console](https://twilio.com/console)
2. Set these environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_DEFAULT_FROM` (your Twilio phone number)
   - `SMS_MODE=live`
   - `SMS_PROVIDER=twilio` (or omit, twilio is default)
3. Configure Twilio webhooks:
   - **Inbound messages URL**: `https://yourdomain.com/api/v1/sms/inbound`
   - **Status callback URL**: `https://yourdomain.com/api/v1/sms/status`
   - **Voice (A CALL COMES IN)**: `https://yourdomain.com/api/v1/voice/inbound` — for missed-call text-back

### Option B: Telnyx

1. Get a phone number and create a Messaging Profile at [portal.telnyx.com](https://portal.telnyx.com)
2. Set these environment variables:
   - `TELNYX_API_KEY`
   - `TELNYX_PHONE_NUMBER` (your Telnyx number)
   - `TELNYX_MESSAGING_PROFILE_ID` (optional, if not using default)
   - `SMS_MODE=live`
   - `SMS_PROVIDER=telnyx`
3. In Telnyx Messaging Profile → Inbound: set **Webhook URL** to `https://yourdomain.com/api/v1/sms/inbound`
4. In **Settings → Business**, set **SMS Phone Number** to your Telnyx number

## Webhook Integration

External systems send leads via:

```bash
POST https://yourdomain.com/api/v1/webhook/leads
Header: x-api-key: <tenant_api_key>
Body: { "firstName": "...", "phone": "+1...", "source": "..." }
```

Generate an API key from the Settings page in the app.

## Calendly Integration

Connect Calendly to automatically create contacts, track appointments, and trigger reminders, confirmations, and post-visit follow-ups.

### Setup

1. In **Settings → Integration**, copy your **Calendly Webhook URL** (e.g. `https://yourdomain.com/api/v1/webhook/calendly/{tenantId}`).
2. In Calendly: **Integrations → Webhooks → Add webhook subscription**.
3. Paste the URL and subscribe to **invitee.created** and **invitee.canceled**.
4. Copy the **Signing key** from Calendly and paste it in Settings → Calendly Webhook Signing Key, then Save.

### Workflows

- **Booking created**: Immediate confirmation SMS + reminder 24h before + post-visit follow-up 24h after.
- **Booking cancelled**: Cancellation notice + all pending reminders cancelled.
- **Booking rescheduled**: Reschedule notice + old reminders cancelled + new reminder scheduled.

### Environment

Set `BASE_URL` to your production URL (e.g. `https://api.clientforge.ai`) so the webhook URL shown in Settings is correct.

## Missed Call Text-Back

When a call to the business's number is not answered, they can configure **conditional call forwarding** on their carrier to forward the call to their platform Twilio number. Our system detects the forwarded call and automatically texts the caller back.

### Setup

1. In **Settings → Business**, set your **SMS Phone Number** to your Twilio number (this is the number that receives forwarded calls).
2. In **Settings → Integration**, copy the **Voice Webhook URL**.
3. In Twilio Console: **Phone Numbers** → select your number → **Voice** → **A CALL COMES IN** → set Webhook URL to the Voice Webhook URL.
4. In **Settings → Follow-up Engine**, customize the **Missed Call Message** (default: "Sorry we missed your call! How can we help? Reply to this message.").
5. Configure **conditional call forwarding** on your business's carrier (Verizon, AT&T, T-Mobile, etc.) to forward unanswered/busy/unreachable calls to your Twilio number.

### Safeguards

- **Opt-out**: Contacts who replied STOP will not receive missed-call texts.
- **Deduplication**: Same caller won't receive another missed-call text within 30 minutes.
