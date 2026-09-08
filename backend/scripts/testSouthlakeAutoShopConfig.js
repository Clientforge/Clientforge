/**
 * Southlake post-service review message defaults — run: node scripts/testSouthlakeAutoShopConfig.js
 */
const {
  SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE,
  isMigrationDefaultPostServiceMessage,
} = require('../src/config/southlakeAutoShop');

let failed = 0;
function check(label, ok) {
  if (!ok) {
    console.error('FAIL:', label);
    failed += 1;
    return;
  }
  console.log('OK:', label);
}

check(
  'review message includes leave-a-review link',
  SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE.includes('leave-a-review'),
);
check(
  'review message uses firstName variable',
  SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE.includes('{firstName}'),
);
check(
  'detects migration 060 call CTA default',
  isMigrationDefaultPostServiceMessage(
    'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. {bookingCta}',
  ),
);
check(
  'detects migration 058 booking link default',
  isMigrationDefaultPostServiceMessage(
    'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. Book your next visit anytime: {bookingLink}',
  ),
);
check(
  'does not flag custom review copy',
  !isMigrationDefaultPostServiceMessage(SOUTHLAKE_POST_SERVICE_REVIEW_MESSAGE),
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll Southlake auto shop config tests passed');
