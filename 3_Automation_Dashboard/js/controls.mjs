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

export const monthLabel = (m) => (m === ALL ? 'Full Year' : `${m.slice(0, 3)} ${m.slice(3)}`);

export const branchLabel = (b) => (b === ALL ? 'All branches' : b);

const option = (value, label, current) =>
  `<option value="${value}"${value === current ? ' selected' : ''}>${label}</option>`;

export function renderControls({ months, month, branch }) {
  // Newest first: the current month is the one looked at most.
  const monthOpts = [ALL, ...sortMonths(months).reverse()]
    .map((m) => option(m, monthLabel(m), month))
    .join('');
  const branchOpts = BRANCH_OPTIONS
    .map((b) => option(b, branchLabel(b), branch))
    .join('');

  return `
    <div class="controls">
      <select class="control" data-control="month" aria-label="Month">${monthOpts}</select>
      <select class="control" data-control="branch" aria-label="Branch">${branchOpts}</select>
    </div>
  `;
}
