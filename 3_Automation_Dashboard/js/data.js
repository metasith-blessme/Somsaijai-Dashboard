import { parseDate } from './format.js';

export const BRANCHES = ['B1', 'B2', 'B3'];

export function validateData(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['data.json is missing or is not an object'] };
  }
  const errors = [];
  if (!raw.branches || typeof raw.branches !== 'object') {
    errors.push('data.json is missing its "branches" object');
  } else {
    BRANCHES.forEach((b) => {
      if (!raw.branches[b]) errors.push(`data.json is missing branch ${b}`);
    });
  }
  if (!Array.isArray(raw.expenses)) {
    errors.push('data.json is missing its "expenses" array');
  }
  return { ok: errors.length === 0, errors };
}

export function validateReports(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, errors: ['reports_data.json is missing or is not an object'] };
  }
  const errors = [];
  if (!raw.all) errors.push('reports_data.json is missing its "all" annual summary');
  return { ok: errors.length === 0, errors };
}

// Flat chronological series across every branch and month. A row whose date
// cannot be parsed is dropped and counted rather than included — a bad date
// would otherwise silently shift every trailing average that spans it.
export function flattenSales(data) {
  const rows = [];
  let dropped = 0;
  BRANCHES.forEach((branch) => {
    const sales = ((data.branches || {})[branch] || {}).sales || {};
    Object.keys(sales).forEach((month) => {
      (sales[month] || []).forEach((raw) => {
        const date = parseDate(raw.d);
        if (!date) { dropped += 1; return; }
        rows.push({
          branch, month, date,
          rev: Number(raw.rev) || 0,
          cups: Number(raw.tot) || 0,
          raw
        });
      });
    });
  });
  rows.sort((a, b) => a.date - b.date);
  return { rows, dropped };
}

// branch === 'all' collapses the three branches into one row per calendar date.
export function seriesFor(rows, branch) {
  if (branch !== 'all') return rows.filter((r) => r.branch === branch);
  const byDate = new Map();
  rows.forEach((r) => {
    const key = r.date.getTime();
    const acc = byDate.get(key);
    if (acc) {
      acc.rev += r.rev;
      acc.cups += r.cups;
      acc.parts.push(r);
    } else {
      byDate.set(key, { branch: 'all', date: r.date, rev: r.rev, cups: r.cups, parts: [r] });
    }
  });
  return [...byDate.values()].sort((a, b) => a.date - b.date);
}

export function trailingAverage(rows, endDate, days) {
  const end = endDate.getTime();
  const start = end - (days * 86400000);
  const window = rows.filter((r) => {
    const t = r.date.getTime();
    return t <= end && t > start;
  });
  if (window.length === 0) return 0;
  return window.reduce((s, r) => s + r.rev, 0) / window.length;
}

export async function loadAll(fetchFn = fetch) {
  const errors = [];
  const bust = `?t=${Date.now()}`;
  const read = async (file, required) => {
    try {
      const res = await fetchFn(file + bust);
      if (!res.ok) {
        errors.push(`Could not load ${file} (HTTP ${res.status}). Run \`npm run update-dashboard\` to regenerate it.`);
        return null;
      }
      return await res.json();
    } catch (err) {
      errors.push(`Could not load ${file}: ${err.message}.${required ? ' Run `npm run update-dashboard` to regenerate it.' : ''}`);
      return null;
    }
  };

  const [data, reports] = await Promise.all([read('data.json', true), read('reports_data.json', true)]);

  if (data) {
    const check = validateData(data);
    if (!check.ok) errors.push(...check.errors);
  }
  if (reports) {
    const check = validateReports(reports);
    if (!check.ok) errors.push(...check.errors);
  }
  return { data, reports, errors };
}
