// Run: node test_format.js
import assert from 'node:assert';
import { baht, pct, parseDate, formatDate, delta, daysBetween } from './js/format.js';

// baht — integers only, no decimals, thousands separated
assert.strictEqual(baht(102497), '฿102,497');
assert.strictEqual(baht(0), '฿0');
assert.strictEqual(baht(-39686), '฿-39,686');
assert.strictEqual(baht(5540.7), '฿5,541', 'rounds, never shows decimals');
assert.strictEqual(baht(null), '฿0', 'null is 0, not NaN');
assert.strictEqual(baht(undefined), '฿0');

// pct
assert.strictEqual(pct(18.63), '18.6%');
assert.strictEqual(pct(18.63, 0), '19%');
assert.strictEqual(pct(null), '0.0%');

// parseDate — both padded and unpadded days occur in data.json
assert.deepStrictEqual(parseDate('31/07/2026'), new Date(2026, 6, 31));
assert.deepStrictEqual(parseDate('1/1/2026'), new Date(2026, 0, 1));
assert.deepStrictEqual(parseDate('06/07/2026'), new Date(2026, 6, 6));
assert.strictEqual(parseDate('Date'), null, 'header row text is not a date');
assert.strictEqual(parseDate(''), null);
assert.strictEqual(parseDate(null), null);
assert.strictEqual(parseDate('31/02/2026'), null, 'rejects a day that overflows its month');
assert.strictEqual(parseDate('2026-07-31'), null, 'ISO is not the data format');

// formatDate
assert.strictEqual(formatDate(new Date(2026, 6, 31)), 'Fri 31 Jul');
assert.strictEqual(formatDate(new Date(2026, 0, 1)), 'Thu 1 Jan');

// delta
assert.deepStrictEqual(delta(110, 100), { pct: 10, direction: 'up' });
assert.strictEqual(delta(110, 0), null, 'no baseline means no delta, not Infinity');
assert.strictEqual(delta(110, null), null);
const down = delta(5540, 7809);
assert.strictEqual(down.direction, 'down');
assert.ok(Math.abs(down.pct + 29.05) < 0.1, 'B1 31 Jul vs its 31-day average is about -29%');

// daysBetween
assert.strictEqual(daysBetween(new Date(2026, 6, 31), new Date(2026, 7, 2)), 2);
assert.strictEqual(daysBetween(new Date(2026, 6, 31), new Date(2026, 6, 31)), 0);

console.log('✅ format OK');
