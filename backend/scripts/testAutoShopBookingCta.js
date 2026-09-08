/**
 * Auto shop booking CTA — run: node scripts/testAutoShopBookingCta.js
 */
const {
  formatDisplayPhone,
  buildAutoShopBookingCta,
  buildAutoShopBookingTemplateExtras,
} = require('../src/utils/autoShopBookingCta');

let failed = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL: ${label} — expected ${e}, got ${a}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

function checkCond(label, cond) {
  if (!cond) {
    console.error(`FAIL: ${label}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('format E.164', formatDisplayPhone('+17709618500'), '(770) 961-8500');
check('format digits', formatDisplayPhone('7709618500'), '(770) 961-8500');
check(
  'booking CTA',
  buildAutoShopBookingCta('7709618500'),
  'Give us a call at (770) 961-8500 and our team will help you find the best appointment time',
);

const extras = buildAutoShopBookingTemplateExtras({
  name: 'Southlake Autocare',
  phone_number: '7709618500',
  booking_link: '',
});
checkCond('bookingLink uses CTA when no URL', extras.bookingLink.includes('(770) 961-8500'));
checkCond('bookingCta matches', extras.bookingCta === extras.bookingLink);
check('businessPhone', extras.businessPhone, '(770) 961-8500');

const withUrl = buildAutoShopBookingTemplateExtras({
  phone_number: '7709618500',
  booking_link: 'https://book.example.com',
});
check('keeps URL when set', withUrl.bookingLink, 'https://book.example.com');
checkCond('CTA still has phone', withUrl.bookingCta.includes('(770) 961-8500'));

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll auto shop booking CTA tests passed');
