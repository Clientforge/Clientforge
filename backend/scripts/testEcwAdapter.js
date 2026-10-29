/**
 * Unit tests for eCW FHIR adapter helpers.
 */
const {
  isFinishedEncounter,
  isUpcomingEncounter,
  isCancelledEncounter,
  encounterRelevantSince,
  patientIdFromEncounter,
  practitionerIdFromEncounter,
  pickPractitionerName,
} = require('../src/adapters/ecw.adapter');

let failed = 0;

function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} — expected ${expected}, got ${actual}`);
    failed += 1;
    return;
  }
  console.log(`OK: ${label}`);
}

check('finished status', isFinishedEncounter({ status: 'finished' }), true);
check('completed status', isFinishedEncounter({ status: 'completed' }), true);
check('in-progress skipped', isFinishedEncounter({ status: 'in-progress' }), false);

const futureStart = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const pastStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
check('upcoming planned', isUpcomingEncounter({ status: 'planned', period: { start: futureStart } }), true);
check('past planned is not upcoming', isUpcomingEncounter({ status: 'planned', period: { start: pastStart } }), false);
check('cancelled is not upcoming', isUpcomingEncounter({ status: 'cancelled', period: { start: futureStart } }), false);
check('cancelled status', isCancelledEncounter({ status: 'cancelled' }), true);

check(
  'patient ref parsed',
  patientIdFromEncounter({ subject: { reference: 'Patient/abc-123' } }),
  'abc-123',
);
check(
  'practitioner ref from participant',
  practitionerIdFromEncounter({
    participant: [{
      type: [{ coding: [{ code: 'PPRF' }] }],
      individual: { reference: 'Practitioner/pract-99' },
    }],
  }),
  'pract-99',
);
check(
  'practitioner display name',
  pickPractitionerName({ name: [{ given: ['Jane'], family: 'Doe' }] }),
  'Jane Doe',
);

const since = new Date('2026-10-22T12:00:00.000Z');
check(
  'since uses period.end',
  encounterRelevantSince(
    { period: { end: '2026-10-22T13:00:00.000Z' }, meta: { lastUpdated: '2020-01-01T00:00:00Z' } },
    since,
  ),
  true,
);
check(
  'since rejects old period.end',
  encounterRelevantSince({ period: { end: '2026-10-21T00:00:00.000Z' } }, since),
  false,
);
check(
  'since uses meta.lastUpdated when no period.end',
  encounterRelevantSince({ meta: { lastUpdated: '2026-10-22T14:00:00.000Z' } }, since),
  true,
);
check(
  'since rejects encounter with no timestamps',
  encounterRelevantSince({ id: 'x', status: 'finished' }, since),
  false,
);
check('since accepts all when since invalid', encounterRelevantSince({ id: 'x' }, null), true);

const params = new URLSearchParams({ patient: 'Patient/test-id' });
check('encounter query is patient-only', params.toString(), 'patient=Patient%2Ftest-id');

const bulkParams = new URLSearchParams({ _type: 'Patient,Encounter' });
check('bulk export type param', bulkParams.get('_type'), 'Patient,Encounter');

const {
  isBulkExportInProgressOutcome,
  extractStatusUrlFromHeaders,
  bulkExportStatusHasErrors,
} = require('../src/services/ecw-bulk-export.service');

check(
  'bulk in-progress OperationOutcome',
  isBulkExportInProgressOutcome({
    resourceType: 'OperationOutcome',
    issue: [{ code: 'duplicate', diagnostics: 'Bulk operation is already in progress for the group' }],
  }),
  true,
);
check(
  'bulk unrelated OperationOutcome',
  isBulkExportInProgressOutcome({
    resourceType: 'OperationOutcome',
    issue: [{ code: 'not-found', diagnostics: 'Group missing' }],
  }),
  false,
);

const mockRes = {
  headers: {
    get(name) {
      if (name === 'content-location' || name === 'Content-Location') {
        return 'https://staging-fhir.ecwcloud.com/fhir/r4/FFBJCD/$export-poll-status?_job=abc';
      }
      return null;
    },
  },
};
check(
  'bulk status URL from Content-Location',
  extractStatusUrlFromHeaders(mockRes),
  'https://staging-fhir.ecwcloud.com/fhir/r4/FFBJCD/$export-poll-status?_job=abc',
);

check(
  'bulk manifest error:[] is not failure',
  bulkExportStatusHasErrors({ output: [{ type: 'Patient', url: 'https://x' }], error: [] }),
  false,
);
check(
  'bulk manifest with error entry is failure',
  bulkExportStatusHasErrors({ error: [{ message: 'export failed' }] }),
  true,
);
check('bulk manifest missing error is not failure', bulkExportStatusHasErrors({ output: [] }), false);

const {
  mergeEcwServiceTag,
  mergeEcwEncounterTags,
  ecwServiceTag,
  ecwPractitionerTag,
  formatEcwServiceTagForDisplay,
  formatEcwPractitionerTagForDisplay,
} = require('../src/utils/ecwServiceTags');

check('ecw service tag prefix', ecwServiceTag('Consult'), 'service:Consult');
check(
  'merge replaces prior service tag',
  JSON.stringify(mergeEcwServiceTag(['vip', 'service:Consult'], 'Follow Up Visit')),
  JSON.stringify(['vip', 'service:Follow Up Visit']),
);
check(
  'merge keeps manual tags',
  JSON.stringify(mergeEcwServiceTag(['promo'], 'Annual Visit')),
  JSON.stringify(['promo', 'service:Annual Visit']),
);
check(
  'display strips service prefix',
  formatEcwServiceTagForDisplay('service:Follow Up Visit'),
  'Follow Up Visit',
);
check('ecw practitioner tag prefix', ecwPractitionerTag('Jane Doe'), 'provider:Jane Doe');
check(
  'merge encounter tags service + provider',
  JSON.stringify(mergeEcwEncounterTags(['vip'], {
    serviceLabel: 'Consult',
    practitionerName: 'Jane Doe',
  })),
  JSON.stringify(['vip', 'service:Consult', 'provider:Jane Doe']),
);
check(
  'merge service only keeps prior provider tag',
  JSON.stringify(mergeEcwEncounterTags(['service:Old', 'provider:Dr A'], { serviceLabel: 'Consult' })),
  JSON.stringify(['service:Consult', 'provider:Dr A']),
);
check(
  'display strips provider prefix',
  formatEcwPractitionerTagForDisplay('provider:Jane Doe'),
  'Jane Doe',
);

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll eCW adapter tests passed');
