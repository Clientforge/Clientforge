/**
 * eClinicalWorks FHIR R4 → ClientForge checkout + contact shape.
 */

const FINISHED_STATUSES = new Set(['finished', 'completed']);
const UPCOMING_STATUSES = new Set(['planned', 'arrived', 'triaged', 'in-progress', 'onleave']);

function pickPatientPhone(telecom) {
  if (!Array.isArray(telecom)) return null;
  const phones = telecom.filter((t) => t && t.system === 'phone');
  const mobile = phones.find((t) => t.use === 'mobile' || t.use === 'cell');
  const chosen = mobile || phones[0];
  return chosen?.value ? String(chosen.value).trim() : null;
}

function pickPatientName(patient) {
  const name = Array.isArray(patient?.name) ? patient.name[0] : null;
  if (!name) return { firstName: null, lastName: null };
  const firstName = name.given?.[0] ? String(name.given[0]).trim() : null;
  const lastName = name.family ? String(name.family).trim() : null;
  return { firstName, lastName };
}

function pickPatientEmail(telecom) {
  if (!Array.isArray(telecom)) return null;
  const email = telecom.find((t) => t && t.system === 'email');
  return email?.value ? String(email.value).trim() : null;
}

function encounterServiceLabel(encounter) {
  const type = Array.isArray(encounter?.type) ? encounter.type[0] : null;
  if (type?.text) return String(type.text).trim();
  const coding = type?.coding?.[0];
  if (coding?.display) return String(coding.display).trim();
  if (encounter?.class?.display) return String(encounter.class.display).trim();
  return 'Office visit';
}

