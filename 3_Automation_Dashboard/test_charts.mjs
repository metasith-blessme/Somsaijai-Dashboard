// Run: node test_charts.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { flattenSales } from './js/data.js';
import {
  buildRevenueSeries, buildPaymentMix, buildProductMix, buildDayOfWeek,
  buildChartModels, mountCharts
} from './js/charts.js';

const data = JSON.parse(readFileSync('data.json', 'utf8'));
const { rows } = flattenSales(data);

// --- revenue series: one point per day of the month, chronological ---
const rev = buildRevenueSeries({ rows, month: 'Jul26' });
assert.strictEqual(rev.labels.length, rev.data.length);
assert.strictEqual(rev.labels.length, 31, 'July has 31 days');
assert.strictEqual(rev.data[30], 14748, 'last day is the group total for 31 Jul');
rev.data.forEach((v) => assert.strictEqual(typeof v, 'number'));

// --- payment mix ---
const pay = buildPaymentMix({ rows, month: 'Jul26' });
assert.deepStrictEqual(pay.labels, ['Cash', 'Scan']);
assert.strictEqual(pay.data.length, 2);
assert.strictEqual(pay.data[0] + pay.data[1], 549947, 'cash + scan reconciles to July revenue');
assert.ok(pay.data[1] > pay.data[0], 'July was scan-heavy at 56%');

// --- product mix: cups by fruit, largest first, zero categories dropped ---
const prod = buildProductMix({ rows, month: 'Jul26' });
assert.strictEqual(prod.labels.length, prod.data.length);
assert.ok(prod.labels.length > 0);
assert.ok(prod.data.every((v) => v > 0), 'a zero-cup product must not occupy a slice');
for (let i = 1; i < prod.data.length; i++) {
  assert.ok(prod.data[i] <= prod.data[i - 1], 'sorted descending');
}
assert.ok(prod.labels.includes('Watermelon'), 'watermelon is the volume leader');

// --- day of week: exactly 7 buckets, Mon first ---
const dow = buildDayOfWeek({ rows, month: 'Jul26' });
assert.deepStrictEqual(dow.labels, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
assert.strictEqual(dow.data.length, 7);
assert.ok(dow.data.every((v) => v >= 0));

// --- combined ---
const models = buildChartModels({ data, month: 'Jul26' });
['revenue', 'payment', 'product', 'dayOfWeek'].forEach((k) => {
  assert.ok(models[k], `missing ${k} model`);
  assert.ok(Array.isArray(models[k].labels));
});

// --- an empty month yields empty models, never NaN or a throw ---
const empty = buildChartModels({ data, month: 'Dec26' });
assert.deepStrictEqual(empty.revenue.data, []);
assert.deepStrictEqual(empty.payment.data, [0, 0]);

// --- mountCharts: constructs one chart per canvas found, skips missing ones ---
const constructed = [];
function FakeChart(ctx, config) {
  constructed.push(config.type);
  this.destroy = () => {};
}
const canvases = {
  chartRevenue: { getContext: () => ({}) },
  chartPayment: { getContext: () => ({}) },
  chartProduct: { getContext: () => ({}) },
  chartDayOfWeek: { getContext: () => ({}) }
};
mountCharts(models, FakeChart, { getElementById: (id) => canvases[id] || null });
assert.strictEqual(constructed.length, 4, 'all four charts mount');

// a missing canvas is skipped silently rather than throwing
constructed.length = 0;
mountCharts(models, FakeChart, { getElementById: () => null });
assert.strictEqual(constructed.length, 0, 'no canvas means no chart, and no exception');

console.log('✅ charts OK');
