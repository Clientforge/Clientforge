#!/usr/bin/env node
const assert = require('assert');
const {
  parseVisitListCsv,
  parseVisitDate,
  checkoutExternalId,
} = require('../src/services/visitListCsv.parse');

const csv = `first_name,last_name,phone,visit_date
Jane,Doe,4155551234,2026-03-10
John,Smith,(510) 555-9876,03/11/2026
`;

const rows = parseVisitListCsv(Buffer.from(csv, 'utf-8'));
assert.strictEqual(rows.length, 2, 'expected 2 rows');
assert.strictEqual(rows[0].phone, '+14155551234');
assert.strictEqual(rows[0].visitDate, '2026-03-10');
assert.strictEqual(rows[1].visitDate, '2026-03-11');

assert.strictEqual(parseVisitDate('2026-01-05'), '2026-01-05');
assert.strictEqual(parseVisitDate('1/5/2026'), '2026-01-05');

const ext = checkoutExternalId('+14155551234', '2026-03-10');
assert.strictEqual(ext, 'visit_list:14155551234:2026-03-10');

console.log('[testVisitListCsvParse] OK');
