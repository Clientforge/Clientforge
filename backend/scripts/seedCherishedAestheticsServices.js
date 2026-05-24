#!/usr/bin/env node
/**
 * Seed Cherished Aesthetics service catalog + rebooking defaults.
 * Run from backend/: node scripts/seedCherishedAestheticsServices.js
 *
 * Optional env: CHERISHED_USER_EMAIL=cherished_aesthetics@outlook.com
 */
require('dotenv').config();

const db = require('../src/db/connection');
const { replaceServices, findTenantIdByUserEmail } = require('../src/services/tenant-service.service');
const automationService = require('../src/services/appointment-automation.service');

const USER_EMAIL = process.env.CHERISHED_USER_EMAIL || 'cherished_aesthetics@outlook.com';

const DEFAULT_REBOOK_MESSAGE =
  'Hi {firstName}! It\'s time for your {serviceName} at {businessName}. Book your next visit: {bookingLink}';

const CHERISHED_SERVICES = [
  {
    name: 'Tox Treatments',
    aliases: ['Botox', 'Neurotoxin', 'Dysport', 'Xeomin', 'Tox', 'Daxxify Tox'],
    returnIntervalDays: 105,
    notes: 'Every 3–4 months',
  },
  {
    name: 'Fillers',
    aliases: ['Dermal Fillers', 'Lip Fillers', 'Juvederm', 'Restylane'],
    returnIntervalDays: 270,
    notes: 'Every 6–18 months; default ~9 months',
  },
  {
    name: 'Facial Balancing',
    aliases: ['Filler Balancing'],
    returnIntervalDays: 270,
    notes: 'Every 6–12 months',
  },
  {
    name: 'PRF Gel Injections',
    aliases: ['PRF Gel'],
    returnIntervalDays: 135,
    notes: 'Every 3–6 months after initial series',
  },
  {
    name: 'PRP/PRF Injections',
    aliases: ['PRP', 'PRF Injections', 'PRP Injections'],
    returnIntervalDays: 180,
    notes: 'Maintenance every 6 months after initial series',
  },
  {
    name: 'Microneedling With HA',
    aliases: ['Microneedling HA', 'MN with HA'],
    returnIntervalDays: 135,
    notes: 'Maintenance every 3–6 months after series',
  },
  {
    name: 'Microneedling With PRP/PRF',
    aliases: ['Microneedling PRP', 'Microneedling PRF'],
    returnIntervalDays: 135,
    notes: 'Maintenance every 3–6 months after series',
  },
  {
    name: 'Microneedling With Exosomes',
    aliases: ['Microneedling Exosomes'],
    returnIntervalDays: 180,
    notes: 'Maintenance every 6 months after series',
  },
  {
    name: 'Microneedling With Daxxify',
    aliases: ['Microneedling Daxxify'],
    returnIntervalDays: 135,
    notes: 'Maintenance every 4–6 months after series',
  },
  {
    name: 'Chemical Peel (VI Peel)',
    aliases: ['VI Peel', 'Chemical Peel'],
    returnIntervalDays: 105,
    notes: 'Every 3–4 months after initial series',
  },
  {
    name: 'Hyperpigmentation Package',
    aliases: ['Hyperpigmentation'],
    returnIntervalDays: 105,
    notes: 'Every 3–4 months after completing package',
  },
  {
    name: 'Microdermabrasion',
    returnIntervalDays: 28,
    notes: 'Every 4 weeks',
  },
  {
    name: 'Signature Facial',
    aliases: ['Facial'],
    returnIntervalDays: 28,
    notes: 'Monthly',
  },
  {
    name: 'Anti-Aging Collagen Boosting Facial',
    aliases: ['Collagen Facial', 'Collagen Boosting Facial'],
    returnIntervalDays: 28,
    notes: 'Monthly',
  },
  {
    name: 'Dermaplaning Facial',
    aliases: ['Dermaplaning'],
    returnIntervalDays: 35,
    notes: 'Every 4–6 weeks',
  },
  {
    name: 'Hydrating Moisture Boost Facial',
    aliases: ['Hydrating Facial', 'Moisture Boost Facial'],
    returnIntervalDays: 28,
    notes: 'Monthly',
  },
  {
    name: 'Facial Add-Ons',
    aliases: ['Add-On', 'Add Ons'],
    rebookingEnabled: false,
    returnIntervalDays: null,
    notes: 'Same cadence as facial booked with — no standalone rebook',
  },
  {
    name: 'LED Light Therapy',
    aliases: ['LED Therapy', 'LED'],
    returnIntervalDays: 10,
    notes: 'Every 1–2 weeks',
  },
  {
    name: 'High Frequency',
    aliases: ['High Frequency Add-On'],
    returnIntervalDays: 21,
    notes: 'Every 2–4 weeks',
  },
  {
    name: 'IV Hydration Special',
    aliases: ['IV Hydration'],
    returnIntervalDays: 21,
    notes: 'Every 2–4 weeks',
  },
  {
    name: 'IV Therapy',
    returnIntervalDays: 21,
    notes: 'Monthly minimum; bi-weekly for best results',
  },
  {
    name: 'IV Drip – Snow Bright',
    aliases: ['Snow Bright', 'Snow Bright IV'],
    returnIntervalDays: 21,
    notes: 'Every 2–4 weeks',
  },
  {
    name: 'IV Drip – Executive',
    aliases: ['Executive IV', 'Executive Drip'],
    returnIntervalDays: 21,
    notes: 'Every 2–4 weeks',
  },
  {
    name: 'IV Drip – Recovery',
    aliases: ['Recovery IV', 'Recovery Drip'],
    rebookingEnabled: false,
    returnIntervalDays: null,
    notes: 'As needed — no automatic rebook',
  },
  {
    name: 'NAD+',
    aliases: ['NAD', 'NAD IV', 'NAD+ IV'],
    returnIntervalDays: 28,
    notes: 'Monthly',
  },
  {
    name: 'B12, D3, Glutathione Shots',
    aliases: ['B12 Shot', 'B12', 'Glutathione Shot', 'D3 Shot', 'Vitamin Shots'],
    returnIntervalDays: 21,
    notes: 'Every 1–4 weeks depending on shot',
  },
  {
    name: 'Medical Weightloss Semaglutide',
    aliases: ['Semaglutide', 'Ozempic', 'Wegovy'],
    returnIntervalDays: 7,
    notes: 'Weekly injection; monthly check-in separate',
  },
  {
    name: 'Medical Weightloss Tirzepatide',
    aliases: ['Tirzepatide', 'Mounjaro', 'Zepbound'],
    returnIntervalDays: 7,
    notes: 'Weekly injection; monthly check-in separate',
  },
  {
    name: 'Weightloss Labs',
    aliases: ['Weight Loss Labs'],
    returnIntervalDays: 135,
    notes: 'Every 3–6 months',
  },
  {
    name: 'Annual Medical Clearance',
    aliases: ['Medical Clearance', 'Annual Clearance'],
    returnIntervalDays: 365,
    notes: 'Required annually',
  },
];

