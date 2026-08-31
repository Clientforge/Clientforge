#!/usr/bin/env node
/**
 * Auto shop maintenance reminder smoke tests (no DB required).
 *   node scripts/testAutoShopMaintenance.js
 */

const {
  groupClassificationsByCategory,
  formatServiceList,
  renderTemplate,
  jobTypeForCategorySlug,
  isMaintenanceReminderJobType,
  DEFAULT_REMINDER_MESSAGE,
} = require('../src/services/auto-shop-maintenance.service');

let failed = 0;

function assert(label, condition) {
  if (!condition) {
    console.log(`✗ ${label}`);
    failed += 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

const grouped = groupClassificationsByCategory([
  { slug: 'routine_maintenance', name: 'Routine Maintenance', serviceName: 'Oil Change', followUpIntervalDays: 60 },
  { slug: 'routine_maintenance', name: 'Routine Maintenance', serviceName: 'Tire Rotation', followUpIntervalDays: 60 },
  { slug: 'brakes', name: 'Brakes', serviceName: 'Brake Pads', followUpIntervalDays: 90 },
]);

assert('groups duplicate categories', grouped.length === 2);
assert('combines service names', grouped[0].serviceNames.length === 2);
assert('formatServiceList', formatServiceList(['Oil Change', 'Tire Rotation']) === 'Oil Change and Tire Rotation');
assert('job type slug', jobTypeForCategorySlug('routine_maintenance') === 'maintenance_reminder_routine_maintenance');
assert('detects maintenance job type', isMaintenanceReminderJobType('maintenance_reminder_brakes'));
assert('render template', renderTemplate(DEFAULT_REMINDER_MESSAGE, {
  firstName: 'Sam',
  businessName: 'Southlake Autocare',
  categoryName: 'Brakes',
  serviceList: 'Brake Pads',
  bookingLink: 'https://book.example',
}).includes('Southlake Autocare'));

process.exit(failed > 0 ? 1 : 0);
