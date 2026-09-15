// Local-calendar date helpers (mirrors Swift `Calendar.current` usage: local timezone, Monday-based weeks).

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function isSameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

// Swift: (weekday + 5) % 7 where weekday is 1=Sunday..7=Saturday -> days since Monday.
export function weekStart(date) {
  const today = startOfDay(date);
  const jsWeekday = today.getDay(); // 0=Sunday..6=Saturday
  const daysFromMonday = (jsWeekday + 6) % 7;
  return addDays(today, -daysFromMonday);
}

export function dayKey(date) {
  return startOfDay(date).getTime();
}

export function formatDateAbbrev(date) {
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function weekdayAbbrev(date) {
  return new Date(date).toLocaleDateString(undefined, { weekday: 'short' });
}

export function monthAbbrev(date) {
  return new Date(date).toLocaleDateString(undefined, { month: 'short' });
}

export function dayMonthAbbrev(date) {
  return new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
