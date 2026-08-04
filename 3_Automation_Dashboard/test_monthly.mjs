// Run: node test_monthly.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildMonthlyModel, whatMoved, renderMonthly, PROFIT_SHARE, buildOpexRows } from './js/views/monthly.mjs';

const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));

assert.deepStrictEqual(PROFIT_SHARE, { B1: 0.6, B2: 0.7, B3: 0.7 });

const model = buildMonthlyModel({ reports, month: 'Jul26', previousMonth: 'Jun26' });

// --- settlement totals ---
assert.strictEqual(model.month, 'Jul26');
assert.strictEqual(model.blessmeTotal, 51254, 'B1 30,568 + B3 20,686');
assert.strictEqual(model.mingTotal, 29244, 'B1 20,379 + B3 8,865');

// --- per-branch ---
const b1 = model.branches.find(b => b.branch === 'B1');
assert.strictEqual(b1.rev, 242090);
assert.strictEqual(b1.cogs, 83339);
assert.strictEqual(b1.gross, 242090 - 83339);
assert.strictEqual(b1.net, 63331);
assert.strictEqual(b1.lossApplied, 12385);
assert.strictEqual(b1.distributable, 50946);
assert.strictEqual(b1.blessme, 30568);
assert.strictEqual(b1.ming, 20379);
assert.strictEqual(b1.absorbed, false);

// --- THE critical case: B2 earned money and pays out nothing ---
const b2 = model.branches.find(b => b.branch === 'B2');
assert.strictEqual(b2.net, 9616, 'B2 was profitable in July');
assert.strictEqual(b2.blessme, 0, 'but pays out nothing');
assert.strictEqual(b2.ming, 0);
assert.strictEqual(b2.absorbed, true, 'must be explicitly flagged as absorbed, not just zero');
assert.ok(b2.lossApplied > 0, 'the absorbing loss must be quantified');

const b3 = model.branches.find(b => b.branch === 'B3');
assert.strictEqual(b3.net, 29551);
assert.strictEqual(b3.lossApplied, 0);

// --- totals row ---
assert.strictEqual(model.totals.rev, 549947);
// ฿102,498, one baht above reports_data.json's own 102,497. The report rounds
// the unrounded sum (102,497.25); the statement sums the rounded per-branch
// cells it actually displays (63,331 + 9,616 + 29,551). The displayed total
// must equal the displayed rows — a table that does not add up is the bug this
// redesign replaces. No financial rule changed; business_rules.js is untouched.
assert.strictEqual(model.totals.net, 102498);
assert.strictEqual(
  model.totals.net,
  model.branches.reduce((s, b) => s + b.net, 0),
  'the total must always equal the sum of the branch cells on screen'
);

// --- whatMoved: computed facts, never hand-written prose ---
const moved = whatMoved(model);
assert.ok(Array.isArray(moved));
assert.ok(moved.length >= 1 && moved.length <= 5, `expected 1-5 facts, got ${moved.length}`);
moved.forEach(f => assert.strictEqual(typeof f, 'string'));
assert.ok(
  moved.some(f => /B2/.test(f) && /absorb|loss/i.test(f)),
  `the absorbed payout must be called out, got: ${JSON.stringify(moved)}`
);

// --- render carries the explanation, not just the zero ---
const html = renderMonthly(model);
assert.ok(html.includes('฿51,254'), 'Blessme total');
assert.ok(html.includes('฿29,244'), 'Ming total');
assert.ok(html.includes('฿9,616'), "B2's net must be shown even though it pays nothing");
assert.ok(
  /absorb/i.test(html),
  'the page must explain WHY B2 pays zero, not merely display 0'
);
assert.ok(html.includes('฿549,947'), 'statement total revenue');

// --- a month with no report degrades cleanly ---
const missing = buildMonthlyModel({ reports, month: 'Dec26', previousMonth: 'Nov26' });
assert.strictEqual(missing.branches.length, 0);
assert.ok(/no data/i.test(renderMonthly(missing)));

// --- OPEX breakdown ---
assert.ok(Array.isArray(model.opexRows));
assert.ok(model.opexRows.length > 0, 'July has rent and salary rows');
model.opexRows.forEach((e) => {
  assert.ok(['B1', 'B2', 'B3'].includes(e.branch));
  assert.strictEqual(typeof e.amt, 'number');
});
const opexTotal = model.opexRows.reduce((s, e) => s + e.amt, 0);
assert.strictEqual(
  opexTotal, model.totals.rental + model.totals.opex,
  'the listed rows must add up to the statement total — they disagreed in the old dashboard'
);
assert.ok(
  !model.opexRows.some((e) => e.cat === 'Orange' || e.cat === 'Ice'),
  'COGS categories must not appear in the OPEX table'
);
assert.deepStrictEqual(buildOpexRows(null), []);

// --- chart canvases are present for mountCharts to find ---
assert.ok(html.includes('id="chartRevenue"'));
assert.ok(html.includes('id="chartPayment"'));
assert.ok(html.includes('id="chartProduct"'));
assert.ok(html.includes('id="chartDayOfWeek"'));

console.log('✅ monthly view OK');
