#!/usr/bin/env node
/**
 * Post-service / post-visit dispatch planning tests (no DB).
 *   node scripts/testPostVisitDispatch.js
 */

const automationService = require('../src/services/appointment-automation.service');
const {
  planAutomationSteps,
  plannedPostVisitJobsMatch,
  POST_VISIT_CATEGORIES,
} = require('../src/services/appointment-workflow.service');

let failed = 0;
const check = (label, ok) => {
  if (!ok) {
    console.error('FAIL:', label);
    failed += 1;
  } else {
    console.log('OK:', label);
  }
};

const tenant = {
  name: 'Southlake Autocare',
  timezone: 'America/New_York',
  booking_link: '',
};
const contact = { first_name: 'Jessica', last_name: 'Bennett', phone: '+16789144702' };
const appointment = {
  scheduled_at: '2026-09-02T13:46:00.000Z',
  service_name: 'AC Evaluation',
  timezone: 'America/New_York',
};

const config = automationService.normalizeConfig({
  post_appointment: {
    enabled: true,
    steps: [{
      id: 'post-service-30m',
      enabled: true,
      channel: 'sms',
      offset_minutes: 30,
      message: 'Hi {firstName}! Thanks for visiting {businessName}. Hope everything went well with your {serviceName}. Book your next visit anytime: {bookingLink}',
    }],
  },
  review_requests: { enabled: false, steps: [] },
});

const vars = automationService.buildTemplateVars({ tenant, contact, appointment });
const referenceTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
appointment.scheduled_at = referenceTime;

const planned = planAutomationSteps(appointment, config, vars, {
  skipImmediate: true,
  referenceTime,
  categories: POST_VISIT_CATEGORIES,
});

check('plans one post-visit SMS', planned.length === 1);
check('uses post_visit job type', planned[0]?.jobType === 'post_visit');
check(
  'renders Jessica and service name',
  planned[0]?.messageBody.includes('Jessica')
    && planned[0]?.messageBody.includes('AC Evaluation'),
);
check(
  'schedules 30 minutes after checkout',
  new Date(planned[0]?.scheduledAt).getTime() === new Date(referenceTime).getTime() + 30 * 60 * 1000,
);

const existingPending = [{
  job_type: 'post_visit',
  channel: 'sms',
  message_body: planned[0].messageBody,
  scheduled_at: planned[0].scheduledAt,
}];

check('detects identical pending jobs', plannedPostVisitJobsMatch(existingPending, planned));
check(
  'detects message change',
  !plannedPostVisitJobsMatch([{
    ...existingPending[0],
    message_body: 'Different message',
  }], planned),
);

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log('\nAll post-visit dispatch checks passed.');
