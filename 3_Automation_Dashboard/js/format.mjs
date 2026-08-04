const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS_PER_DAY = 86400000;

export const baht = (n) => '฿' + Math.round(Number(n) || 0).toLocaleString('en-US');

export const pct = (n, digits = 1) => (Number(n) || 0).toFixed(digits) + '%';

// data.json carries DD/MM/YYYY with inconsistent day padding: both "1/1/2026"
// and "31/07/2026" occur. Returns null for anything else — including the
// literal "Date" header text that has appeared inside sheet bodies.
export function parseDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s ?? '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(year, month - 1, day);
  // Date rolls 31/02 forward into March; reject rather than silently shift.
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return date;
}

export const formatDate = (date) =>
  `${DAY_ABBR[date.getDay()]} ${date.getDate()} ${MONTH_ABBR[date.getMonth()]}`;

export function delta(current, baseline) {
  const base = Number(baseline) || 0;
  if (base === 0) return null;
  const change = ((Number(current) || 0) - base) / base * 100;
  return { pct: change, direction: change >= 0 ? 'up' : 'down' };
}

export const daysBetween = (a, b) => Math.round((b - a) / MS_PER_DAY);
