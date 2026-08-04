// Run: node test_audit.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildAuditModel, renderAudit } from './js/audit.mjs';

const data = JSON.parse(readFileSync('data.json', 'utf8'));

const model = buildAuditModel({ data, branch: 'all', month: 'Jul26' });

// --- reconciliation across all three branches in July ---
assert.strictEqual(model.days, 83, '31 B1 + 31 B2 + 21 B3 trading days');
assert.strictEqual(model.actual, 549947, 'matches the revenue every other view reports');
assert.strictEqual(model.theoretical, 524950);
assert.strictEqual(model.diff, 24997, 'actual minus theoretical');
assert.ok(Math.abs(model.variancePct - 4.76) < 0.01, `got ${model.variancePct}`);
assert.strictEqual(model.flagged.length, 11, 'eleven days exceed the tolerance');

// flagged rows carry what is needed to investigate the day
model.flagged.forEach((f) => {
  assert.ok(['B1', 'B2', 'B3'].includes(f.branch));
  assert.strictEqual(typeof f.dateLabel, 'string');
  assert.strictEqual(typeof f.rev, 'number');
  assert.strictEqual(typeof f.theoretical, 'number');
  assert.strictEqual(f.diff, f.rev - f.theoretical);
});
// largest discrepancy first — that is the one worth opening
for (let i = 1; i < model.flagged.length; i++) {
  assert.ok(
    Math.abs(model.flagged[i].diff) <= Math.abs(model.flagged[i - 1].diff),
    'flagged days sorted by absolute variance, largest first'
  );
}

// --- branch filter ---
const b1 = buildAuditModel({ data, branch: 'B1', month: 'Jul26' });
assert.strictEqual(b1.days, 31);
assert.ok(b1.actual < model.actual);
assert.ok(b1.flagged.every((f) => f.branch === 'B1'));

// --- full year ---
const year = buildAuditModel({ data, branch: 'all', month: 'all' });
assert.ok(year.days > model.days, 'the full year has more days than July alone');
assert.strictEqual(year.actual, 2558806, 'full-year revenue');

// --- a period with no data reconciles to zero, never NaN ---
const none = buildAuditModel({ data, branch: 'B3', month: 'Jan26' });
assert.strictEqual(none.days, 0);
assert.strictEqual(none.variancePct, 0, 'no theoretical base means 0%, not NaN or Infinity');
assert.deepStrictEqual(none.flagged, []);

// --- render ---
const html = renderAudit(model);
assert.ok(/reconcil/i.test(html));
assert.ok(html.includes('฿549,947'), 'actual revenue');
assert.ok(html.includes('฿524,950'), 'theoretical revenue');
assert.ok(/11/.test(html), 'flagged count must be visible');
assert.ok(renderAudit(none).length > 0, 'empty period still renders something');

console.log('✅ audit OK');
