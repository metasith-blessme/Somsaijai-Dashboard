// Run: node test_controls.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  BRANCH_OPTIONS, ALL, sortMonths, monthsFrom, monthLabel, branchLabel, renderControls,
  daysFrom, resolveDay
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

// --- daysFrom: only days that actually have data, never a blind 1..31 ---
const julDays = daysFrom(data, 'Jul26', ALL);
assert.strictEqual(julDays.length, 31, 'July has all 31 days across the group');
assert.strictEqual(julDays[0], 1);
assert.strictEqual(julDays[30], 31);
for (let i = 1; i < julDays.length; i++) {
  assert.ok(julDays[i] > julDays[i - 1], 'ascending and deduplicated');
}

// B3 opened on 11 July, so it must offer 21 days, not 31 — offering a day with
// no data would render an empty page that looks like a bug.
const b3Days = daysFrom(data, 'Jul26', 'B3');
assert.strictEqual(b3Days.length, 21);
assert.strictEqual(b3Days[0], 11, 'B3 opened on the 11th');
assert.strictEqual(b3Days[20], 31);

assert.deepStrictEqual(daysFrom(data, 'Jan26', 'B3'), [], 'B3 did not exist in January');
assert.deepStrictEqual(daysFrom(null, 'Jul26', ALL), []);
// Full Year is not a single month, so it offers no day list
assert.deepStrictEqual(daysFrom(data, ALL, ALL), []);

// --- resolveDay: keep the chosen day when it still exists, else fall back ---
assert.strictEqual(resolveDay(julDays, 15), 15, 'a valid day is kept');
assert.strictEqual(resolveDay(julDays, null), 31, 'no choice means the newest day');
assert.strictEqual(
  resolveDay(b3Days, 5), 31,
  'switching to B3 from 5 July must not strand you on a day B3 has no data for'
);
assert.strictEqual(resolveDay([], 12), null, 'no days at all means no selection');

// --- the day control only appears where it is meaningful ---
const dailyHtml = renderControls({
  months, month: 'Jul26', branch: ALL, days: julDays, day: 15, showDay: true
});
assert.ok(/data-control="day"/.test(dailyHtml), 'daily view must offer a day picker');
assert.ok(/<option value="15" selected/.test(dailyHtml), 'chosen day preselected');
assert.ok(/<option value="31"/.test(dailyHtml), 'the last day of the month is reachable');
assert.ok(/<option value="1"/.test(dailyHtml), 'the first day is reachable');
assert.strictEqual(
  (dailyHtml.match(/data-control="day"[\s\S]*?<\/select>/)[0].match(/<option/g) || []).length,
  31,
  'one option per day with data'
);

const monthlyHtml = renderControls({ months, month: 'Jul26', branch: ALL, showDay: false });
assert.ok(!/data-control="day"/.test(monthlyHtml), 'a day picker makes no sense on the monthly view');

console.log('✅ controls OK');
