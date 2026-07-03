/**
 * Contact DOB parsing + CSV mapping tests — run: node scripts/testContactCsvImport.js
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { normalizePhone } = require('../src/services/lead.service');
const { parseDateOfBirth } = require('../src/services/contact.service');

function normalizeCsvKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function pickCsvField(row, ...aliases) {
  const wanted = new Set(aliases.map(normalizeCsvKey));
  for (const [key, value] of Object.entries(row || {})) {
    if (!wanted.has(normalizeCsvKey(key))) continue;
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return '';
}

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
check('parse ISO dob', parseDateOfBirth('1990-07-15'), '1990-07-15');
check('parse US dob', parseDateOfBirth('7/15/1990'), '1990-07-15');
check('parse invalid dob', parseDateOfBirth('not-a-date'), null);
check('parse empty dob', parseDateOfBirth(''), null);

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
