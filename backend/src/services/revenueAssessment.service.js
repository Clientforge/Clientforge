const db = require('../db/connection');
const { sendEmail } = require('./email.service');

class RevenueAssessmentError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function trimStr(value, max) {
  const t = String(value ?? '').trim();
  if (!t) return '';
  return t.length > max ? t.slice(0, max) : t;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const PATIENT_COUNT_RANGES = new Set([
  'under_500',
  '500_2000',
  '2000_5000',
  '5000_10000',
  '10000_plus',
  'not_sure',
]);

const FOLLOW_UP_PROCESSES = new Set([
  'manual',
  'email_only',
  'booking_system',
  'none',
  'not_sure',
]);

function validateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new RevenueAssessmentError('Invalid request body.');
  }

  const practiceName = trimStr(body.practiceName, 200);
  const website = trimStr(body.website, 500);
  const patientCountRange = trimStr(body.patientCountRange, 48);
  const followUpProcess = trimStr(body.followUpProcess, 120);
  const growthChallenge = trimStr(body.growthChallenge, 4000);
  const firstName = trimStr(body.firstName, 80);
  const lastName = trimStr(body.lastName, 80);
  const email = trimStr(body.email, 254).toLowerCase();
  const phone = trimStr(body.phone, 32);

  if (!practiceName) {
    throw new RevenueAssessmentError('Practice name is required.');
  }
  if (!firstName) {
    throw new RevenueAssessmentError('First name is required.');
  }
  if (!lastName) {
    throw new RevenueAssessmentError('Last name is required.');
  }
  if (!email || !isValidEmail(email)) {
    throw new RevenueAssessmentError('Enter a valid email address.');
  }
  if (patientCountRange && !PATIENT_COUNT_RANGES.has(patientCountRange)) {
    throw new RevenueAssessmentError('Select a valid patient database size.');
  }
  if (followUpProcess && !FOLLOW_UP_PROCESSES.has(followUpProcess)) {
    throw new RevenueAssessmentError('Select a valid follow-up process.');
  }

  return {
    practiceName,
    website,
    patientCountRange: patientCountRange || null,
    followUpProcess: followUpProcess || null,
    growthChallenge: growthChallenge || null,
    firstName,
    lastName,
    email,
    phone: phone || null,
    utmSource: trimStr(body.utmSource, 120) || null,
    utmMedium: trimStr(body.utmMedium, 120) || null,
    utmCampaign: trimStr(body.utmCampaign, 120) || null,
    utmContent: trimStr(body.utmContent, 120) || null,
    referrer: trimStr(body.referrer, 500) || null,
  };
}

function formatLabel(key, value) {
  const labels = {
    under_500: 'Under 500',
    '500_2000': '500 – 2,000',
    '2000_5000': '2,000 – 5,000',
    '5000_10000': '5,000 – 10,000',
    '10000_plus': '10,000+',
    not_sure: 'Not sure',
    manual: 'Manual (staff calls/texts)',
    email_only: 'Basic email reminders only',
    booking_system: 'Some automation in booking system',
    none: 'No structured follow-up',
  };
  return labels[value] || value || '—';
}

async function maybeNotifyTeam(submission) {
  const notifyTo = (process.env.REVENUE_ASSESSMENT_NOTIFY_EMAIL || 'info@clientforge-ai.com').trim();
  if (!notifyTo) return;

  const lines = [
    `New Revenue Recovery Assessment submission`,
    '',
    `Practice: ${submission.practiceName}`,
    `Contact: ${submission.firstName} ${submission.lastName}`,
    `Email: ${submission.email}`,
    submission.phone ? `Phone: ${submission.phone}` : null,
    submission.website ? `Website: ${submission.website}` : null,
    submission.patientCountRange
      ? `Patient database: ${formatLabel('patientCountRange', submission.patientCountRange)}`
      : null,
    submission.followUpProcess
      ? `Follow-up today: ${formatLabel('followUpProcess', submission.followUpProcess)}`
      : null,
    submission.growthChallenge ? `Challenge: ${submission.growthChallenge}` : null,
    submission.utmSource ? `UTM source: ${submission.utmSource}` : null,
    submission.utmCampaign ? `UTM campaign: ${submission.utmCampaign}` : null,
  ].filter(Boolean);

  try {
    await sendEmail({
      tenantId: null,
      to: notifyTo,
      fromName: 'ClientForge',
      subject: `New assessment lead: ${submission.practiceName}`,
      body: lines.join('\n'),
    });
  } catch (err) {
    console.error('[revenue-assessment] notify email failed:', err.message);
  }
}

async function submitAssessment(body) {
  const input = validateBody(body);

  const result = await db.query(
    `INSERT INTO revenue_assessment_submissions (
      practice_name, website, patient_count_range, follow_up_process, growth_challenge,
      first_name, last_name, email, phone,
      utm_source, utm_medium, utm_campaign, utm_content, referrer
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id, created_at`,
    [
      input.practiceName,
      input.website || null,
      input.patientCountRange,
      input.followUpProcess,
      input.growthChallenge,
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.utmSource,
      input.utmMedium,
      input.utmCampaign,
      input.utmContent,
      input.referrer,
    ],
  );

  const row = result.rows[0];
  await maybeNotifyTeam(input);

  return {
    id: row.id,
    createdAt: row.created_at,
  };
}

module.exports = {
  submitAssessment,
  RevenueAssessmentError,
};
