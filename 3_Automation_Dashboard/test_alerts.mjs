// Run: node test_alerts.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { flattenSales, seriesFor } from './js/data.js';
import {
  THRESHOLDS, FIXED_MONTHLY, revenueAnomaly, auditVariance, belowBreakEven, buildAlerts
} from './js/alerts.js';

assert.strictEqual(THRESHOLDS.REVENUE_DEVIATION_PCT, 20);
assert.deepStrictEqual(FIXED_MONTHLY, { B1: 74000, B2: 59000, B3: 69500 });

// --- revenueAnomaly ---
assert.strictEqual(revenueAnomaly('B1', 7800, 7809), null, 'a normal day is silent');
assert.strictEqual(revenueAnomaly('B1', 7000, 7809), null, '-10% is inside the band');
const dropped = revenueAnomaly('B1', 5540, 7809);
assert.ok(dropped, '-29% must fire');
assert.strictEqual(dropped.severity, 'high');
assert.strictEqual(dropped.branch, 'B1');
assert.ok(/29/.test(dropped.message), `message should carry the number, got: ${dropped.message}`);
assert.ok(/down/i.test(dropped.message));

const spiked = revenueAnomaly('B3', 12000, 8186);
assert.strictEqual(spiked.severity, 'info', 'an unusually good day is information, not a problem');
assert.ok(/up/i.test(spiked.message));

assert.strictEqual(revenueAnomaly('B1', 5000, 0), null, 'no baseline means no alert, not Infinity');

// --- auditVariance ---
assert.strictEqual(auditVariance('B2', [{ raw: { audit: { is_flagged: false } } }]), null);
const flagged = auditVariance('B1', [
  { raw: { audit: { is_flagged: true, rev_diff: 9000 } } },
  { raw: { audit: { is_flagged: false, rev_diff: 10 } } },
  { raw: { audit: { is_flagged: true, rev_diff: 4000 } } }
]);
assert.ok(flagged);
assert.strictEqual(flagged.severity, 'warn');
assert.ok(/2/.test(flagged.message), 'reports how many days are flagged');
assert.strictEqual(auditVariance('B1', []), null);
assert.strictEqual(auditVariance('B1', [{ raw: {} }]), null, 'a row with no audit block is not a flag');

// --- belowBreakEven ---
assert.strictEqual(belowBreakEven('B1', 90000), null, 'above the fixed base is fine');
const under = belowBreakEven('B2', 9616);
assert.ok(under, 'B2 net 9,616 is far below its 59,000 base');
assert.strictEqual(under.severity, 'high');
assert.ok(/B2/.test(under.message));
assert.strictEqual(belowBreakEven('ZZ', 100), null, 'an unknown branch has no known base');

// --- buildAlerts against real data ---
const data = JSON.parse(readFileSync('data.json', 'utf8'));
const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));
const { rows } = flattenSales(data);
const latest = rows[rows.length - 1].date;

const alerts = buildAlerts({ rows, latest, reports });
assert.ok(Array.isArray(alerts));
assert.ok(alerts.length > 0, '31 Jul 2026 is a quiet day across all three branches — something must fire');
alerts.forEach((a) => {
  assert.ok(['high', 'warn', 'info'].includes(a.severity), `bad severity: ${a.severity}`);
  assert.ok(typeof a.message === 'string' && a.message.length > 0);
});
for (let i = 1; i < alerts.length; i++) {
  const rank = { high: 0, warn: 1, info: 2 };
  assert.ok(rank[alerts[i].severity] >= rank[alerts[i - 1].severity], 'sorted most severe first');
}
assert.ok(
  alerts.some(a => a.branch === 'B1' && /down/i.test(a.message)),
  'B1 fell 29% on the last day and must be reported'
);

// a perfectly normal set of inputs produces no alerts
const quiet = buildAlerts({ rows: [], latest: new Date(2026, 6, 31), reports: { Jul26: {} } });
assert.deepStrictEqual(quiet, [], 'no data means no invented alerts');

console.log('✅ alerts OK');
