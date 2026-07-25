#!/usr/bin/env node
/**
 * One-time repair for Sluice OptiMantra rows corrupted by calendar ping-pong.
 * Fixes times/GCal links, cancels phantom duplicates, redeploys automations.
 *
 * Usage (from backend/ on Render):
 *   node scripts/repairSluicePingPongAppointments.js --dry-run
 *   node scripts/repairSluicePingPongAppointments.js
 *   node scripts/repairSluicePingPongAppointments.js --only tera
 *   node scripts/repairSluicePingPongAppointments.js --aug6-external-id 23416508
 *
 * Env: SLUICE_TENANT_ID (optional)
 */
require('dotenv').config();

const db = require('../src/db/connection');
const appointmentService = require('../src/services/appointment.service');
const appointmentWorkflowService = require('../src/services/appointment-workflow.service');

const SLUICE_TENANT_ID = process.env.SLUICE_TENANT_ID || '5f793c52-f8e0-457b-97b5-86af987c2a8d';
const TZ = 'America/New_York';

/** EDT Aug 2026 = UTC-4 → local 9:15 AM = 13:15 UTC, 11:00 AM = 15:00 UTC */
const TERA_CANONICAL = [
  {
    key: 'jul30',
    externalId: 'optimantra:23416419',
    appointmentId: '1593344f-e16e-40cf-b04c-6ce6efcd3ee3',
    scheduledAt: '2026-07-30T13:15:00.000Z',
    googleCalendarEventId: null,
    serviceName: 'Medical Weight Loss Program(Tirz)',
  },
  {
    key: 'aug6',
    externalId: null, // filled from --aug6-external-id or discovery
    scheduledAt: '2026-08-06T13:15:00.000Z',
    googleCalendarEventId: null,
    serviceName: 'Immune Defense Drip',
  },
  {
    key: 'aug14',
    externalId: 'optimantra:23416676',
    appointmentId: 'c7a1f53e-3180-474a-936d-b201079dac73',
    scheduledAt: '2026-08-14T15:00:00.000Z',
    googleCalendarEventId: '23416676',
    serviceName: 'Medical Weight Loss Program(Tirz)',
  },
  {
    key: 'aug20',
    externalId: 'optimantra:23416696',
    appointmentId: 'c72d0a4a-0930-43ff-837c-9401c94b485d',
    scheduledAt: '2026-08-20T13:15:00.000Z',
    googleCalendarEventId: '23416696',
    serviceName: 'Medical Weight Loss Program(Tirz)',
  },
  {
    key: 'aug27',
    externalId: 'optimantra:23416711',
    appointmentId: '3e2c67be-62f7-4e7b-945e-9f9776c6f5e1',
    scheduledAt: '2026-08-27T13:15:00.000Z',
    googleCalendarEventId: '23416711',
    serviceName: 'Medical Weight Loss Program(Tirz)',
  },
];

const TERA_CANCEL = [
  { appointmentId: '79d08907-d61e-483e-b4a8-6e71604b72db', externalId: 'optimantra:23416459', reason: 'Aug 14 phantom (ping-pong)' },
  { appointmentId: '885929b1-2081-41b0-8fde-8b73a5fc71b8', externalId: 'optimantra:23416640', reason: 'Aug 14 duplicate' },
  { appointmentId: '33abe21e-4720-4968-9af4-38440b065e6c', externalId: 'optimantra:23416540', reason: 'Aug 27 phantom (ping-pong)' },
];

const ALISHA_KEEP_GCAL = '23575176';

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.toLowerCase() : null;
  const aug6Idx = args.indexOf('--aug6-external-id');
  let aug6ExternalId = aug6Idx >= 0 ? args[aug6Idx + 1] : process.env.TERA_AUG6_EXTERNAL_ID || null;
  if (aug6ExternalId && !aug6ExternalId.startsWith('optimantra:')) {
    aug6ExternalId = `optimantra:${aug6ExternalId}`;
  }
  return { dryRun, only, aug6ExternalId };
}

async function getContactId(tenantId, firstName, lastName = null) {
  const params = [tenantId, firstName];
  let sql = `SELECT id FROM contacts WHERE tenant_id = $1 AND first_name ILIKE $2`;
  if (lastName) {
    params.push(lastName);
    sql += ` AND last_name ILIKE $3`;
  }
  sql += ' ORDER BY created_at ASC LIMIT 1';
  const r = await db.query(sql, params);
  return r.rows[0]?.id || null;
}

