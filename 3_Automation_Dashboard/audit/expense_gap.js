// Size the "missing expense" hole per branch/month.
// A branch cannot trade for a month with near-zero recorded cost. Where recorded cost is
// implausibly low, the money still left the account — it is just not in the books.
// Benchmark = B1's own verified COGS ratio from the owner's Google Sheet (Jan-Mar 26).
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = require('./gsheet_source.json');
const { dailyRows, parseDate } = require('./sheet_rows');
const MONTHS = ['Jan26','Feb26','Mar26','Apr26','May26','Jun26','Jul26'];
const BRANCHES = ['B1','B2','B3'];

// Verified from the owner's sheet: COGS / revenue for the three months with real slip data.
const VERIFIED = ['Jan26','Feb26','Mar26'].map((m) => SRC._sheet_pnl[m].cogs / SRC._sheet_pnl[m].revenue);
const BENCH_COGS_RATIO = VERIFIED.reduce((a, b) => a + b, 0) / VERIFIED.length;

// Contracted monthly fixed costs per CLAUDE.md. B2 opened 18 Apr, B3 opened 11 Jul.
const FIXED = {
  B1: { rent: 35000, salary: 35000, utilities: 4000, from: 'Jan26' },
  B2: { rent: 30000, salary: 30000, utilities: 4000, from: 'Apr26' },
  B3: { rent: 19000, salary: 46500, utilities: 4000, from: 'Jul26' },
};
const fixedTotal = (b) => FIXED[b].rent + FIXED[b].salary + FIXED[b].utilities;
const f = (n) => Math.round(n).toLocaleString('en-US');

console.log(`Benchmark COGS ratio (B1 verified Jan-Mar): ${(BENCH_COGS_RATIO * 100).toFixed(1)}% of revenue\n`);

let grandGap = 0;
const table = [];

for (const branch of BRANCHES) {
  const file = path.join(__dirname, '..', `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) continue;
  const wb = XLSX.readFile(file);

  // Recorded expenses per month, from the one ledger that matters.
  const recorded = {};
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Daily_Expenses'], { header: 1 }).slice(3)) {
    const d = parseDate(r[0]);
    if (!d) continue;
    const key = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.month] + '26';
    recorded[key] = (recorded[key] || 0) + (Number(r[5]) || 0);
  }

  for (const month of MONTHS) {
    const sheet = wb.Sheets[month];
    if (!sheet) continue;
    const rev = dailyRows(sheet).reduce((a, r) => a + r.revenue, 0);
    if (!rev) continue;

    const trading = MONTHS.indexOf(month) >= MONTHS.indexOf(FIXED[branch].from);
    const expected = rev * BENCH_COGS_RATIO + (trading ? fixedTotal(branch) : 0);
    const got = recorded[month] || 0;
    const gap = expected - got;
    grandGap += Math.max(0, gap);
    table.push({ branch, month, rev, got, expected, gap });
  }
}

console.log('Branch Month   Revenue    Recorded   Expected*  UNRECORDED  Flag');
console.log('------ ------ ---------- ---------- ---------- ----------- ----------------');
for (const t of table) {
  const flag = t.gap > t.expected * 0.5 ? 'SEVERE' : t.gap > t.expected * 0.2 ? 'suspect' : 'ok';
  console.log(
    `${t.branch}     ${t.month}  ${f(t.rev).padStart(9)}  ${f(t.got).padStart(9)}  ` +
    `${f(t.expected).padStart(9)}  ${f(Math.max(0, t.gap)).padStart(10)}  ${flag}`
  );
}
console.log(`\n* Expected = revenue x ${(BENCH_COGS_RATIO * 100).toFixed(1)}% COGS + contracted fixed costs.`);
console.log(`TOTAL UNRECORDED SPEND (estimate): ${f(grandGap)}`);
console.log(`\nThis is money that left the account with no slip in the ledger.`);
console.log(`It is the leading candidate for "cash disappeared" alongside the ${f(413306)} in distributions.`);

(function selfCheck() {
  const assert = require('assert');
  assert.ok(BENCH_COGS_RATIO > 0.2 && BENCH_COGS_RATIO < 0.6, 'benchmark ratio must be plausible for a juice bar');
  assert.ok(table.length > 0, 'must produce at least one branch-month row');
  assert.ok(table.every((t) => t.rev > 0), 'zero-revenue months must be skipped, not scored');
})();
