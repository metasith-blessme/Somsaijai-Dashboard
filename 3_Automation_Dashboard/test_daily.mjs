// Run: node test_daily.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildDailyModel, renderDaily } from './js/views/daily.mjs';

const data = JSON.parse(readFileSync('data.json', 'utf8'));
const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));

// "today" is injected so the test is not time-dependent.
const model = buildDailyModel({ data, reports, today: new Date(2026, 7, 2) });

// --- the headline is the latest date WITH DATA, not the calendar date ---
assert.strictEqual(model.date.getDate(), 31);
assert.strictEqual(model.date.getMonth(), 6, 'July, not August');
assert.strictEqual(model.dateLabel, 'Fri 31 Jul');
assert.strictEqual(model.stalenessDays, 2);
assert.ok(model.stalenessNote, 'two days behind must be disclosed');
assert.ok(/2 days/.test(model.stalenessNote), `got: ${model.stalenessNote}`);

// same-day data carries no staleness note
const fresh = buildDailyModel({ data, reports, today: new Date(2026, 6, 31) });
assert.strictEqual(fresh.stalenessDays, 0);
assert.strictEqual(fresh.stalenessNote, null);

// --- totals ---
assert.strictEqual(model.total, 14748, 'B1 5540 + B2 3020 + B3 6188');
assert.ok(model.totalDelta.direction === 'down');
// -18.6%, not the -30% each branch shows against its own average: the group's
// 30-day window reaches back to 2 Jul, before B3 opened on the 11th, so the
// group baseline is dragged down by days B3 did not trade. Band is tight on
// purpose — a change here means the windowing logic moved.
assert.ok(
  model.totalDelta.pct < -18 && model.totalDelta.pct > -19,
  `31 Jul was a quiet day, expected about -18.6%, got ${model.totalDelta.pct}`
);

// --- sparkline: 7 days ending on the headline date, oldest first ---
assert.strictEqual(model.sparkline.length, 7);
assert.strictEqual(model.sparkline[6], 14748, 'last point is the headline day');
model.sparkline.forEach(v => assert.strictEqual(typeof v, 'number'));

// --- branch rows ---
assert.strictEqual(model.branches.length, 3);
const b1 = model.branches.find(b => b.branch === 'B1');
assert.strictEqual(b1.rev, 5540);
assert.strictEqual(b1.delta.direction, 'down');
const b3 = model.branches.find(b => b.branch === 'B3');
assert.strictEqual(b3.rev, 6188);

// --- alerts are attached ---
assert.ok(Array.isArray(model.alerts));
assert.ok(model.alerts.length > 0);

// --- renderDaily produces HTML carrying the real numbers ---
const html = renderDaily(model);
assert.strictEqual(typeof html, 'string');
assert.ok(html.includes('฿14,748'), 'group total must appear');
assert.ok(html.includes('฿5,540'), 'B1 must appear');
assert.ok(html.includes('Fri 31 Jul'));
assert.ok(/2 days/.test(html), 'staleness must be visible, not just in the model');

// --- empty data degrades to a message, never throws ---
const empty = buildDailyModel({
  data: { branches: { B1: { sales: {} }, B2: { sales: {} }, B3: { sales: {} } }, expenses: [] },
  reports: {},
  today: new Date(2026, 7, 2)
});
assert.strictEqual(empty.date, null);
assert.deepStrictEqual(empty.alerts, []);
const emptyHtml = renderDaily(empty);
assert.ok(/no sales data/i.test(emptyHtml), `expected a friendly empty state, got: ${emptyHtml.slice(0, 120)}`);

console.log('✅ daily view OK');
