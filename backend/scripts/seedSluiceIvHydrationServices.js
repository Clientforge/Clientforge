#!/usr/bin/env node
/**
 * Seed / update Sluice Drip Spa IV Hydration service grouping.
 *
 * - IV Hydration: aliases for 18 confirmed drip names + IV Hydration Therapy
 * - Follow-ups at 4, 10, and 20 days post-checkout
 * - Premium Drip Package: auto-rebook off (excluded from sequence)
 * - Disables standalone drip service rows so checkout matches IV Hydration
 *
 * Usage (from backend/):
 *   node scripts/seedSluiceIvHydrationServices.js
 *
 * Env:
 *   SLUICE_TENANT_ID — defaults to known Sluice Drip Spa tenant
 *   DATABASE_URL — required
 */
require('dotenv').config();

const db = require('../src/db/connection');
const { listServices, replaceServices } = require('../src/services/tenant-service.service');
const {
  SLUICE_IV_DRIP_SERVICE_NAMES,
  mergeSluiceIvHydrationServices,
  buildIvHydrationService,
} = require('./sluiceIvHydrationConfig');

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';

async function main() {
  const tenantCheck = await db.query(
    'SELECT id, name FROM tenants WHERE id = $1',
    [SLUICE_TENANT_ID],
  );
  if (tenantCheck.rows.length === 0) {
    console.error('Tenant not found:', SLUICE_TENANT_ID);
    process.exit(1);
  }

  const tenant = tenantCheck.rows[0];
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);

  try {
    const flagResult = await db.query(
      'SELECT service_followup_campaigns_enabled FROM tenants WHERE id = $1',
      [SLUICE_TENANT_ID],
    );
    if (!flagResult.rows[0]?.service_followup_campaigns_enabled) {
      await db.query(
        'UPDATE tenants SET service_followup_campaigns_enabled = true, updated_at = NOW() WHERE id = $1',
        [SLUICE_TENANT_ID],
      );
      console.log('Enabled service_followup_campaigns_enabled for tenant.');
    }
  } catch (err) {
    if (err.code === '42703') {
      console.error('Database missing service follow-up columns — run migrations first (047_service_followup_campaigns).');
      process.exit(1);
    }
    throw err;
  }

  const { services: existing } = await listServices(SLUICE_TENANT_ID);
  console.log(`Existing services: ${existing.length}`);

  const merged = mergeSluiceIvHydrationServices(existing);
  const iv = buildIvHydrationService();

  const { services } = await replaceServices(SLUICE_TENANT_ID, merged);

  const ivSaved = services.find((s) => s.name === iv.name);
  console.log('\nIV Hydration configured:');
  console.log(`  Aliases: ${ivSaved?.aliases?.length ?? 0} (${SLUICE_IV_DRIP_SERVICE_NAMES.length} drips + checkout codes)`);
  console.log(`  Follow-ups: ${(ivSaved?.followUpCampaigns || []).map((s) => `${s.intervalDays}d`).join(', ')}`);
  console.log(`  Total services after merge: ${services.length}`);
  console.log('\nDone. Save confirmed in Automations → Services in the app.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.pool.end());
