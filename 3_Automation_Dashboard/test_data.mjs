// Run: node test_data.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BRANCHES, validateData, validateReports, flattenSales,
  seriesFor, trailingAverage, loadAll
} from './js/data.js';

const real = JSON.parse(readFileSync('data.json', 'utf8'));
const realReports = JSON.parse(readFileSync('reports_data.json', 'utf8'));

assert.deepStrictEqual(BRANCHES, ['B1', 'B2', 'B3']);

// --- validateData: report problems, never throw ---
assert.strictEqual(validateData(real).ok, true, 'the real file must validate');
assert.strictEqual(validateData(null).ok, false);
assert.strictEqual(validateData(undefined).ok, false);
assert.strictEqual(validateData('nonsense').ok, false);
assert.ok(validateData({}).errors.some(e => /branches/.test(e)));
assert.ok(validateData({ branches: {} }).errors.some(e => /expenses/.test(e)));
assert.ok(
  validateData({ branches: { B1: { sales: {} } }, expenses: [] }).errors.some(e => /B2/.test(e)),
  'names the specific missing branch'
);

// --- validateReports ---
assert.strictEqual(validateReports(realReports).ok, true);
assert.strictEqual(validateReports(null).ok, false);
assert.ok(validateReports({}).errors.some(e => /all/.test(e)));

// --- flattenSales: sorted, complete, drops nothing from real data ---
const { rows, dropped } = flattenSales(real);
assert.strictEqual(dropped, 0, 'every real date parses');
assert.ok(rows.length > 200, `expected 200+ rows, got ${rows.length}`);
for (let i = 1; i < rows.length; i++) {
  assert.ok(rows[i].date >= rows[i - 1].date, 'rows must be sorted ascending by date');
}
const last = rows[rows.length - 1];
assert.strictEqual(last.date.getFullYear(), 2026);
assert.strictEqual(last.date.getMonth(), 6, 'newest data is July 2026');
assert.strictEqual(last.date.getDate(), 31);

// a bad date is dropped and counted, never silently included
const withBad = flattenSales({
  branches: {
    B1: { sales: { Jul26: [{ d: '31/07/2026', rev: 100, tot: 2 }, { d: 'Date', rev: 999, tot: 9 }] } },
    B2: { sales: {} }, B3: { sales: {} }
  },
  expenses: []
});
assert.strictEqual(withBad.rows.length, 1);
assert.strictEqual(withBad.dropped, 1);

// --- seriesFor ---
const b1 = seriesFor(rows, 'B1');
assert.ok(b1.every(r => r.branch === 'B1'));
assert.strictEqual(b1.length, 211, 'B1 has 211 days Jan–Jul');

const all = seriesFor(rows, 'all');
for (let i = 1; i < all.length; i++) {
  assert.ok(all[i].date > all[i - 1].date, 'the "all" series has one row per date');
}
const jul31 = all.find(r => r.date.getTime() === new Date(2026, 6, 31).getTime());
assert.strictEqual(jul31.rev, 14748, 'B1 5540 + B2 3020 + B3 6188 on 31 Jul');

// --- trailingAverage ---
assert.strictEqual(trailingAverage([], new Date(2026, 6, 31), 30), 0, 'empty series averages to 0, not NaN');
const flat = [
  { date: new Date(2026, 6, 29), rev: 100 },
  { date: new Date(2026, 6, 30), rev: 200 },
  { date: new Date(2026, 6, 31), rev: 300 }
];
assert.strictEqual(trailingAverage(flat, new Date(2026, 6, 31), 30), 200);
assert.strictEqual(
  trailingAverage(flat, new Date(2026, 6, 30), 30), 150,
  'excludes days after endDate'
);

// --- loadAll: surfaces fetch failure as an error, does not throw ---
const okLoad = await loadAll(async (url) => ({
  ok: true,
  json: async () => JSON.parse(readFileSync(url.split('?')[0], 'utf8'))
}));
assert.strictEqual(okLoad.errors.length, 0);
assert.ok(okLoad.data.branches);
assert.ok(okLoad.reports.all);

const missingReports = await loadAll(async (url) => {
  if (url.startsWith('reports_data.json')) return { ok: false, status: 404 };
  return { ok: true, json: async () => JSON.parse(readFileSync(url.split('?')[0], 'utf8')) };
});
assert.ok(missingReports.data, 'data still loads when reports are missing');
assert.strictEqual(missingReports.reports, null);
assert.ok(
  missingReports.errors.some(e => /update-dashboard/.test(e)),
  'tells the owner how to fix it'
);

const totalFailure = await loadAll(async () => { throw new Error('network down'); });
assert.strictEqual(totalFailure.data, null);
assert.ok(totalFailure.errors.length > 0, 'a thrown fetch becomes an error, not an exception');

console.log('✅ data OK');
