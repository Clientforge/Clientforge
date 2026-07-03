#!/usr/bin/env node
/**
 * Convert Sluice Drip Spa OptiMantra patient export → ClientForge contact CSV.
 *
 * Usage:
 *   node scripts/generateSluiceImport.js [input.csv] [output.csv]
 *
 * Defaults:
 *   input:  ~/Downloads/Sluice Drip Spa Patient List - Latest Appointment.csv
 *   output: ../fixtures/sluice-drip-spa-import.csv
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { parseDateOfBirth } = require('../src/services/contact.service');

const DEFAULT_INPUT = path.join(
  process.env.HOME || '',
  'Downloads/Sluice Drip Spa Patient List - Latest Appointment.csv',
);
const DEFAULT_OUTPUT = path.join(__dirname, '../fixtures/sluice-drip-spa-import.csv');

const TEST_PHONE_DIGITS = '1111111111';

function parseOptiMantraRow(line) {
  let inner = line.trim();
  if (inner.startsWith('"') && inner.endsWith('"')) {
    inner = inner.slice(1, -1);
  }
  const parts = inner.split(',""');
  const out = [parts[0]];
  for (const p of parts.slice(1)) {
    out.push(p.replace(/""/g, '"').replace(/"+$/g, '').trim());
  }
  return out;
}

function parseAppointmentDate(raw) {
  if (!raw) return null;
  const cleaned = String(raw).replace(/["',]+/g, '').trim();
  if (!cleaned) return null;

  const slash = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    return new Date(Date.UTC(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2])));
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function slugifyTag(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeCsv(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function readSourceRows(inputPath) {
  const raw = fs.readFileSync(inputPath);
  let text;
  if (raw[0] === 0xff && raw[1] === 0xfe) {
    text = raw.toString('utf16le');
  } else {
    text = raw.toString('utf8');
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length <= 1) return [];

  return lines.slice(1).map(parseOptiMantraRow).filter((r) => r.length >= 8);
}

function buildContactRecords(rows) {
  const byPhone = new Map();

  for (const r of rows) {
    const firstName = (r[0] || '').trim();
    const lastName = (r[1] || '').trim();
    const dobRaw = (r[3] || '').trim();
    const phoneRaw = (r[4] || '').trim() || (r[6] || '').trim();
    const email = (r[7] || '').trim().toLowerCase();
    const apptRaw = (r[8] || '').trim() || (r[9] || '').trim();
    const service = (r[10] || '').trim().replace(/["',]+$/g, '').trim();

    const phone = normalizePhone(phoneRaw);
    const digits = phone.replace(/\D/g, '');
    if (!phone || digits.length < 10) continue;
    if (digits.endsWith(TEST_PHONE_DIGITS)) continue;

    const apptDate = parseAppointmentDate(apptRaw);
    const dateOfBirth = parseDateOfBirth(dobRaw);
    const tag = service ? slugifyTag(service) : '';

    const candidate = {
      phone,
      firstName,
      lastName,
      email: email || '',
      dateOfBirth: dateOfBirth || '',
      tag,
      serviceName: service,
      notes: apptDate
        ? `Last visit: ${apptDate.toISOString().slice(0, 10)}${service ? ` | Service: ${service}` : ''}`
        : (service ? `Service: ${service}` : ''),
      apptTime: apptDate ? apptDate.getTime() : 0,
    };

    const existing = byPhone.get(phone);
    if (!existing || candidate.apptTime >= existing.apptTime) {
      byPhone.set(phone, candidate);
    }
  }

  return [...byPhone.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
}

function writeCsv(outputPath, records) {
  const header = 'phone,first_name,last_name,email,date_of_birth,tags,notes';
  const lines = [header];
  for (const r of records) {
    const tags = r.tag ? `sluice-import,${r.tag}` : 'sluice-import';
    lines.push([
      escapeCsv(r.phone),
      escapeCsv(r.firstName),
      escapeCsv(r.lastName),
      escapeCsv(r.email),
      escapeCsv(r.dateOfBirth),
      escapeCsv(tags),
      escapeCsv(r.notes),
    ].join(','));
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const input = process.argv[2] || DEFAULT_INPUT;
  const output = process.argv[3] || DEFAULT_OUTPUT;

  if (!fs.existsSync(input)) {
    console.error('Input file not found:', input);
    process.exit(1);
  }

  const rows = readSourceRows(input);
  const records = buildContactRecords(rows);
  writeCsv(output, records);

  const withTag = records.filter((r) => r.tag).length;
  console.log(`Parsed ${rows.length} source row(s)`);
  console.log(`Wrote ${records.length} contact(s) to ${output}`);
  console.log(`With service tag: ${withTag}, without service tag: ${records.length - withTag}`);
}

main();
