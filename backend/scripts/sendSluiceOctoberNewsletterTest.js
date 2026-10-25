/**
 * Send one test copy of the Sluice October 2026 HTML newsletter.
 *
 *   cd backend
 *   TO=you@example.com node scripts/sendSluiceOctoberNewsletterTest.js
 *
 * Optional: SLUICE_TENANT_ID (defaults to config/sluiceTenant.js)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/db/connection');
const { sendEmail } = require('../src/services/email.service');
const { SLUICE_TENANT_ID } = require('../src/config/sluiceTenant');

const NEWSLETTER_DIR = path.join(__dirname, '../../landing/newsletters/sluice-october-2026');
const SUBJECT = 'The Sluice Update — October 2026';

async function main() {
  const to = (process.env.TO || '').trim();
  if (!to) {
    console.error('Set TO=recipient@example.com');
    process.exit(1);
  }

  const htmlPath = path.join(NEWSLETTER_DIR, 'index.html');
  const textPath = path.join(NEWSLETTER_DIR, 'plain.txt');
  if (!fs.existsSync(htmlPath)) {
    console.error('Missing newsletter HTML:', htmlPath);
    process.exit(1);
  }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const textBody = fs.existsSync(textPath) ? fs.readFileSync(textPath, 'utf8') : undefined;
  const tenantId = process.env.SLUICE_TENANT_ID || SLUICE_TENANT_ID;

  let fromName;
  let fromAddress;
  const tenantRes = await db.query(
    'SELECT name, email_from_name, email_from_address FROM tenants WHERE id = $1',
    [tenantId],
  );
  const tenant = tenantRes.rows[0];
  if (tenant) {
    fromName = tenant.email_from_name || tenant.name;
    fromAddress = tenant.email_from_address || undefined;
  }

  const result = await sendEmail({
    tenantId,
    to,
    subject: SUBJECT,
    body: html,
    textBody,
    fromName,
    fromAddress,
  });

  console.log('Result:', result);
  process.exit(result.status === 'sent' || result.status === 'skipped' ? 0 : 1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.pool.end());
