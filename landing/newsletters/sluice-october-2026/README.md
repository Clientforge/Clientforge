# Sluice Drip Spa — October 2026 newsletter

## Deploy

1. Commit and push this folder (`landing/newsletters/sluice-october-2026/`).
2. Redeploy production (Render: Web Service with root `backend`, or Docker from repo root).
3. Confirm:
   - https://app.clientforge-ai.com/newsletters/sluice-october-2026/
   - https://app.clientforge-ai.com/newsletters/sluice-october-2026/images/logo.png
4. After changing image headers, send a **new** test email (Outlook caches broken images on the old message).

Image URLs in `index.html` already point at `app.clientforge-ai.com`.

## Send as a Leadflow email blast

1. In **Campaigns**, create a campaign with channel **Email** (or **Both** and put HTML in the email body field).
2. **Subject:** `The Sluice Update — October 2026` (or your preferred line).
3. **Email body:** Open `index.html` in a text editor, select all, paste into the campaign email body. It must start with `<!DOCTYPE html>` so the platform sends it as HTML (not escaped plain text).
4. Choose your audience (tags / filters). Only contacts with an email and not unsubscribed will receive it.
5. Send a test launch first if **Settings → automation test mode** is enabled (mail goes to your test inbox).
6. Launch the campaign.

Optional plain-text part: keep `plain.txt` for tools that require a text version (Resend dashboard, etc.). Leadflow campaigns currently send HTML only for newsletter paste.

## One-off test email (CLI)

From `backend/` after deploy (or locally with `EMAIL_MODE=live`):

```bash
TO=you@example.com SLUICE_TENANT_ID=5f793c52-f8e0-457b-97b5-86af987c2a8d node scripts/sendSluiceOctoberNewsletterTest.js
```

Uses the tenant’s **From** name/address from Settings when `SLUICE_TENANT_ID` is set.