async function fixAppointment(tenantId, {
  appointmentId,
  externalId,
  contactId,
  scheduledAt,
  googleCalendarEventId,
  serviceName,
  dryRun,
  label,
}) {
  if (dryRun) {
    console.log(`  [dry-run] FIX ${label}: ${scheduledAt}${googleCalendarEventId ? ` gcal=${googleCalendarEventId}` : ''}`);
    return appointmentId;
  }

  if (appointmentId) {
    await db.query(
      `UPDATE appointments SET
         contact_id = COALESCE($2, contact_id),
         status = 'scheduled',
         scheduled_at = $3,
         timezone = $4,
         service_name = COALESCE($5, service_name),
         google_calendar_event_id = $6,
         updated_at = NOW()
       WHERE id = $1 AND tenant_id = $7`,
      [
        appointmentId,
        contactId,
        scheduledAt,
        TZ,
        serviceName,
        googleCalendarEventId,
        tenantId,
      ],
    );
    await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
    console.log(`  ✓ FIX ${label} (${appointmentId.slice(0, 8)}…)`);
    return appointmentId;
  }

  if (!externalId || !contactId) {
    throw new Error(`Cannot create ${label}: missing externalId or contactId`);
  }

  const { id } = await appointmentService.upsertAppointment(
    tenantId,
    contactId,
    {
      externalId,
      provider: 'optimantra',
      scheduledAt,
      timezone: TZ,
      serviceName,
      durationMinutes: 45,
      rawPayload: { repair: 'repairSluicePingPongAppointments' },
    },
    'scheduled',
  );

  if (googleCalendarEventId) {
    await db.query(
      `UPDATE appointments SET google_calendar_event_id = $2, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $3`,
      [id, googleCalendarEventId, tenantId],
    );
  }

  console.log(`  ✓ CREATE ${label} (${id.slice(0, 8)}…)`);
  return id;
}

async function cancelAppointment(tenantId, { appointmentId, reason, dryRun, label }) {
  if (dryRun) {
    console.log(`  [dry-run] CANCEL ${label}: ${reason}`);
    return;
  }

  await appointmentService.cancelWorkflowJobsForAppointment(appointmentId);
  await db.query(
    `UPDATE appointments SET status = 'cancelled', google_calendar_event_id = NULL, updated_at = NOW()
     WHERE id = $1 AND tenant_id = $2`,
    [appointmentId, tenantId],
  );
  console.log(`  ✓ CANCEL ${label} (${appointmentId.slice(0, 8)}…): ${reason}`);
}

async function discoverAug6ExternalId(tenantId, contactId) {
  const r = await db.query(
    `SELECT external_id, id, scheduled_at, status, service_name
     FROM appointments
     WHERE tenant_id = $1 AND contact_id = $2 AND provider = 'optimantra'
       AND (
         scheduled_at BETWEEN '2026-08-05' AND '2026-08-07'
         OR service_name ILIKE '%immune%defense%'
         OR external_id = 'optimantra:23416540'
       )
     ORDER BY
       CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END,
       scheduled_at`,
    [tenantId, contactId],
  );
  const hit = r.rows.find((row) => (
    row.service_name?.toLowerCase().includes('immune')
    || (row.scheduled_at >= new Date('2026-08-05') && row.scheduled_at <= new Date('2026-08-07'))
  ));
  return hit?.external_id || null;
}

async function repairTera(tenantId, { dryRun, aug6ExternalId }) {
  console.log('\n── Tera Bains ──');
  const contactId = await getContactId(tenantId, 'Tera', 'Bains');
  if (!contactId) {
    console.error('  ✗ Contact Tera Bains not found');
    return { fixed: [], cancelled: [], errors: ['tera contact missing'] };
  }

  const fixedIds = [];
  const errors = [];

  for (const row of TERA_CANCEL) {
    try {
      await cancelAppointment(tenantId, {
        appointmentId: row.appointmentId,
        reason: row.reason,
        dryRun,
        label: row.externalId,
      });
    } catch (err) {
      errors.push(`${row.externalId}: ${err.message}`);
    }
  }

  const canonical = TERA_CANONICAL.map((row) => ({ ...row }));
  const aug6 = canonical.find((r) => r.key === 'aug6');
  aug6.externalId = aug6ExternalId || await discoverAug6ExternalId(tenantId, contactId);

  for (const row of canonical) {
    try {
      if (row.key === 'aug6' && !row.externalId && !row.appointmentId) {
        console.warn('  ⚠ Aug 6 missing — pass --aug6-external-id <OptiMantra appointment ID>');
        errors.push('aug6: no external_id (needs OptiMantra ID or webhook)');
        continue;
      }

      const id = await fixAppointment(tenantId, {
        appointmentId: row.appointmentId,
        externalId: row.externalId,
        contactId,
        scheduledAt: row.scheduledAt,
        googleCalendarEventId: row.googleCalendarEventId,
        serviceName: row.serviceName,
        dryRun,
        label: `${row.key} ${row.externalId || 'new'}`,
      });
      if (id) fixedIds.push(id);
    } catch (err) {
      errors.push(`${row.key}: ${err.message}`);
      console.error(`  ✗ ${row.key}: ${err.message}`);
    }
  }

  if (!dryRun && fixedIds.length > 0) {
    for (const appointmentId of fixedIds) {
      try {
        const outcome = await appointmentWorkflowService.redeployBookingWorkflowsForAppointment(
          tenantId,
          appointmentId,
        );
        if (outcome.jobsScheduled > 0) {
          console.log(`  ↻ Redeployed ${outcome.jobsScheduled} job(s) for ${appointmentId.slice(0, 8)}…`);
        }
      } catch (err) {
        console.warn(`  ⚠ Redeploy failed for ${appointmentId.slice(0, 8)}…: ${err.message}`);
      }
    }
  }

  return { fixed: fixedIds, errors };
}

