// Run: node test_controls.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BRANCH_OPTIONS, ALL, sortMonths, monthsFrom, monthLabel, branchLabel, renderControls
} from './js/controls.mjs';

const data = JSON.parse(readFileSync('data.json', 'utf8'));

assert.deepStrictEqual(BRANCH_OPTIONS, ['all', 'B1', 'B2', 'B3']);
assert.strictEqual(ALL, 'all');

// --- sortMonths: chronological, not alphabetical ---
assert.deepStrictEqual(
  sortMonths(['Jul26', 'Jan26', 'Mar26']),
  ['Jan26', 'Mar26', 'Jul26'],
  'alphabetical would put Jan, Jul, Mar'
);
assert.deepStrictEqual(
  sortMonths(['Feb27', 'Dec26', 'Jan27']),
  ['Dec26', 'Jan27', 'Feb27'],
  'year takes precedence over month'
);
assert.deepStrictEqual(sortMonths([]), []);
assert.deepStrictEqual(sortMonths(['Jun26', 'Jun26']), ['Jun26', 'Jun26'], 'duplicates are not dropped here');

// --- monthsFrom: every month present across all branches, sorted, deduped ---
const months = monthsFrom(data);
assert.deepStrictEqual(months, ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26']);
assert.deepStrictEqual(monthsFrom(null), [], 'no data means no months, not a throw');
assert.deepStrictEqual(monthsFrom({}), []);
// B3 opened in July, so a union across branches is required, not just B1's keys
assert.ok(monthsFrom({
  branches: { B1: { sales: { Jan26: [] } }, B2: { sales: { Jun26: [] } }, B3: { sales: { Jul26: [] } } }
}).join(',') === 'Jan26,Jun26,Jul26');

// --- labels ---
assert.strictEqual(monthLabel('Jul26'), 'Jul 26');
assert.strictEqual(monthLabel('all'), 'Full Year');
assert.strictEqual(branchLabel('all'), 'All branches');
assert.strictEqual(branchLabel('B2'), 'B2');

// --- renderControls: two native selects, current value marked selected ---
const html = renderControls({ months, month: 'Jun26', branch: 'B2' });
assert.ok(/<select[^>]+data-control="month"/.test(html), 'month select must be tagged for the change handler');
assert.ok(/<select[^>]+data-control="branch"/.test(html));
assert.ok(/<option value="Jun26" selected/.test(html), 'current month must be preselected');
assert.ok(/<option value="B2" selected/.test(html), 'current branch must be preselected');
assert.ok(html.includes('Full Year'), 'the all-months option must be offered');
assert.ok(html.includes('>Jan 26<'), 'every month must be reachable');
assert.ok(html.includes('>Jul 26<'));
// exactly one selected option per select
assert.strictEqual((html.match(/selected/g) || []).length, 2);

// newest month first: the owner looks at the current month far more than January
const order = [...html.matchAll(/<option value="([A-Za-z]{3}\d{2})"/g)].map((m) => m[1]);
assert.deepStrictEqual(
  order,
  ['Jul26', 'Jun26', 'May26', 'Apr26', 'Mar26', 'Feb26', 'Jan26'],
  'months listed newest first'
);

// --- degrades with no months ---
const bare = renderControls({ months: [], month: 'all', branch: 'all' });
assert.ok(bare.includes('Full Year'), 'Full Year is always available');
assert.strictEqual(typeof bare, 'string');

console.log('✅ controls OK');
