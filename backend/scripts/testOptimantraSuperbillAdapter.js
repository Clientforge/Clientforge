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
const { SLUICE_TENANT_ID } = require('./sluiceCheckoutRules');

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
  failed += check('fixture service[0] name from code', normalized.services[0].serviceName, 'Neuromuscular Therapy Medical Massage');
  failed += check('fixture service[1] type', normalized.services[1].serviceType, 'Office Visit');
}

const primary = pickPrimaryService(normalized?.services || []);
failed += check('primary service prefers Procedure', primary?.serviceName, 'Neuromuscular Therapy Medical Massage');

const noServices = extractServices({ firstName: 'X' });
failed += check('extractServices empty', noServices.length, 0);

// Sluice Drip Spa — minimal live superbill (Render log shape)
const sluiceMinimal = {
  insurance: 'Self Pay',
  firstName: 'Bri',
  lastName: 'Test',
  phone: '6784896725',
  officeVisit: [
    { code: 'IV Hydration Therapy', quantity: 1, charge: 150, discount: 0, netCharge: 150 },
  ],
};
const sluiceNormalized = normalizeOptimantraSuperbillPayload(sluiceMinimal);
if (!sluiceNormalized) {
  console.log('✗ Sluice minimal superbill returned null');
  failed += 1;
} else {
  failed += check('Sluice phone', sluiceNormalized.contact.phone, '6784896725');
  failed += check('Sluice services count', sluiceNormalized.services.length, 1);
  failed += check('Sluice service name from code', sluiceNormalized.services[0].serviceName, 'IV Hydration Therapy');
  failed += check('Sluice service type from bucket', sluiceNormalized.services[0].serviceType, 'Office Visit');
}

// Sluice Drip Spa — full superbill with labWork + officeVisit buckets
const sluiceFull = {
  firstName: 'Bri',
  lastName: 'Test',
  phone: '6784896725',
  email: 'britest@example.com',
  labWork: [{ code: '* Access Lab Panels', quantity: 1, charge: 55.55, discount: 0, netCharge: 55.55 }],
  officeVisit: [{ code: '* Access Lab Panels', quantity: 1, charge: 0, discount: 0, netCharge: 0 }],
  procedures: [],
  otherServices: [],
  total: 55.55,
  subtotal: 55.55,
};
const sluiceFullNormalized = normalizeOptimantraSuperbillPayload(sluiceFull);
if (!sluiceFullNormalized) {
  console.log('✗ Sluice full superbill returned null');
  failed += 1;
} else {
  failed += check('Sluice full services count', sluiceFullNormalized.services.length, 2);
  failed += check('Sluice full office type (first bucket)', sluiceFullNormalized.services[0].serviceType, 'Office Visit');
  failed += check('Sluice full lab type (second bucket)', sluiceFullNormalized.services[1].serviceType, 'Lab Work');
  const sluicePrimary = pickPrimaryService(sluiceFullNormalized.services, { tenantId: SLUICE_TENANT_ID });
  failed += check('Sluice full primary prefers Office Visit over Lab Work', sluicePrimary?.serviceType, 'Office Visit');
}

// Sluice — add-on must not beat the attached primary service (Vickie Matlaga live shape)
const sluiceAddOnVisit = normalizeOptimantraSuperbillPayload({
  firstName: 'Vickie',
  lastName: 'Matlaga',
  phone: '770-712-6811',
  officeVisit: [
    { code: 'Glutathione Add on', quantity: 1, charge: 40, discount: 6, netCharge: 34 },
    { code: "Myers' Cocktail Drip", quantity: 1, charge: 190, discount: 0, netCharge: 190 },
    { code: 'SDS service charge', quantity: 1, charge: 5, discount: 0, netCharge: 5 },
  ],
});
if (!sluiceAddOnVisit) {
  console.log('✗ Sluice add-on superbill returned null');
  failed += 1;
} else {
  const addOnPrimary = pickPrimaryService(sluiceAddOnVisit.services, { tenantId: SLUICE_TENANT_ID });
  failed += check('Sluice add-on visit primary is drip not add-on', addOnPrimary?.serviceName, "Myers' Cocktail Drip");
  const genericPrimary = pickPrimaryService(sluiceAddOnVisit.services);
  failed += check('Non-Sluice tenant unchanged (first line)', genericPrimary?.serviceName, 'Glutathione Add on');
}

// Legacy services[] shape still supported
const legacy = normalizeOptimantraSuperbillPayload({
  firstName: 'Legacy',
  phone: '4045550000',
  services: [{ serviceName: 'Massage', serviceType: 'Procedure' }],
});
failed += check('legacy services[] shape parses', !!legacy && legacy.services[0].serviceName === 'Massage', true);

console.log(failed === 0 ? '\nAll OptiMantra Superbill adapter tests passed.' : `\n${failed} test(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
