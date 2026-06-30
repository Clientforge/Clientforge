#!/usr/bin/env node
/**
 * OptiMantra Superbill adapter tests — run: node scripts/testOptimantraSuperbillAdapter.js
 */
const fs = require('fs');
const path = require('path');
const {
  normalizeOptimantraSuperbillPayload,
  extractServices,
  titleCaseServiceType,
} = require('../src/adapters/optimantra-superbill.adapter');
const { pickPrimaryService } = require('../src/services/optimantra-checkout.service');

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`);
  return ok ? 0 : 1;
}

let failed = 0;

failed += check('titleCaseServiceType procedure', titleCaseServiceType('procedure'), 'Procedure');
failed += check('titleCaseServiceType lab work', titleCaseServiceType('Lab Work'), 'Lab Work');

const fixturePath = path.join(__dirname, '../fixtures/optimantra-sample-superbill.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const normalized = normalizeOptimantraSuperbillPayload(fixture);
if (!normalized) {
  console.log('✗ normalizeOptimantraSuperbillPayload returned null');
  failed += 1;
} else {
  failed += check('fixture firstName', normalized.contact.firstName, 'Jane');
  failed += check('fixture patientId', normalized.contact.optimantraPatientId, 'OM-PAT-8821');
  failed += check('fixture superbill externalId', normalized.checkout.externalId, 'optimantra:superbill:SB-998877');
  failed += check('fixture appointmentExternalId', normalized.checkout.appointmentExternalId, 'optimantra:12345');
  failed += check('fixture services count', normalized.services.length, 2);
  failed += check('fixture service[0] type', normalized.services[0].serviceType, 'Procedure');
  failed += check('fixture service[1] type', normalized.services[1].serviceType, 'Office Visit');
}

const primary = pickPrimaryService(normalized?.services || []);
failed += check('primary service prefers Procedure', primary?.serviceName, 'Neuromuscular Therapy Medical Massage');

const noServices = extractServices({ firstName: 'X' });
failed += check('extractServices empty', noServices.length, 0);

console.log(failed === 0 ? '\nAll OptiMantra Superbill adapter tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
