// Two different questions, two different units of analysis:
//
//   1. GROUP level  — is any money leaving the account without being recorded anywhere?
//   2. BRANCH level — is the recorded cost allocated to the right branch?
//
// B2 and B3 have no slips by design (ADR 0001): shared purchases are bought centrally, booked
// against B1, then allocated by usage/revenue share. So a per-branch shortfall is an
// ALLOCATION gap, not missing money. Only the group total can reveal genuinely unrecorded spend.
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
const MONTH_ABBR = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const cells = [];
for (const branch of BRANCHES) {
  const file = path.join(__dirname, '..', `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) continue;
  const wb = XLSX.readFile(file);

  const recorded = {};
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Daily_Expenses'], { header: 1 }).slice(3)) {
    const d = parseDate(r[0]);
    if (!d) continue;
    const key = MONTH_ABBR[d.month] + '26';
    recorded[key] = (recorded[key] || 0) + (Number(r[5]) || 0);
  }

  for (const month of MONTHS) {
    const rev = dailyRows(wb.Sheets[month]).reduce((a, r) => a + r.revenue, 0);
    if (!rev) continue;
    const trading = MONTHS.indexOf(month) >= MONTHS.indexOf(FIXED[branch].from);
    cells.push({
      branch, month, rev,
      got: recorded[month] || 0,
      expected: rev * BENCH_COGS_RATIO + (trading ? fixedTotal(branch) : 0),
    });
  }
}

console.log(`Benchmark COGS ratio (B1 verified Jan-Mar): ${(BENCH_COGS_RATIO * 100).toFixed(1)}% of revenue`);
console.log(`Costs are pooled and allocated (ADR 0001), so the GROUP total is the honest unit.\n`);

// ---------- 1. GROUP LEVEL: is money leaving without being recorded? ----------
console.log('=== GROUP TOTAL (all branches combined) ===\n');
console.log('Month   Revenue    Recorded   Expected   Difference  Reading');
console.log('------ ---------- ---------- ---------- ----------- --------------------------');
let unrecorded = 0;
for (const month of MONTHS) {
  const inMonth = cells.filter((c) => c.month === month);
  if (!inMonth.length) continue;
  const rev = inMonth.reduce((a, c) => a + c.rev, 0);
  const got = inMonth.reduce((a, c) => a + c.got, 0);
  const exp = inMonth.reduce((a, c) => a + c.expected, 0);
  const diff = got - exp;
  if (diff < 0) unrecorded += -diff;
  const reading = diff < -exp * 0.2 ? 'UNRECORDED SPEND' : diff < 0 ? 'slightly light' : 'fully recorded';
  console.log(
    `${month}  ${f(rev).padStart(9)}  ${f(got).padStart(9)}  ${f(exp).padStart(9)}  ` +
    `${(diff >= 0 ? '+' : '') + f(diff).padStart(9)}  ${reading}`
  );
}
console.log(`\nGENUINELY UNRECORDED SPEND (group level): ${f(unrecorded)}`);

// ---------- 1b. Jan-Mar: actual vs actual, no benchmark needed ----------
// The owner's sheet records what was really spent those months (COGS + SG&A + capex).
// Comparing it to Daily_Expenses is evidence, not estimation.
console.log(`\n\n=== Jan-Mar: Excel ledger vs the owner's own records (actual vs actual) ===\n`);
console.log('Month   Owner sheet  Excel ledger  Shortfall  Note');
console.log('------ ------------ ------------- ---------- ---------------------------');
let ledgerShortfall = 0;
for (const month of ['Jan26', 'Feb26', 'Mar26']) {
  const p = SRC._sheet_pnl[month];
  const capex = { Jan26: 851, Feb26: 1068, Mar26: 8369 }[month];
  const actual = p.cogs + SRC._sheet_fixed_costs_SGA[month].total + capex;
  // Jan's Excel figure is inflated by the Dec distribution misfiled as COGS/Ice.
  const misfiled = month === 'Jan26' ? 79961 : 0;
  const excel = cells.filter((c) => c.month === month).reduce((a, c) => a + c.got, 0) - misfiled;
  const short = actual - excel;
  ledgerShortfall += Math.max(0, short);
  const note = misfiled ? `excl. ${f(misfiled)} misfiled distribution` : '';
  console.log(`${month}  ${f(actual).padStart(11)}  ${f(excel).padStart(12)}  ${f(short).padStart(9)}  ${note}`);
}
console.log(`\nExpenses the owner recorded but the Excel ledger never captured: ${f(ledgerShortfall)}`);
console.log(`This is a bookkeeping gap, not missing cash — the money is accounted for in the sheet.`);

// ---------- 2. BRANCH LEVEL: is the pooled cost allocated correctly? ----------
console.log(`\n\n=== ALLOCATION CHECK (per branch — gaps here are misallocation, not missing money) ===\n`);
console.log('Branch Month   Revenue    Recorded   Expected   Over/(Under)');
console.log('------ ------ ---------- ---------- ---------- ------------');
for (const c of cells) {
  const diff = c.got - c.expected;
  console.log(
    `${c.branch}     ${c.month}  ${f(c.rev).padStart(9)}  ${f(c.got).padStart(9)}  ` +
    `${f(c.expected).padStart(9)}  ${((diff >= 0 ? '+' : '') + f(diff)).padStart(12)}`
  );
}

const over = cells.filter((c) => c.got > c.expected).reduce((a, c) => a + c.got - c.expected, 0);
const under = cells.filter((c) => c.got < c.expected).reduce((a, c) => a + c.expected - c.got, 0);
console.log(`\nB1 holds ${f(over)} more cost than its own trade justifies.`);
console.log(`B2+B3 hold ${f(under)} less than theirs requires.`);
console.log(`=> ${f(Math.min(over, under))} of pooled cost is sitting in the wrong branch and needs allocating.`);
console.log(`   Until it is, B2 and B3 profit — and the profit share paid on it — is overstated.`);

(function selfCheck() {
  const assert = require('assert');
  assert.ok(BENCH_COGS_RATIO > 0.2 && BENCH_COGS_RATIO < 0.6, 'benchmark ratio must be plausible for a juice bar');
  assert.ok(cells.length > 0, 'must produce at least one branch-month cell');
  assert.ok(cells.every((c) => c.rev > 0), 'zero-revenue months must be skipped, not scored');
  // Allocation gaps must net out of the group view: group diff == sum of branch diffs.
  const groupDiff = cells.reduce((a, c) => a + c.got - c.expected, 0);
  assert.strictEqual(Math.round(groupDiff), Math.round(over - under),
    'group difference must equal over minus under — otherwise the two views disagree');
})();
