// Run: node test_smoke.mjs
// Renders every view against the real data and fails on any thrown exception or
// silently-caught render error. This is the guard against a blank dashboard.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { VIEWS, renderView } from './js/app.js';

const data = JSON.parse(readFileSync('data.json', 'utf8'));
const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));
const months = Object.keys(reports).filter((m) => m !== 'all');

let renders = 0;

// Every view, every month, every branch filter.
for (const name of VIEWS) {
  for (const month of months) {
    for (const branch of ['all', 'B1', 'B2', 'B3']) {
      const html = renderView({ name, data, reports, today: new Date(2026, 7, 2), branch, month });
      assert.strictEqual(typeof html, 'string', `${name}/${month}/${branch} did not return a string`);
      assert.ok(
        !/Error rendering/i.test(html),
        `${name}/${month}/${branch} threw during render — see the error card text`
      );
      renders += 1;
    }
  }
}

// Hostile inputs must degrade, not explode.
const hostile = [
  { data: null, reports: null },
  { data: {}, reports: {} },
  { data: { branches: {}, expenses: [] }, reports: {} },
  { data: { branches: { B1: { sales: { Jul26: [] } }, B2: { sales: {} }, B3: { sales: {} } }, expenses: [] }, reports: {} }
];

for (const payload of hostile) {
  for (const name of VIEWS) {
    const html = renderView({
      ...payload, name, today: new Date(2026, 7, 2), branch: 'all', month: 'Jul26'
    });
    assert.strictEqual(typeof html, 'string', `${name} returned a non-string for a hostile payload`);
    assert.ok(html.length > 0, `${name} returned empty HTML — that is the blank-page bug`);
  }
}

console.log(`✅ smoke OK — ${renders} view renders, ${hostile.length * VIEWS.length} hostile payloads, no exceptions`);
