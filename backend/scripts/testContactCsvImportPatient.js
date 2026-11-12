#!/usr/bin/env node
const assert = require('assert');
const { parse } = require('csv-parse/sync');
const { resolveContactNameFieldsFromRow } = require('../src/services/contact.service');

const csv = `Patient,Phone,Last Visit
"CATO, DANIA L",281-804-9405,11/11/2026
"Musgrove, Michael",254-258-9531,11/11/2026
`;

const [row1, row2] = parse(csv, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const names1 = resolveContactNameFieldsFromRow(row1, { allowPatientColumn: true });
assert.strictEqual(names1.lastName, 'CATO');
assert.strictEqual(names1.firstName, 'DANIA L');

const names2 = resolveContactNameFieldsFromRow(row2, { allowPatientColumn: true });
assert.strictEqual(names2.lastName, 'Musgrove');
assert.strictEqual(names2.firstName, 'Michael');

const blocked = resolveContactNameFieldsFromRow(row1, { allowPatientColumn: false });
assert.strictEqual(blocked.firstName, '');
assert.strictEqual(blocked.lastName, '');

const explicit = resolveContactNameFieldsFromRow({
  first_name: 'Jane',
  last_name: 'Doe',
  Patient: 'IGNORED, IGNORED',
});
assert.strictEqual(explicit.firstName, 'Jane');
assert.strictEqual(explicit.lastName, 'Doe');

console.log('[testContactCsvImportPatient] OK');