async function ensureRebookingAutomation(tenantId) {
  const current = await automationService.getAutomations(tenantId);
  const rebooking = {
    enabled: true,
    followupIntervalDays: 14,
    steps: [
      {
        id: 'rebook-initial',
        enabled: true,
        channel: 'sms',
        offset_minutes: 43200,
        message: DEFAULT_REBOOK_MESSAGE,
        email_subject: 'Time for your {serviceName} — {businessName}',
      },
      {
        id: 'rebook-followup-1',
        enabled: true,
        channel: 'sms',
        offset_minutes: 0,
        message: 'Hi {firstName}! Just checking in — ready to schedule your next {serviceName} at {businessName}? {bookingLink}',
        email_subject: 'Reminder: Book your {serviceName} — {businessName}',
      },
      {
        id: 'rebook-followup-2',
        enabled: true,
        channel: 'sms',
        offset_minutes: 0,
        message: 'Hi {firstName}, we\'d still love to see you for your {serviceName}. Book at {businessName}: {bookingLink}',
        email_subject: 'Last reminder: {serviceName} at {businessName}',
      },
    ],
  };

  await automationService.updateAutomations(tenantId, {
    ...current,
    rebooking,
  });
}

async function ensureBookingAlias(tenantId) {
  const existing = await db.query(
    `SELECT id FROM tenant_booking_email_aliases
     WHERE tenant_id = $1 AND LOWER(alias) = LOWER($2)`,
    [tenantId, 'Cherished Aesthetics'],
  );
  if (existing.rows.length === 0) {
    await db.query(
      `INSERT INTO tenant_booking_email_aliases (tenant_id, alias, match_type, priority, active)
       VALUES ($1, $2, 'contains', 10, true)`,
      [tenantId, 'Cherished Aesthetics'],
    );
  }
}

async function main() {
  const tenant = await findTenantIdByUserEmail(USER_EMAIL);
  if (!tenant) {
    console.error(`[seed] No tenant found for user email: ${USER_EMAIL}`);
    process.exit(1);
  }

  console.log(`[seed] Tenant: ${tenant.name} (${tenant.id})`);

  const services = CHERISHED_SERVICES.map((s, i) => ({
    name: s.name,
    aliases: s.aliases || [],
    returnIntervalDays: s.returnIntervalDays,
    rebookingEnabled: s.rebookingEnabled !== false,
    rebookMessage: s.rebookMessage || '',
    notes: s.notes || '',
    sortOrder: i,
  }));

  const result = await replaceServices(tenant.id, services);
  await ensureRebookingAutomation(tenant.id);
  await ensureBookingAlias(tenant.id);

  console.log(`[seed] Loaded ${result.services.length} services for ${tenant.name}`);
  console.log('[seed] Enabled 3-step rebooking campaign (initial + 2 follow-ups every 14 days)');
  console.log('[seed] Ensured booking email alias "Cherished Aesthetics"');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err.message);
  process.exit(1);
});
