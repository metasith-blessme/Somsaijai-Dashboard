// Run: node test_stock.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildStockModel, renderStock, MEASURED_ITEMS, UNTRACKED_PRODUCTS } from './js/views/stock.mjs';

const data = JSON.parse(readFileSync('data.json', 'utf8'));

// --- 9 measured lines: the 8 from the spec plus condensed milk ---
assert.strictEqual(MEASURED_ITEMS.length, 9);
const labels = MEASURED_ITEMS.map(i => i.label);
['Orange', 'Watermelon', 'Mango', 'Apple', 'Guava', 'Pineapple'].forEach((n) => {
  assert.ok(labels.some(l => l.includes(n)), `${n} must be measured`);
});
assert.ok(labels.some(l => /conden/i.test(l)), 'condensed milk has real usage and must appear');
assert.ok(!labels.some(l => /young/i.test(l)), 'young coconut is zero everywhere and must be omitted');

// --- products sold but absent from the schema are named, not hidden ---
assert.ok(UNTRACKED_PRODUCTS.includes('Mangosteen'));
assert.ok(UNTRACKED_PRODUCTS.includes('Rambutan'));

const model = buildStockModel({ data, asOf: new Date(2026, 6, 31) });

// --- measured burn rates come out per branch ---
assert.strictEqual(model.measured.length, 9);
const orange = model.measured.find(m => m.label.includes('Orange'));
assert.ok(orange.perBranch.B1.rate30 > 0, 'B1 used 65 orange baskets in July');
assert.ok(orange.perBranch.B1.rate30 < 10, 'a daily rate, not a monthly total');

// B1 records no guava; that is shown as zero, not as a missing key
const guava = model.measured.find(m => m.label.includes('Guava'));
assert.strictEqual(guava.perBranch.B1.rate30, 0);
assert.ok(guava.perBranch.B2.rate30 > 0, 'B2 does record guava');

// --- spend-only categories are labelled, never presented as measured ---
assert.ok(model.spendOnly.length > 0);
const packaging = model.spendOnly.find(s => s.cat === 'Packaging');
assert.ok(packaging, 'Packaging is the largest spend-only category');
assert.ok(packaging.amount > 0);
model.spendOnly.forEach((s) => {
  assert.ok(!MEASURED_ITEMS.some(m => m.label === s.cat), `${s.cat} is measured and must not be listed as spend-only`);
});

// --- render states the limits explicitly ---
const html = renderStock(model);
assert.ok(/spend only/i.test(html), 'must label the unmeasured tier');
assert.ok(/no usage tracked/i.test(html));
assert.ok(/Mangosteen/.test(html), 'untracked products must be named on screen');
assert.ok(!/days? left/i.test(html), 'must NOT claim days-remaining — there is no stock count to support it');
assert.ok(!/reorder/i.test(html), 'must NOT imply a reorder alert');

// --- empty data degrades cleanly ---
const empty = buildStockModel({
  data: { branches: { B1: { sales: {} }, B2: { sales: {} }, B3: { sales: {} } }, expenses: [] },
  asOf: new Date(2026, 6, 31)
});
assert.ok(renderStock(empty).length > 0);

console.log('✅ stock view OK');
