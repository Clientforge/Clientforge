#!/usr/bin/env node
/**
 * Smoke test — ALLDATA CSV adapter (no DB).
 */
const {
  classifyExportFile,
  normalizeCustomerList,
  groupRepairOrders,
} = require('../src/adapters/alldata.adapter');

const customersCsv = `Customer ID,First Name,Last Name,Cell Phone,Email
SMI001,Jane,Doe,4045551234,jane@example.com`;

const ordersCsv = `Repair Order ID,Customer ID,Invoice Date,Job Description
RO1001,SMI001,03/15/2026,Brake Pad Replacement
RO1001,SMI001,03/15/2026,Oil Change`;

function check(label, ok) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  console.log(`ok: ${label}`);
}

check('classify customers', classifyExportFile('Customers_2026.csv') === 'customers');
check('classify repair', classifyExportFile('Repair_Order_Export.csv') === 'repair_orders');

const customers = normalizeCustomerList(Buffer.from(customersCsv));
check('customer id', customers[0]?.alldataCustomerId === 'SMI001');

const orders = groupRepairOrders(Buffer.from(ordersCsv));
check('grouped orders', orders.length === 1);
check('order services', orders[0]?.performedServices?.length === 2);

console.log('ALLDATA adapter smoke tests passed.');