async function repairAlisha(tenantId, { dryRun }) {
  console.log('\n── Alisha Holloway ──');
  const contactId = await getContactId(tenantId, 'Alisha', 'Holloway');
  if (!contactId) {
    console.error('  ✗ Contact Alisha Holloway not found');
    return { errors: ['alisha contact missing'] };
  }

  const r = await db.query(
    `SELECT id, external_id, scheduled_at, google_calendar_event_id, status
     FROM appointments
     WHERE tenant_id = $1 AND contact_id = $2 AND provider = 'optimantra'
       AND status IN ('scheduled', 'rescheduled', 'confirmed')
       AND scheduled_at >= '2026-07-24'
     ORDER BY scheduled_at`,
    [tenantId, contactId],
  );

  const errors = [];
  const keep = r.rows.find((row) => row.google_calendar_event_id === ALISHA_KEEP_GCAL);
  const dupes = r.rows.filter((row) => {
    if (keep && row.id === keep.id) return false;
    const t = new Date(row.scheduled_at).getTime();
    const keepT = keep ? new Date(keep.scheduled_at).getTime() : null;
    if (keepT != null && Math.abs(t - keepT) < 2 * 60 * 60 * 1000) return true;
    return false;
  });

  if (keep) {
    const target = '2026-07-30T16:00:00.000Z'; // Jul 30 12:00 PM EDT
    if (keep.scheduled_at?.toISOString?.() !== target && new Date(keep.scheduled_at).toISOString() !== target) {
      try {
        await fixAppointment(tenantId, {
          appointmentId: keep.id,
          externalId: keep.external_id,
          contactId,
          scheduledAt: target,
          googleCalendarEventId: ALISHA_KEEP_GCAL,
          serviceName: 'Fat Burner Injection',
          dryRun,
          label: `keep ${keep.external_id}`,
        });
      } catch (err) {
        errors.push(`alisha keep: ${err.message}`);
      }
    } else if (keep.status !== 'scheduled') {
      if (!dryRun) {
        await db.query(
          `UPDATE appointments SET status = 'scheduled', updated_at = NOW() WHERE id = $1`,
          [keep.id],
        );
      }
      console.log(`  ✓ Alisha linked row already at Jul 30 12:00 PM`);
    } else {
      console.log(`  – Alisha linked row OK (${keep.external_id})`);
    }
  } else {
    console.warn(`  ⚠ Alisha: no row with gcal ${ALISHA_KEEP_GCAL}`);
    errors.push('alisha: missing gcal-linked row');
  }

  for (const row of dupes) {
    try {
      await cancelAppointment(tenantId, {
        appointmentId: row.id,
        reason: 'Jul 30 duplicate (ping-pong)',
        dryRun,
        label: row.external_id,
      });
    } catch (err) {
      errors.push(`alisha cancel ${row.external_id}: ${err.message}`);
    }
  }

  return { errors };
}

async function verifyTera(tenantId) {
  const r = await db.query(
    `SELECT a.scheduled_at, a.external_id, a.google_calendar_event_id, a.status
     FROM appointments a
     JOIN contacts c ON c.id = a.contact_id
     WHERE a.tenant_id = $1 AND c.first_name = 'Tera' AND c.last_name = 'Bains'
       AND a.provider = 'optimantra'
       AND a.status IN ('scheduled', 'confirmed', 'rescheduled')
       AND a.scheduled_at >= NOW()
     ORDER BY a.scheduled_at`,
    [tenantId],
  );
  console.log('\n── Tera upcoming after repair ──');
  console.table(r.rows.map((row) => ({
    scheduled_at: row.scheduled_at,
    external_id: row.external_id,
    gcal: row.google_calendar_event_id,
    status: row.status,
  })));
}

async function main() {
  const { dryRun, only, aug6ExternalId } = parseArgs();

  const tenantCheck = await db.query('SELECT name FROM tenants WHERE id = $1', [SLUICE_TENANT_ID]);
  if (!tenantCheck.rows.length) {
    console.error('Tenant not found:', SLUICE_TENANT_ID);
    process.exit(1);
  }

  console.log(`Repair Sluice ping-pong appointments — ${tenantCheck.rows[0].name}`);
  if (dryRun) console.log('DRY RUN — no changes\n');

  const runTera = !only || only === 'tera';
  const runAlisha = !only || only === 'alisha';

  if (runTera) {
    await repairTera(SLUICE_TENANT_ID, { dryRun, aug6ExternalId });
  }
  if (runAlisha) {
    await repairAlisha(SLUICE_TENANT_ID, { dryRun });
  }

  if (!dryRun && runTera) {
    await verifyTera(SLUICE_TENANT_ID);
  }

  console.log('\nDone. Run Sync now in Settings → Google Calendar to link any remaining GCal events.');
  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
