// Run: node test_log.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildLogModel, renderLog } from './js/views/log.js';

const data = JSON.parse(readFileSync('data.json', 'utf8'));

const model = buildLogModel({ data, branch: 'B1', month: 'Jul26' });
assert.strictEqual(model.rows.length, 31, 'July has 31 days of B1 data');
assert.ok(model.months.includes('Jul26'));
assert.ok(model.months.includes('Jan26'));

const last = model.rows[model.rows.length - 1];
assert.strictEqual(last.rev, 5540);
assert.strictEqual(last.dateLabel, 'Fri 31 Jul');
assert.strictEqual(typeof last.cash, 'number');
assert.strictEqual(typeof last.scan, 'number');
assert.strictEqual(typeof last.cups, 'number');
assert.strictEqual(typeof last.flagged, 'boolean');

// all branches together
const all = buildLogModel({ data, branch: 'all', month: 'Jul26' });
assert.ok(all.rows.length > 31, 'all branches means more rows than one branch');

// a month with no data is empty, not an exception
const none = buildLogModel({ data, branch: 'B3', month: 'Jan26' });
assert.strictEqual(none.rows.length, 0);
assert.ok(/no /i.test(renderLog(none)));

const html = renderLog(model);
assert.ok(html.includes('฿5,540'));
assert.ok(html.includes('Fri 31 Jul'));

console.log('✅ log view OK');
