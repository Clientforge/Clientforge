/** Demo availability — next 14 bookable days (Tue–Sat), 30-min slots. */
export function nextBookableDays(count = 14) {
  const out = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day === 0 || day === 1) continue;
    out.push(new Date(d));
  }
  return out;
}

export function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDayIso(date) {
  return date.toISOString().slice(0, 10);
}

export function slotsForDay(date, stylistId) {
  const day = date.getDay();
  const startHour = day === 6 ? 8 : 9;
  const endHour = day === 6 ? 18 : 19;
  const slots = [];
  let h = startHour;
  let m = 0;
  const seed = (date.getDate() + (stylistId?.charCodeAt(0) || 0)) % 5;
  while (h < endHour || (h === endHour && m === 0)) {
    const label = formatTime12(h, m);
    const taken = (h + m / 60 + seed) % 4 === 0;
    if (!taken) slots.push(label);
    m += 30;
    if (m >= 60) {
      m = 0;
      h += 1;
    }
  }
  return slots;
}

function formatTime12(h, m) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}
