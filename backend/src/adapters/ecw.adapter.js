/**
 * eClinicalWorks FHIR R4 → ClientForge checkout + contact shape.
 */

const FINISHED_STATUSES = new Set(['finished', 'completed']);

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

function patientIdFromEncounter(encounter) {
  const ref = encounter?.subject?.reference || '';
  const m = ref.match(/Patient\/(.+)/i);
  return m ? m[1] : null;
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
  isFinishedEncounter,
  patientIdFromEncounter,
  pickPatientPhone,
};
