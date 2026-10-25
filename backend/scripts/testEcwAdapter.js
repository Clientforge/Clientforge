/**
 * Unit tests for eCW FHIR adapter helpers.
 */
const {
  isFinishedEncounter,
  encounterRelevantSince,
  patientIdFromEncounter,
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

check(
  'patient ref parsed',
  patientIdFromEncounter({ subject: { reference: 'Patient/abc-123' } }),
  'abc-123',
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

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll eCW adapter tests passed');
