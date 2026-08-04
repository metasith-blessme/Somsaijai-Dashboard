// Run: node test_app.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { VIEWS, viewFromHash, safeRender, renderView } from './js/app.js';

assert.deepStrictEqual(VIEWS, ['daily', 'monthly', 'stock', 'log']);

// --- routing ---
assert.strictEqual(viewFromHash('#monthly'), 'monthly');
assert.strictEqual(viewFromHash('#stock'), 'stock');
assert.strictEqual(viewFromHash(''), 'daily', 'default view');
assert.strictEqual(viewFromHash('#nonsense'), 'daily', 'unknown hash falls back');
assert.strictEqual(viewFromHash(null), 'daily');

// --- safeRender: a throwing view becomes a card, never an exception ---
const good = safeRender('daily', () => '<p>fine</p>');
assert.strictEqual(good, '<p>fine</p>');

const bad = safeRender('monthly', () => { throw new Error('boom'); });
assert.ok(typeof bad === 'string', 'must return a string, not rethrow');
assert.ok(/monthly/i.test(bad), 'names the failing view');
assert.ok(/boom/.test(bad), 'surfaces the real error so it can be fixed');
assert.ok(/error/i.test(bad));

// --- every real view renders without throwing ---
const data = JSON.parse(readFileSync('data.json', 'utf8'));
const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));
const today = new Date(2026, 7, 2);

VIEWS.forEach((name) => {
  const html = renderView({ name, data, reports, today, branch: 'all', month: 'Jul26' });
  assert.strictEqual(typeof html, 'string');
  assert.ok(html.length > 100, `${name} produced suspiciously little HTML`);
  assert.ok(!/error rendering/i.test(html), `${name} threw during render`);
});

// --- a broken payload degrades per-view, page survives ---
VIEWS.forEach((name) => {
  const html = renderView({ name, data: null, reports: null, today, branch: 'all', month: 'Jul26' });
  assert.strictEqual(typeof html, 'string', `${name} must still return a string with null data`);
  assert.ok(html.length > 0);
});

console.log('✅ app OK');
