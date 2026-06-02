/**
 * Instagram webhook adapter tests — run: node scripts/testInstagramAdapter.js
 */
const { parseInstagramWebhook } = require('../src/adapters/instagram.adapter');

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

const payload = {
  object: 'instagram',
  entry: [{
    id: '17841400000000000',
    time: 1520383572,
    messaging: [{
      sender: { id: '123456789' },
      recipient: { id: '17841400000000000' },
      timestamp: 1520383572000,
      message: {
        mid: 'mid.$abc',
        text: 'Hi there!',
      },
    }, {
      sender: { id: '999' },
      recipient: { id: '17841400000000000' },
      message: {
        mid: 'mid.echo',
        text: 'ignored',
        is_echo: true,
      },
    }],
  }],
};

const events = parseInstagramWebhook(payload);
check('parses one event', events.length, 1);
check('sender id', events[0].senderId, '123456789');
check('instagram account id', events[0].instagramAccountId, '17841400000000000');
check('message text', events[0].text, 'Hi there!');
check('message id', events[0].messageId, 'mid.$abc');
check('ignores non-instagram', parseInstagramWebhook({ object: 'page' }).length, 0);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Instagram adapter tests passed');
