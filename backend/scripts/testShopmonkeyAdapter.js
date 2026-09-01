#!/usr/bin/env node
/**
 * Shopmonkey adapter smoke tests (no API key required).
 *   node scripts/testShopmonkeyAdapter.js
 */

const {
  normalizeShopmonkeyWebhook,
  orderIsComplete,
  normalizeDeferredServiceItem,
  normalizeDeferredServiceList,
  normalizeOrderServiceList,
  isPerformedOrderService,
  formatOrderServiceName,
  buildOrderServiceContext,
  extractOrderVehicleLabel,
} = require('../src/adapters/shopmonkey.adapter');
const {
  formatServiceList,
  renderTemplate,
  DEFAULT_FOLLOWUP_MESSAGES,
  DEFAULT_FOLLOWUP_SCHEDULE,
  jobTypeForStep,
  isDeferredFollowupJobType,
  isFinalDeferredFollowupJobType,
  messageForStep,
  normalizeFollowupSchedule,
  normalizeServicesForScheduling,
} = require('../src/services/shopmonkey-deferred.service');

let failed = 0;
const check = (label, ok) => {
  if (!ok) {
    console.error('FAIL:', label);
    failed += 1;
  } else {
    console.log('OK:', label);
  }
};

const customerPayload = {
  operation: 'UPDATE',
  table: 'customer',
  data: {
    id: 'cust-1',
    firstName: 'Jane',
    lastName: 'Driver',
    phoneNumbers: [{ number: '+15551234567', primary: true, optIn: true }],
    emails: [{ email: 'jane@example.com', primary: true, subscribed: true }],
  },
};

const orderOpen = {
  operation: 'UPDATE',
  table: 'order',
  data: {
    id: 'ord-1',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    status: 'RepairOrder',
    orderCreatedDate: '2026-01-15T18:00:00.000Z',
  },
};

const orderDone = {
  ...orderOpen,
  data: {
    ...orderOpen.data,
    completedDate: '2026-01-15T20:00:00.000Z',
    invoiced: true,
    status: 'Invoice',
    totalCostCents: 45000,
  },
};

const appt = {
  operation: 'INSERT',
  table: 'appointment',
  data: {
    id: 'appt-1',
    customerId: 'cust-1',
    startDate: '2026-02-01T15:00:00.000Z',
    name: 'Oil change',
  },
};

const c = normalizeShopmonkeyWebhook(customerPayload);
check('customer webhook parses', c?.table === 'customer' && c.contact?.shopmonkeyCustomerId === 'cust-1');

const oOpen = normalizeShopmonkeyWebhook(orderOpen);
check('open order not complete', oOpen?.order && !oOpen.order.isComplete);

const oDone = normalizeShopmonkeyWebhook(orderDone);
check('completed order detected', oDone?.order?.isComplete === true);
check('orderIsComplete helper', orderIsComplete(orderDone.data));
check(
  'vehicle label extracted',
  extractOrderVehicleLabel({ generatedVehicleName: '2014 Mercedes-Benz CLA250 Base' }) === '2014 Mercedes-Benz CLA250 Base',
);

const orderServices = normalizeOrderServiceList({
  data: [
    { id: 'svc-1', name: 'Oil Change', authorizationStatus: 'Authorized' },
    { id: 'svc-2', name: 'Brake Inspection', authorizationStatus: 'Declined' },
    { id: 'svc-3', name: 'Tire Rotation', authorizationStatus: 'Authorized' },
  ],
});
check('performed services exclude declined', orderServices.filter(isPerformedOrderService).length === 2);
check(
  'service name formats primary work',
  formatOrderServiceName(orderServices.filter(isPerformedOrderService), orderDone.data) === 'Oil Change and Tire Rotation',
);

const enriched = buildOrderServiceContext(
  { ...orderDone.data, generatedVehicleName: '2014 Mercedes-Benz CLA250 Base' },
  orderServices,
);
check('enriched context separates vehicle', enriched.vehicleLabel === '2014 Mercedes-Benz CLA250 Base');
check('enriched service name is work performed', enriched.serviceName === 'Oil Change and Tire Rotation');

const a = normalizeShopmonkeyWebhook(appt);
check('appointment webhook parses', a?.table === 'appointment' && a.appointment?.externalId === 'shopmonkey:appointment:appt-1');

const deferredItem = {
  id: 'def-1',
  name: 'Front brake pads',
  orderId: 'ord-1',
  deferredDate: '2026-01-15T20:00:00.000Z',
  totalCents: 28500,
  order: { customerId: 'cust-1', generatedVehicleName: '2019 Honda Accord' },
};

const normalizedDeferred = normalizeDeferredServiceItem(deferredItem);
check(
  'deferred service normalizes',
  normalizedDeferred?.shopmonkeyDeferredId === 'def-1'
    && normalizedDeferred.serviceName === 'Front brake pads',
);

const deferredList = normalizeDeferredServiceList({ data: [deferredItem, { id: 'x', excludedFromDeferred: true }] }, { orderId: 'ord-1' });
check('deferred list filters by order', deferredList.length === 1);

const nestedOrderDeferred = normalizeDeferredServiceItem({
  id: 'def-2',
  name: 'Transmission Service',
  order: { id: 'ord-1', customerId: 'cust-1' },
});
check(
  'deferred service uses nested order id',
  nestedOrderDeferred?.shopmonkeyOrderId === 'ord-1',
);

const nestedOrderList = normalizeDeferredServiceList(
  {
    data: [{
      id: 'def-2',
      name: 'Transmission Service',
      order: { id: 'ord-1', customerId: 'cust-1' },
    }],
  },
  { orderId: 'ord-1' },
);
check('deferred list matches nested order id', nestedOrderList.length === 1);

check('service list formats two items', formatServiceList([
  { serviceName: 'Brake pads' },
  { serviceName: 'Rotors' },
]) === 'Brake pads and Rotors');

const deduped = normalizeServicesForScheduling([
  { serviceName: 'Tune Up', shopmonkeyOrderId: 'ord-1' },
  { serviceName: 'tune up', shopmonkeyOrderId: 'ord-1' },
  { serviceName: 'Engine Diagnostic', shopmonkeyOrderId: 'ord-1' },
]);
check('scheduling list dedupes service names', deduped.length === 2);

const rendered = renderTemplate(DEFAULT_FOLLOWUP_MESSAGES[0], {
  firstName: 'Jane',
  businessName: 'Southlake Autocare',
  serviceList: 'Brake pads',
  bookingLink: 'https://book.example.com',
});
check('deferred message renders', rendered.includes('Jane') && rendered.includes('Brake pads'));

check('follow-up schedule defaults', normalizeFollowupSchedule(null).join(',') === '7,14,30,60');
check('step 1 job type', jobTypeForStep(0) === 'deferred_service_followup_1');
check('deferred job type detected', isDeferredFollowupJobType('deferred_service_followup_3'));
check('final step detected', isFinalDeferredFollowupJobType('deferred_service_followup_4', 4));
check('step 4 message differs', messageForStep(3, {
  firstName: 'Jane',
  businessName: 'Southlake Autocare',
  serviceList: 'Brake pads',
  bookingLink: 'https://book.example.com',
}).includes('last reminder'));

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Shopmonkey adapter checks passed.');
