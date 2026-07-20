const db = require('../db/connection');
const { isBookingEmailIngestEnabled } = require('../config/bookingEmailIngest');
const { processInboundBookingEmail, inboxEmail } = require('../services/bookingEmailIngest.service');

const INBOX_KEY = 'default';

async function getLastUid() {
  const r = await db.query(
    'SELECT last_uid FROM booking_email_sync_state WHERE inbox_key = $1',
    [INBOX_KEY],
  );
  if (r.rows.length === 0) return 0;
  return Number(r.rows[0].last_uid) || 0;
}

async function setLastUid(uid) {
  await db.query(
    `INSERT INTO booking_email_sync_state (inbox_key, last_uid, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (inbox_key) DO UPDATE SET last_uid = EXCLUDED.last_uid, updated_at = NOW()`,
    [INBOX_KEY, uid],
  );
}

function imapConfigured() {
  return Boolean(
    process.env.BOOKING_INBOX_IMAP_HOST
    && process.env.BOOKING_INBOX_IMAP_USER
    && process.env.BOOKING_INBOX_IMAP_PASSWORD,
  );
}

/**
 * Poll IMAP inbox for new messages (requires imapflow + mailparser).
 */
async function pollBookingInboxOnce() {
  if (!isBookingEmailIngestEnabled()) {
    return { skipped: true, reason: 'ingest_disabled' };
  }

  if (!imapConfigured()) return { skipped: true, reason: 'imap_not_configured' };

  let ImapFlow;
  let simpleParser;
  try {
    ({ ImapFlow } = require('imapflow'));
    ({ simpleParser } = require('mailparser'));
  } catch {
    console.warn('[BOOKING-EMAIL] imapflow/mailparser not installed — IMAP polling disabled');
    return { skipped: true, reason: 'imap_deps_missing' };
  }

  const client = new ImapFlow({
    host: process.env.BOOKING_INBOX_IMAP_HOST,
    port: Number(process.env.BOOKING_INBOX_IMAP_PORT || 993),
    secure: process.env.BOOKING_INBOX_IMAP_SECURE !== 'false',
    auth: {
      user: process.env.BOOKING_INBOX_IMAP_USER,
      pass: process.env.BOOKING_INBOX_IMAP_PASSWORD,
    },
    logger: false,
    socketTimeout: 120000,
    greetingTimeout: 30000,
  });

  client.on('error', (err) => {
    console.error('[BOOKING-EMAIL] IMAP client error:', err.message);
  });

  const lastUid = await getLastUid();
  let maxUid = lastUid;
  let processed = 0;

  await client.connect();
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const range = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';
      for await (const msg of client.fetch(range, { uid: true, source: true })) {
        if (msg.uid <= lastUid) continue;
        maxUid = Math.max(maxUid, msg.uid);

        const parsed = await simpleParser(msg.source);
        const messageId = parsed.messageId || `imap-uid:${msg.uid}`;
        const fromAddress = parsed.from?.text || parsed.from?.value?.[0]?.address || '';
        const subject = parsed.subject || '';
        const bodyText = parsed.text || '';
        const bodyHtml = parsed.html || '';
        const receivedAt = parsed.date || new Date();

        await processInboundBookingEmail({
          messageId,
          fromAddress,
          subject,
          bodyText,
          bodyHtml,
          receivedAt,
        });
        processed += 1;
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch (err) {
      console.warn('[BOOKING-EMAIL] IMAP logout failed:', err.message);
    }
  }

  if (maxUid > lastUid) {
    await setLastUid(maxUid);
  }

  return { ok: true, processed, lastUid: maxUid, inbox: inboxEmail() };
}

module.exports = {
  pollBookingInboxOnce,
  imapConfigured,
};