function encounterCheckedOutAt(encounter) {
  const end = encounter?.period?.end;
  if (end) {
    const d = new Date(end);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const updated = encounter?.meta?.lastUpdated;
  if (updated) {
    const d = new Date(updated);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function isFinishedEncounter(encounter) {
  const status = String(encounter?.status || '').toLowerCase();
  return FINISHED_STATUSES.has(status);
}

function isCancelledEncounter(encounter) {
  return String(encounter?.status || '').toLowerCase() === 'cancelled';
}

/** Planned (or in-progress) encounter whose start is still in the future. */
function isUpcomingEncounter(encounter, now = new Date()) {
  const status = String(encounter?.status || '').toLowerCase();
  if (!UPCOMING_STATUSES.has(status)) return false;
  const start = encounter?.period?.start;
  if (!start) return false;
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return false;
  const asOf = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return d > asOf;
}

/** Best-effort encounter time for poll window (eCW may not support _lastUpdated search). */
function encounterRelevantSince(encounter, sinceDate) {
  if (!sinceDate || !(sinceDate instanceof Date) || Number.isNaN(sinceDate.getTime())) {
    return true;
  }
  const end = encounter?.period?.end;
  if (end) {
    const d = new Date(end);
    if (!Number.isNaN(d.getTime())) return d >= sinceDate;
  }
  const updated = encounter?.meta?.lastUpdated;
  if (updated) {
    const d = new Date(updated);
    if (!Number.isNaN(d.getTime())) return d >= sinceDate;
  }
  return false;
}

function patientIdFromEncounter(encounter) {
  const ref = encounter?.subject?.reference || '';
  const m = ref.match(/Patient\/(.+)/i);
  return m ? m[1] : null;
}

function practitionerRefId(reference) {
  const m = String(reference || '').match(/Practitioner\/(.+)/i);
  return m ? m[1] : null;
}

function practitionerIdFromEncounter(encounter) {
  for (const ext of encounter?.extension || []) {
    const url = String(ext?.url || '');
    if (url.includes('Encounter/resource/provider') && ext.valueReference?.reference) {
      const id = practitionerRefId(ext.valueReference.reference);
      if (id) return id;
    }
  }

  for (const part of encounter?.participant || []) {
    const types = Array.isArray(part?.type) ? part.type : [];
    const isPrimary = types.some((t) => {
      const codings = Array.isArray(t?.coding) ? t.coding : [];
      if (codings.some((c) => String(c?.code || '').toUpperCase() === 'PPRF')) return true;
      return /primary/i.test(String(t?.text || ''));
    });
    if (isPrimary && part.individual?.reference) {
      const id = practitionerRefId(part.individual.reference);
      if (id) return id;
    }
  }

  for (const part of encounter?.participant || []) {
    if (part?.individual?.reference) {
      const id = practitionerRefId(part.individual.reference);
      if (id) return id;
    }
  }

  return null;
}

function practitionerNameFromMap(practitionersById, encounter) {
  if (!practitionersById || typeof practitionersById.get !== 'function') return null;
  const id = practitionerIdFromEncounter(encounter);
  if (!id) return null;
  return pickPractitionerName(practitionersById.get(id));
}

function pickPractitionerName(practitioner) {
  const name = Array.isArray(practitioner?.name) ? practitioner.name[0] : null;
  if (!name) return null;
  if (name.text) {
    const text = String(name.text).trim();
    if (text) return text;
  }
  const given = (name.given || []).map((g) => String(g).trim()).filter(Boolean).join(' ');
  const family = name.family ? String(name.family).trim() : '';
  const combined = [given, family].filter(Boolean).join(' ');
  return combined || null;
}

function normalizeEcwUpcomingEncounter(encounter, patient) {
  if (!encounter?.id) {
    throw new Error('Encounter missing id');
  }
  const start = encounter?.period?.start;
  const scheduled = start ? new Date(start) : null;
  if (!scheduled || Number.isNaN(scheduled.getTime())) {
    throw new Error(`Encounter ${encounter.id} has no start`);
  }

  const { firstName, lastName } = pickPatientName(patient);
  const telecom = patient?.telecom;
  const externalId = `ecw:encounter:${encounter.id}`;

  return {
    contact: {
      firstName,
      lastName,
      phone: pickPatientPhone(telecom),
      email: pickPatientEmail(telecom),
      ecwPatientId: patient?.id || patientIdFromEncounter(encounter),
    },
    appointment: {
      externalId,
      provider: 'ecw',
      scheduledAt: scheduled.toISOString(),
      timezone: 'America/New_York',
      serviceName: encounterServiceLabel(encounter),
      durationMinutes: null,
      rawPayload: encounter,
    },
  };
}

function normalizeEcwCheckout(encounter, patient) {
  if (!encounter?.id) {
    throw new Error('Encounter missing id');
  }
  if (!isFinishedEncounter(encounter)) {
    throw new Error(`Encounter ${encounter.id} is not finished`);
  }

  const { firstName, lastName } = pickPatientName(patient);
  const telecom = patient?.telecom;
  const phone = pickPatientPhone(telecom);
  const email = pickPatientEmail(telecom);
  const checkedOutAt = encounterCheckedOutAt(encounter);
  const externalId = `ecw:encounter:${encounter.id}`;

  return {
    contact: {
      firstName,
      lastName,
      phone,
      email,
      ecwPatientId: patient?.id || patientIdFromEncounter(encounter),
    },
    checkout: {
      externalId,
      provider: 'ecw',
      checkedOutAt,
      rawPayload: { encounter, patient: patient ? { id: patient.id, resourceType: patient.resourceType } : null },
    },
    appointment: {
      externalId,
      provider: 'ecw',
      scheduledAt: checkedOutAt,
      timezone: null,
      serviceName: encounterServiceLabel(encounter),
      durationMinutes: null,
      rawPayload: encounter,
    },
    primaryServiceName: encounterServiceLabel(encounter),
  };
}

module.exports = {
  normalizeEcwCheckout,
  normalizeEcwUpcomingEncounter,
  isFinishedEncounter,
  isCancelledEncounter,
  isUpcomingEncounter,
  encounterRelevantSince,
  patientIdFromEncounter,
  practitionerIdFromEncounter,
  practitionerNameFromMap,
  pickPractitionerName,
  pickPatientPhone,
};
