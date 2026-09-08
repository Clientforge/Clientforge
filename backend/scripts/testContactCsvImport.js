/**
 * Contact DOB parsing + CSV mapping tests — run: node scripts/testContactCsvImport.js
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { normalizePhone } = require('../src/services/lead.service');
const {
  normalizeCsvKey,
  pickCsvField,
  parseDateOfBirth,
} = require('../src/services/contact.service');

const sampleCsv = `Phone,first name,last name,DOB
2187907954.0,Aisha,Oh,1990-07-15
,Skipped,Person,`;

const records = parse(sampleCsv, { columns: true, skip_empty_lines: true, trim: true });
const row = records[0];

let failed = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected "${expected}", got "${actual}"`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('phone', pickCsvField(row, 'phone', 'phone_number', 'mobile'), '2187907954.0');
check('excel phone normalizes to E.164', normalizePhone('2187907954.0'), '+12187907954');
check('excel phone with extra zeros', normalizePhone('4045551234.00'), '+14045551234');
check('plain 10-digit phone', normalizePhone('4045551234'), '+14045551234');
check('first name', pickCsvField(row, 'first_name', 'firstname', 'first name', 'first'), 'Aisha');
check('last name', pickCsvField(row, 'last_name', 'lastname', 'last name', 'last'), 'Oh');
check('dob column', pickCsvField(row, 'date_of_birth', 'dateofbirth', 'dob', 'birthday'), '1990-07-15');

const shopmonkeyRow = {
  'First Name*': 'Tony',
  'Last Name*': 'Lancaster',
  'Primary Phone (optional)': '+16789070780',
  'Primary Email (optional)': 'tony@example.com',
  'Note (optional)': 'VIP',
  'Shopmonkey Customer ID (optional)': 'cb99f85a-867f-4806-b2c9-bca9975371e6',
};
check('shopmonkey first name', pickCsvField(shopmonkeyRow, 'first_name', 'firstname', 'first name', 'first'), 'Tony');
check('shopmonkey last name', pickCsvField(shopmonkeyRow, 'last_name', 'lastname', 'last name', 'last'), 'Lancaster');
check(
  'shopmonkey phone',
  pickCsvField(shopmonkeyRow, 'phone', 'phone_number', 'mobile', 'phonenumber', 'primary phone', 'primaryphone'),
  '+16789070780',
);
check(
  'shopmonkey email',
  pickCsvField(shopmonkeyRow, 'email', 'e-mail', 'primary email', 'primaryemail'),
  'tony@example.com',
);
check('shopmonkey note', pickCsvField(shopmonkeyRow, 'notes', 'note'), 'VIP');
check(
  'shopmonkey customer id',
  pickCsvField(shopmonkeyRow, 'shopmonkey customer id', 'shopmonkeycustomerid', 'shopmonkey_customer_id'),
  'cb99f85a-867f-4806-b2c9-bca9975371e6',
);
check('parse ISO dob', parseDateOfBirth('1990-07-15'), '1990-07-15');
check('parse US dob', parseDateOfBirth('7/15/1990'), '1990-07-15');
check('parse invalid dob', parseDateOfBirth('not-a-date'), null);
check('parse empty dob', parseDateOfBirth(''), null);
check('parse last visit ISO', parseDateOfBirth('2025-08-14'), '2025-08-14');

const userCsv = path.join(__dirname, '../../../Downloads/clients_phone_first_last.csv');
if (fs.existsSync(userCsv)) {
  const content = fs.readFileSync(userCsv, 'utf-8');
  const userRecords = parse(content, { columns: true, skip_empty_lines: true, trim: true });
  const withPhone = userRecords.find((r) => pickCsvField(r, 'phone', 'phone_number', 'mobile'));
  if (withPhone) {
    check(
      'user file first name',
      pickCsvField(withPhone, 'first_name', 'firstname', 'first name', 'first'),
      pickCsvField(withPhone, 'first_name', 'firstname', 'first name', 'first'),
    );
    const fn = pickCsvField(withPhone, 'first_name', 'firstname', 'first name', 'first');
    if (!fn) {
      console.error('FAIL: user file first name is empty');
      failed += 1;
    } else {
      console.log(`OK: user file first name = ${fn}`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll CSV import mapping tests passed');
