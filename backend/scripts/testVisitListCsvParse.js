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

const clinic = `Patient,Rendering Provider,DOB,Sex,Age,Home Phone,Last Visit,Next Visit
"MAINS, JOSEPH M",RKS,11/26/1954,M,71Y,346-253-6798,10/30/2026,
"AUSTIN JR, MELWYN D",RKS,04/11/1943,M,83Y,713-824-5350,10/30/2026,11/05/2026
"Pritchett, Larry",,07/09/1958,M,68Y,281-705-8717,10/30/2026,
"MAINS, JOSEPH M",RKS,11/26/1954,M,71Y,346-253-6798,10/30/2026,
`;

const clinicRows = parseVisitListCsv(Buffer.from(clinic, 'utf-8'));
assert.strictEqual(clinicRows.length, 4);
assert.strictEqual(clinicRows[0].lastName, 'MAINS');
assert.strictEqual(clinicRows[0].firstName, 'JOSEPH M');
assert.strictEqual(clinicRows[0].phone, '+13462536798');
assert.strictEqual(clinicRows[0].visitDate, '2026-10-30');
assert.strictEqual(clinicRows[1].lastName, 'AUSTIN JR');
assert.strictEqual(clinicRows[1].firstName, 'MELWYN D');
assert.strictEqual(clinicRows[2].lastName, 'Pritchett');
assert.strictEqual(clinicRows[2].firstName, 'Larry');
assert.strictEqual(clinicRows[0].externalId, clinicRows[3].externalId);

console.log('[testVisitListCsvParse] OK');
