const { pollBookingInboxOnce, imapConfigured } = require('../services/bookingEmailImap.service');
const { inboxEmail } = require('../services/bookingEmailIngest.service');

const POLL_MS = Number(process.env.BOOKING_INBOX_IMAP_POLL_MS || 120000);

const startWorker = () => {
  if (!imapConfigured()) {
    console.log(
      `[BOOKING-EMAIL] IMAP worker idle — set BOOKING_INBOX_IMAP_* to poll ${inboxEmail()}`,
    );
    return;
  }

  console.log(`[BOOKING-EMAIL] IMAP worker started (every ${POLL_MS / 1000}s → ${inboxEmail()})`);

  const run = async () => {
    try {
      const result = await pollBookingInboxOnce();
      if (result.processed > 0) {
        console.log(`[BOOKING-EMAIL] Processed ${result.processed} message(s)`);
      }
    } catch (err) {
      console.error('[BOOKING-EMAIL] Poll error:', err.message);
    }
  };

  run();
  setInterval(run, POLL_MS);
};

module.exports = { startWorker, pollBookingInboxOnce };
