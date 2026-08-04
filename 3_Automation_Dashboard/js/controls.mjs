import { BRANCHES } from './data.mjs';

// 'all' means "no filter": Full Year for months, All branches for branches.
export const ALL = 'all';
export const BRANCH_OPTIONS = [ALL, ...BRANCHES];

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const monthParts = (key) => {
  const m = /^([A-Za-z]{3})(\d{2})$/.exec(String(key || ''));
  return m ? { month: MONTH_ORDER.indexOf(m[1]), year: Number(m[2]) } : { month: -1, year: -1 };
};

// Chronological, not alphabetical — a plain sort gives Apr, Feb, Jan, Jul.
export function sortMonths(months) {
  return [...months].sort((a, b) => {
    const pa = monthParts(a);
    const pb = monthParts(b);
    return pa.year !== pb.year ? pa.year - pb.year : pa.month - pb.month;
  });
}

// Union across branches, not just B1's: B3 opened in July and B2 in April, so
// any single branch's key list is incomplete.
export function monthsFrom(data) {
  const branches = (data || {}).branches;
  if (!branches || typeof branches !== 'object') return [];
  const seen = new Set();
  Object.keys(branches).forEach((b) => {
    Object.keys((branches[b] || {}).sales || {}).forEach((m) => seen.add(m));
  });
  return sortMonths([...seen]);
}

// Day numbers that actually have an entry in the selected month and branch.
// Never a blind 1..31: B3 opened on 11 July, so offering it day 5 would render
// an empty page that reads as a bug rather than as "no data".
export function daysFrom(data, month, branch = ALL) {
  if (!data || month === ALL) return [];
  const branches = (data || {}).branches || {};
  const wanted = branch === ALL ? Object.keys(branches) : [branch];
  const days = new Set();
  wanted.forEach((b) => {
    ((branches[b] || {}).sales || {})[month]?.forEach((row) => {
      const m = /^(\d{1,2})\//.exec(String(row.d || ''));
      if (m) days.add(Number(m[1]));
    });
  });
  return [...days].sort((a, b) => a - b);
}

// Keep the day the owner picked if it still exists after a month or branch
// change; otherwise fall back to the newest day available.
export function resolveDay(days, chosen) {
  if (!days.length) return null;
  return days.includes(Number(chosen)) ? Number(chosen) : days[days.length - 1];
}

export const monthLabel = (m) => (m === ALL ? 'Full Year' : `${m.slice(0, 3)} ${m.slice(3)}`);

export const branchLabel = (b) => (b === ALL ? 'All branches' : b);

const option = (value, label, current) =>
  `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`;

export function renderControls({ months, month, branch, days = [], day = null, showDay = false }) {
  // Newest first: the current month is the one looked at most.
  const monthOpts = [ALL, ...sortMonths(months).reverse()]
    .map((m) => option(m, monthLabel(m), month))
    .join('');
  const branchOpts = BRANCH_OPTIONS
    .map((b) => option(b, branchLabel(b), branch))
    .join('');

  // The day picker only exists on the daily view, and only when a single month
  // is selected — "day 14 of the Full Year" is meaningless.
  const dayControl = showDay && days.length
    ? `<select class="control" data-control="day" aria-label="Day">${
        [...days].reverse().map((d) => option(String(d), `Day ${d}`, String(day))).join('')
      }</select>`
    : '';

  return `
    <div class="controls">
      <select class="control" data-control="month" aria-label="Month">${monthOpts}</select>
      ${dayControl}
      <select class="control" data-control="branch" aria-label="Branch">${branchOpts}</select>
    </div>
  `;
}
