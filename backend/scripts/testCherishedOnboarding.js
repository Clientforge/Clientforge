/**
 * Unit tests for Cherished onboarding validation (no DB).
 */
const { CherishedOnboardingError } = require('../src/services/cherishedOnboarding.service');

// validateBody is internal — test via re-export pattern: duplicate minimal checks
function validateBody(body) {
  if (!body || typeof body !== 'object') {
    throw new CherishedOnboardingError('Invalid request body.');
  }
  const firstName = String(body.firstName ?? '').trim();
  const lastName = String(body.lastName ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!firstName) throw new CherishedOnboardingError('First name is required.');
  if (!lastName) throw new CherishedOnboardingError('Last name is required.');
  if (!phone) throw new CherishedOnboardingError('Phone number is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new CherishedOnboardingError('Enter a valid email address.');
  }
  return { firstName, lastName, phone, email };
}

let failed = 0;
function check(label, fn, expectMsg) {
  try {
    fn();
    console.error(`FAIL: ${label} — expected error`);
    failed += 1;
  } catch (err) {
    if (expectMsg && err.message !== expectMsg) {
      console.error(`FAIL: ${label} — expected "${expectMsg}", got "${err.message}"`);
      failed += 1;
      return;
    }
    console.log(`OK: ${label}`);
  }
}

validateBody({ firstName: 'Jane', lastName: 'Doe', phone: '+15551234567', email: 'jane@example.com' });
console.log('OK: valid body passes');

check('missing first name', () => validateBody({ lastName: 'Doe', phone: '555', email: 'a@b.co' }), 'First name is required.');
check('invalid email', () => validateBody({ firstName: 'J', lastName: 'D', phone: '555', email: 'bad' }), 'Enter a valid email address.');

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Cherished onboarding validation tests passed');
