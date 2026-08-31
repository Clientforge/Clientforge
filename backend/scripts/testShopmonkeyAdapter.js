#!/usr/bin/env node
/**
 * Shopmonkey adapter smoke tests (no API key required).
 *   node scripts/testShopmonkeyAdapter.js
 */

const {
  normalizeShopmonkeyWebhook,
  orderIsComplete,
} = require('../src/adapters/shopmonkey.adapter');

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

const a = normalizeShopmonkeyWebhook(appt);
check('appointment webhook parses', a?.table === 'appointment' && a.appointment?.externalId === 'shopmonkey:appointment:appt-1');

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log('\nAll Shopmonkey adapter checks passed.');
