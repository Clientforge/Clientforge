const WEEKS_PER_MONTH = 4.33;

const WEEKDAYS = [
  { key: 'MONDAY', label: 'Mon', full: 'Monday' },
  { key: 'TUESDAY', label: 'Tue', full: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wed', full: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thu', full: 'Thursday' },
  { key: 'FRIDAY', label: 'Fri', full: 'Friday' },
  { key: 'SATURDAY', label: 'Sat', full: 'Saturday' },
  { key: 'SUNDAY', label: 'Sun', full: 'Sunday' },
];

function computeHoursFromTimeRange(startTime, endTime) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMinutes = sh * 60 + sm;
  const endMinutes = eh * 60 + em;
  const diff = endMinutes - startMinutes;
  return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
}

function parseWorkSchedule(json) {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry.day === 'string' &&
          typeof entry.startTime === 'string' &&
          typeof entry.endTime === 'string',
      )
      .sort(
        (a, b) =>
          WEEKDAYS.findIndex((d) => d.key === a.day) -
          WEEKDAYS.findIndex((d) => d.key === b.day),
      );
  } catch {
    return [];
  }
}

function computeWeeklyWorkHours(schedule) {
  return (
    Math.round(
      schedule.reduce((sum, entry) => sum + computeHoursFromTimeRange(entry.startTime, entry.endTime), 0) *
        10,
    ) / 10
  );
}

function computeMonthlyWorkHours(schedule) {
  return Math.round(computeWeeklyWorkHours(schedule) * WEEKS_PER_MONTH * 10) / 10;
}

function computeRequiredSupervisionHours(monthlyWorkHours, supervisionPercentage) {
  return Math.round(monthlyWorkHours * (supervisionPercentage / 100) * 10) / 10;
}

function formatTime12h(time24) {
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
}

function formatDayScheduleEntry(entry) {
  const day = WEEKDAYS.find((d) => d.key === entry.day)?.full ?? entry.day;
  const hours = computeHoursFromTimeRange(entry.startTime, entry.endTime);
  return `${day}: ${formatTime12h(entry.startTime)}–${formatTime12h(entry.endTime)} (${hours} hrs)`;
}

function formatWorkSchedule(schedule) {
  if (schedule.length === 0) return 'No schedule set';
  return schedule.map(formatDayScheduleEntry).join(' · ');
}

function getMonthBounds(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function isDateInMonth(date, year, month) {
  const d = new Date(date);
  return d.getFullYear() === year && d.getMonth() === month;
}

function computeRbtMonthlyStats(rbt, year, month) {
  const schedule = parseWorkSchedule(rbt.workSchedule);
  const weeklyWorkHours = computeWeeklyWorkHours(schedule);
  const monthlyWorkHours = computeMonthlyWorkHours(schedule);
  const requiredHours = computeRequiredSupervisionHours(monthlyWorkHours, rbt.supervisionPercentage);
  const requiredMinutes = Math.round(requiredHours * 60);

  const scheduleEntries = schedule.map((entry) => ({
    label: formatDayScheduleEntry(entry),
    hours: computeHoursFromTimeRange(entry.startTime, entry.endTime),
  }));

  const monthlySessions = (rbt.sessions || [])
    .filter((s) => isDateInMonth(new Date(s.date), year, month))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((s) => ({
      id: s.id,
      date: s.date,
      durationMinutes: s.durationMinutes,
      notes: s.notes,
      clientName: `${s.client.firstName} ${s.client.lastName}`,
    }));

  const completedMinutes = monthlySessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const remainingMinutes = Math.max(0, requiredMinutes - completedMinutes);
  const remainingHours = Math.round((remainingMinutes / 60) * 10) / 10;
  const percentCompleted =
    requiredMinutes > 0 ? Math.round((completedMinutes / requiredMinutes) * 1000) / 10 : 0;

  return {
    id: rbt.id,
    name: `${rbt.firstName} ${rbt.lastName}`,
    email: rbt.email,
    isActive: rbt.isActive,
    workScheduleLabel: formatWorkSchedule(schedule),
    scheduleEntries,
    weeklyWorkHours,
    monthlyWorkHours,
    supervisionPercentage: rbt.supervisionPercentage,
    requiredHours,
    requiredMinutes,
    completedMinutes,
    remainingMinutes,
    remainingHours,
    percentCompleted,
    sessionCount: monthlySessions.length,
    monthlySessions,
  };
}

module.exports = {
  getMonthBounds,
  computeRbtMonthlyStats,
};
