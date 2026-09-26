const { buildCompactEstimateTeamSms } = require('../src/services/g2gEstimateSmsFormat');

const sample = buildCompactEstimateTeamSms({
  customerName: 'John',
  year: '2020',
  make: 'Dodge',
  model: 'Charger',
  mileage: '100,000 mi',
  titleStatus: 'clean',
  startDrive: 'does_not_start',
  key: 'yes',
  tireCondition: 'flat',
  exterior: 'no_major',
  bodyDamage: { front: 'none', rear: 'none', glass: 'none', airbag: 'none' },
  zip: '30236',
  phone: '+14704492307',
  email: 'john@email.com',
});

const expectedLines = [
  'New Estimate',
  'John | 2020 Dodge Charger | 100K mi',
  "Clean title | Won't start | Keys: Yes | Tires: Flat | No major damage",
  'ZIP: 30236',
  'Phone: (470) 449-2307',
  'Email: john@email.com',
];

let failed = 0;
for (let i = 0; i < expectedLines.length; i += 1) {
  const line = sample.split('\n')[i];
  if (line !== expectedLines[i]) {
    console.error(`Line ${i + 1} mismatch.\n  expected: ${expectedLines[i]}\n  got:      ${line}`);
    failed += 1;
  }
}

if (failed) {
  console.error('\nFull message:\n', sample);
  process.exit(1);
}
console.log('g2g estimate SMS format OK');
console.log(sample);
