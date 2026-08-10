#!/usr/bin/env node
/**
 * Filter Soothing Intention Square client export for ClientForge contact import.
 *
 * Usage:
 *   node scripts/generateSoothingIntentionImport.js \
 *     "/path/to/soothing intention client list.csv.xlsx" \
 *     "/path/to/output.csv"
 *
 * Default output: ../fixtures/soothing-intention-clientforge-import.csv
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const input = process.argv[2]
  || path.join(process.env.HOME || '', 'Downloads/soothing intention client list.csv.xlsx');
const output = process.argv[3]
  || path.join(__dirname, '../fixtures/soothing-intention-clientforge-import.csv');

const py = `
import zipfile, xml.etree.ElementTree as ET, csv, re, sys
from datetime import datetime, timedelta
from pathlib import Path

EXCEL_EPOCH = datetime(1899, 12, 30)
CUTOFF = datetime(2026, 5, 19) - timedelta(days=4 * 365)
SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def col_letter(cell_ref):
    m = re.match(r'([A-Z]+)', cell_ref or '')
    return m.group(1) if m else ''

def excel_date(val):
    if val is None or val == '': return None
    try:
        n = float(val)
        if n < 30000 or n > 60000: return None
        return EXCEL_EPOCH + timedelta(days=n)
    except (TypeError, ValueError):
        return None

def qualifies(rec):
    last = excel_date(rec.get('Last Visit', ''))
    first = excel_date(rec.get('First Visit', ''))
    if last: return last >= CUTOFF
    if first: return first >= CUTOFF
    return False

def clean_phone(raw):
    if raw is None: return ''
    s = str(raw).strip().lstrip("'")
    digits = re.sub(r'\\D', '', s)
    if len(digits) == 10: return f'+1{digits}'
    if len(digits) == 11 and digits.startswith('1'): return f'+{digits}'
    if s.startswith('+') and len(digits) >= 10: return '+' + digits
    return ''

def clean_name(s):
    return re.sub(r'\\s+', ' ', str(s or '').strip())

def get(rec, key):
    v = rec.get(key, '')
    return str(v).strip() if v is not None else ''

with zipfile.ZipFile(SRC) as z:
    shared = ET.fromstring(z.read('xl/sharedStrings.xml'))
    strings = []
    for si in shared.findall('m:si', ns):
        t = si.find('m:t', ns)
        if t is not None and t.text:
            strings.append(t.text)
        else:
            strings.append(''.join(
                r.find('m:t', ns).text or ''
                for r in si.findall('m:r', ns)
                if r.find('m:t', ns) is not None
            ))
    sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows_xml = sheet.findall('.//m:sheetData/m:row', ns)
    headers = {}
    records = []
    for ri, row in enumerate(rows_xml):
        cells = {}
        for c in row.findall('m:c', ns):
            col = col_letter(c.get('r', ''))
            v = c.find('m:v', ns)
            val = v.text if v is not None else ''
            if c.get('t') == 's' and val.isdigit():
                val = strings[int(val)]
            cells[col] = val
        if ri == 0:
            headers = {col: val for col, val in cells.items()}
            continue
        records.append({headers.get(col, col): val for col, val in cells.items()})

rows_out = []
for rec in records:
    if not qualifies(rec):
        continue
    phone = clean_phone(get(rec, 'Phone Number'))
    if not phone or len(re.sub(r'\\D', '', phone)) < 10:
        continue
    last = excel_date(get(rec, 'Last Visit'))
    first = excel_date(get(rec, 'First Visit'))
    notes_parts = []
    ref, memo, nick = get(rec, 'Reference ID'), get(rec, 'Memo'), get(rec, 'Nickname')
    if ref: notes_parts.append(f'Ref: {ref}')
    if last: notes_parts.append(f'Last visit: {last.strftime("%Y-%m-%d")}')
    if first: notes_parts.append(f'First visit: {first.strftime("%Y-%m-%d")}')
    if memo: notes_parts.append(f'Memo: {memo}')
    if nick: notes_parts.append(f'Nickname: {nick}')
    rows_out.append({
        'phone': phone,
        'first_name': clean_name(get(rec, 'First Name')),
        'last_name': clean_name(get(rec, 'Last Name')),
        'email': get(rec, 'Email Address').lower(),
        'last_visit': last.strftime('%Y-%m-%d') if last else '',
        'tags': 'soothing-intention,visited-4yr',
        'notes': ' | '.join(notes_parts),
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
with OUT.open('w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['phone','first_name','last_name','email','last_visit','tags','notes'])
    w.writeheader()
    w.writerows(rows_out)
print(len(rows_out))
`;

if (!fs.existsSync(input)) {
  console.error('Input file not found:', input);
  process.exit(1);
}

const count = execFileSync('python3', ['-c', py, input, output], { encoding: 'utf8' }).trim();
console.log(`Wrote ${count} rows to ${output}`);
