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

The app supports **dual-provider SMS**: each tenant can send via **Twilio** or **Telnyx**. Set per-tenant **SMS Provider** in **Settings → Business** (or in Admin → tenant detail). Inbound webhooks from both providers use the same URL.

When `SMS_MODE=live` in production, configure **both** credential sets on the server:

```bash
SMS_MODE=live
SMS_PROVIDER=twilio          # fallback when tenant has no sms_provider set

TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_DEFAULT_FROM=+1...    # platform default Twilio number

TELNYX_API_KEY=...
TELNYX_PHONE_NUMBER=+1...    # platform default Telnyx number
TELNYX_MESSAGING_PROFILE_ID=...
BASE_URL=https://app.clientforge-ai.com
```

**Routing order:** tenant `sms_provider` → match `from` number to `TELNYX_PHONE_NUMBER` / `TWILIO_DEFAULT_FROM` → `SMS_PROVIDER` env fallback.

### Option A: Twilio (per tenant or platform default)

1. Get a phone number from [twilio.com/console](https://twilio.com/console)
2. Set these environment variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_DEFAULT_FROM` (your Twilio phone number)
   - `SMS_MODE=live`
   - Set tenant **SMS Provider** to **Twilio** in Settings (or leave Auto if using `TWILIO_DEFAULT_FROM`)
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
   - Set tenant **SMS Provider** to **Telnyx** in Settings (or leave Auto if using `TELNYX_PHONE_NUMBER`)
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

## OptiMantra Integration

Connect OptiMantra (EMR) to automatically create contacts, track appointments, and trigger appointment automations.

### Setup — Booking webhook (pre-visit)

1. In **Settings → Integration**, copy **Booking Webhook URL** (`/api/v1/webhook/optimantra/{tenantId}`).
2. In OptiMantra: **Settings → Marketing → CRM Integration → Add New Out-Bound Webhook**.
3. Paste the URL, set **Webhook type** to **PUT**, trigger **When an Appointment is Booked**.
4. Select **all available data fields** (phone, email, name, appointment date, service, appointment ID).
5. Optional: set **OptiMantra Webhook Secret** and header `x-optimantra-webhook-secret`.

### Setup — Superbill Checkout webhook (post-visit, OptiMantra only)

1. Enable **Post-visit at checkout** in Settings → Integration → OptiMantra.
2. Copy **Superbill Checkout Webhook URL** (`/api/v1/webhook/optimantra/{tenantId}/superbill`).
3. Add a second Out-Bound Webhook in OptiMantra for **Superbill Checkout**.
4. Include patient contact, appointment ID, checkout date, and service lines with **service type**
   (Office Visit, Procedure, Lab Work, Other).

When checkout mode is enabled for an OptiMantra tenant:

- **Booking webhook** → confirmations + reminders only
- **Superbill webhook** → post-visit, review, and rebooking (timed from checkout)

Other tenants (Google Calendar, Calendly, Square, etc.) are unchanged.

### Confirmed booking webhook fields (live sample)

| OptiMantra field | ClientForge |
|------------------|-------------|
| `firstName`, `lastName` | Contact name |
| `phone`, `email` | Contact phone / email |
| `apptDate` | Appointment datetime (e.g. `Thu Jun 25 20:00:00 2026`) |
| `apptStartTime` | Used when `apptDate` has no embedded time |
| `patientDOB` | Stored in `raw_payload` only |

Enable **service/treatment** and **appointment ID** in OptiMantra when available — otherwise service defaults to `Appointment` and dedupe uses a generated hash.

### Testing

Booking adapter:

```bash
node scripts/testOptimantraAdapter.js
```

Superbill adapter (update `backend/fixtures/optimantra-sample-superbill.json` with a live payload when available):

```bash
node scripts/testOptimantraSuperbillAdapter.js
```

## Square Appointments Integration

Connect Square Appointments via OAuth (per tenant) and a platform-level webhook (once in Square Developer).

### Server environment

```bash
SQUARE_APPLICATION_ID=
SQUARE_APPLICATION_SECRET=
SQUARE_REDIRECT_URI=https://app.clientforge-ai.com/api/v1/integrations/square/callback
SQUARE_WEBHOOK_SIGNATURE_KEY=
SQUARE_ENVIRONMENT=production   # or sandbox
BASE_URL=https://app.clientforge-ai.com
```

### Square Developer setup (platform admin, once)

1. [Square Developer Dashboard](https://developer.squareup.com/apps) → your application.
2. **OAuth** → set Redirect URL to `SQUARE_REDIRECT_URI`.
3. **Webhooks** → Add endpoint:
   - URL: `https://yourdomain.com/api/v1/webhook/square`
   - Events: `booking.created`, `booking.updated`
4. Copy the endpoint **Signature Key** → `SQUARE_WEBHOOK_SIGNATURE_KEY` on Render.

### Per-tenant setup

1. **Settings → Integration → Square Appointments** → **Connect Square Appointments**.
2. Authorize the seller account (appointments + customers + catalog scopes).
3. Ensure **Automations → Services** lists match Square service names for rebooking intervals.
4. Book a test appointment in Square → verify **Automations → Appointments**.

Square webhooks include `customer_id` and `service_variation_id`; ClientForge resolves phone/email and service names via Square API using the tenant OAuth token.

### Testing

```bash
node scripts/testSquareAdapter.js
```

## Missed Call Text-Back

When a call to the business's number is not answered, configure **conditional call forwarding** on the carrier to forward the call to the tenant's platform number (Twilio or Telnyx). The app detects the forwarded call and automatically texts the caller back.

### Twilio Voice

1. In **Settings → Business**, set **SMS Phone Number** to your Twilio number and **SMS Provider** to **Twilio**.
2. In **Settings → Integration**, copy **Voice Webhook URL (Twilio)**.
3. In Twilio Console: **Phone Numbers** → [number] → **Voice** → **A CALL COMES IN** → webhook URL above.
4. In **Settings → Follow-up Engine**, enable missed-call text-back and customize the message.
5. Forward unanswered/busy/unreachable calls from the business line to the Twilio number.

### Telnyx Voice

1. In **Settings → Business**, set **SMS Phone Number** to your Telnyx toll-free and **SMS Provider** to **Telnyx**.
2. In **Settings → Integration**, copy **Voice Webhook URL (Telnyx)**.
3. In Telnyx Portal: **Voice → Voice API Applications** → create or edit app → **Webhook URL** (API v2) → paste URL above.
4. On step **Numbers**, assign your toll-free to the Voice API Application (keep the same number on your Messaging Profile for SMS).
5. In **Settings → Follow-up Engine**, enable missed-call text-back and customize the message.
6. Forward unanswered/busy/unreachable calls from the business line to the Telnyx toll-free.

### Safeguards

- **Opt-out**: Contacts who replied STOP will not receive missed-call texts.
- **Deduplication**: Same caller won't receive another missed-call text within 30 minutes.
