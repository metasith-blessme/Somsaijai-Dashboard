// May 2026 reconciliation: work back from the owner's booked profit split to find what the
// ledger is missing. The owner booked Blessme ฿41,128 / Ming ฿22,318 for May.
// B1 splits 60/40 and B2 splits 70/30, so those two numbers uniquely determine each branch's
// profit — which gives a hard target to reconcile the ledger against.
const XLSX = require('xlsx');
const path = require('path');
const { dailyRows, parseDate } = require('./sheet_rows');

const BOOKED = { blessme: 41128, ming: 22318 };

// Confirmed by owner 2026-08-05.
// B1 May payroll: ฿24,000 staff + ฿19,000 Ming. B2 May payroll: ฿17,200.
const CONFIRMED_SALARY = { B1: 24000 + 19000, B2: 17200 };
// 21 May traded but was never entered. From the paper tallies (IMG_1358 = B-1, IMG_1357 = B-2),
// both of which cross-foot exactly against their own line items.
const DAY_21 = {
  B1: { revenue: 7300, cash: 1410, scan: 5890, expense: 120, cups: 125 },
  B2: { revenue: 4150, cash: 2300, scan: 1850, expense: 120, cups: 68 },
};
const SHARE = { B1: { blessme: 0.6, ming: 0.4 }, B2: { blessme: 0.7, ming: 0.3 } };
const MAY = 5;

// Contracted monthly fixed costs (CLAUDE.md). B2 rent is ฿30,000 outside the Jul-Sep discount.
const CONTRACTED = {
  B1: { rent: 35000, salary: 35000, utilities: 4000 },
  B2: { rent: 30000, salary: 30000, utilities: 4000 },
};
// Shared stock-storage rent. B3 did not exist in May, so ฿12,000 splits two ways, not three.
const STOCK_RENT_TOTAL = 12000;
const f = (n) => Math.round(n).toLocaleString('en-US');
const signed = (n) => (n >= 0 ? '+' : '') + f(n);

// --- Target: solve the two-equation system implied by the booked split ---
// blessme = 0.6*B1 + 0.7*B2 ; ming = 0.4*B1 + 0.3*B2
function solveTargets({ blessme, ming }) {
  const total = blessme + ming;
  const b2 = (blessme - SHARE.B1.blessme * total) / (SHARE.B2.blessme - SHARE.B1.blessme);
  return { B1: total - b2, B2: b2, total };
}
const target = solveTargets(BOOKED);

// --- Actual: pull May from the ledger ---
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const load = (branch) => {
  const wb = XLSX.readFile(path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`));
  const days = dailyRows(wb.Sheets['May26']);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Daily_Expenses'], { header: 1 })
    .slice(3)
    .filter((r) => { const d = parseDate(r[0]); return d && d.month === MAY; })
    .map((r) => ({ bucket: r[2], category: r[3], desc: String(r[4] ?? ''), amount: Number(r[5]) || 0 }));
  return { days, rows, revenue: days.reduce((a, r) => a + r.revenue, 0) };
};
const B1 = load('B1');
const B2 = load('B2');
const groupRevenue = B1.revenue + B2.revenue;
const recorded = [...B1.rows, ...B2.rows].reduce((a, r) => a + r.amount, 0);

console.log('=== MAY 2026 ===\n');
console.log(`Revenue    B1 ${f(B1.revenue).padStart(9)}   B2 ${f(B2.revenue).padStart(9)}   group ${f(groupRevenue)}`);
console.log(`Days       B1 ${String(B1.days.length).padStart(9)}   B2 ${String(B2.days.length).padStart(9)}   (May has 31 — 21 May is missing from both)`);
console.log(`Recorded expenses (group): ${f(recorded)}`);
console.log(`\nLedger profit  : ${f(groupRevenue - recorded)}`);
console.log(`Owner booked   : ${f(target.total)}   (Blessme ${f(BOOKED.blessme)} + Ming ${f(BOOKED.ming)})`);
console.log(`GAP            : ${f(groupRevenue - recorded - target.total)}  <- cost the ledger is missing\n`);
console.log(`Booked split implies:  B1 profit ${f(target.B1)}   B2 profit ${f(target.B2)}`);

// --- Identify the missing fixed costs ---
const sumWhere = (rows, pred) => rows.filter(pred).reduce((a, r) => a + r.amount, 0);
const isSalary = (r) => r.category === 'Salary';
const isRental = (r) => r.category === 'Rental';
const isUtility = (r) => /utilit|ค่าไฟ|ค่าน้ำ|electric|water/i.test(r.category + r.desc);

console.log(`\n=== Fixed costs: contracted vs recorded ===\n`);
console.log('Branch Item        Contracted   Recorded    Missing');
console.log('------ ----------- ----------- ---------- ----------');
const missing = [];
for (const [name, src] of [['B1', B1], ['B2', B2]]) {
  const c = CONTRACTED[name];
  // B1's Rental line bundles shop rent and the shared stock-storage rent.
  const rentRecorded = sumWhere(src.rows, isRental);
  const stockShare = STOCK_RENT_TOTAL / 2; // B3 not open in May
  const rentExpected = c.rent + stockShare;
  const items = [
    ['rent+stock', rentExpected, rentRecorded],
    ['salary', c.salary, sumWhere(src.rows, isSalary)],
    ['utilities', c.utilities, sumWhere(src.rows, isUtility)],
  ];
  for (const [label, exp, got] of items) {
    const miss = Math.max(0, exp - got);
    if (miss) missing.push({ branch: name, label, miss });
    console.log(`${name}     ${label.padEnd(11)} ${f(exp).padStart(11)} ${f(got).padStart(10)} ${f(miss).padStart(10)}`);
  }
}
const missingTotal = missing.reduce((a, m) => a + m.miss, 0);
console.log(`\nMissing fixed costs identified: ${f(missingTotal)}`);

const residual = groupRevenue - recorded - target.total - missingTotal;
console.log(`Residual still unexplained    : ${f(residual)}`);

// --- Miscategorised fruit sitting in OPEX/Other ---
// These read as fruit purchases (ลูก = pieces, ยอด = amount) but are booked as OPEX.
const fruitInOpex = B1.rows.filter((r) => r.category === 'Other' && /ลูก|เบอร์|ยอด/.test(r.desc));
console.log(`\n=== Miscategorised: fruit purchases booked as OPEX/Other (B1) ===\n`);
for (const r of fruitInOpex) console.log(`  ${r.desc.slice(0, 46).padEnd(48)} ${f(r.amount).padStart(8)}`);
console.log(`  ${'TOTAL'.padEnd(48)} ${f(fruitInOpex.reduce((a, r) => a + r.amount, 0)).padStart(8)}`);
console.log(`  Does not change profit, but it inflates OPEX and understates COGS.`);

// --- What each branch needs to hit the booked target ---
console.log(`\n=== To reach the booked figures ===\n`);
console.log('Branch  Revenue   Cost needed   Currently   Shortfall   Target profit');
console.log('------ --------- ------------- ----------- ----------- -------------');
for (const [name, src, tgt] of [['B1', B1, target.B1], ['B2', B2, target.B2]]) {
  const need = src.revenue - tgt;
  const got = src.rows.reduce((a, r) => a + r.amount, 0);
  console.log(
    `${name}     ${f(src.revenue).padStart(9)} ${f(need).padStart(13)} ${f(got).padStart(11)} ` +
    `${signed(need - got).padStart(11)} ${f(tgt).padStart(13)}`
  );
}
console.log(`\nNote: B1 currently carries the whole group's COGS, so its per-branch shortfall`);
console.log(`is negative (over-costed) while B2's is large. Allocation per ADR 0001 moves`);
console.log(`cost from B1 to B2; it does not change the group total.`);

// --- Waterfall: apply every confirmed correction and see where profit lands ---
console.log(`\n\n=== Waterfall to the booked target ===\n`);
let rev = groupRevenue;
let cost = recorded;
const step = (label, dRev, dCost) => {
  rev += dRev; cost += dCost;
  console.log(
    `${label.padEnd(38)} ${(dRev ? signed(dRev) : '').padStart(9)} ${(dCost ? signed(dCost) : '').padStart(9)}` +
    ` -> profit ${f(rev - cost).padStart(9)}`
  );
};
console.log('Adjustment                              Revenue      Cost');
console.log('-------------------------------------- --------- ---------');
console.log(`${'starting position'.padEnd(38)} ${''.padStart(9)} ${''.padStart(9)} -> profit ${f(rev - cost).padStart(9)}`);

for (const [name, src] of [['B1', B1], ['B2', B2]]) {
  const got = sumWhere(src.rows, isSalary);
  step(`${name} payroll -> confirmed ${f(CONFIRMED_SALARY[name])}`, 0, CONFIRMED_SALARY[name] - got);
}
for (const [name, d] of Object.entries(DAY_21)) {
  const present = (name === 'B1' ? B1 : B2).days.some((r) => r.date.day === 21);
  if (present) { console.log(`${(name + ' 21 May').padEnd(38)} ${'already in ledger'.padStart(19)}`); continue; }
  step(`${name} 21 May sales (was missing)`, d.revenue, d.expense);
}
// B2's share of the ฿12,000 stock-storage rent and its utilities were never booked.
step('B2 stock-storage rent share', 0, 6000);
step('B2 utilities', 0, 4000);

const finalProfit = rev - cost;
console.log(`\nAfter all confirmed corrections : ${f(finalProfit)}`);
console.log(`Owner booked                    : ${f(target.total)}`);
console.log(`STILL UNEXPLAINED               : ${f(finalProfit - target.total)}`);
console.log(`  ( ${((finalProfit - target.total) / rev * 100).toFixed(1)}% of revenue — most likely unentered COGS slips )`);

(function selfCheck() {
  const assert = require('assert');
  // The solver must reproduce the booked split exactly.
  const t = solveTargets(BOOKED);
  assert.strictEqual(Math.round(SHARE.B1.blessme * t.B1 + SHARE.B2.blessme * t.B2), BOOKED.blessme);
  assert.strictEqual(Math.round(SHARE.B1.ming * t.B1 + SHARE.B2.ming * t.B2), BOOKED.ming);
  // A pure-B1 book must solve to zero B2 profit.
  const pure = solveTargets({ blessme: 600, ming: 400 });
  assert.ok(Math.abs(pure.B2) < 1e-6 && Math.abs(pure.B1 - 1000) < 1e-6, '60/40 alone implies B1 only');
  assert.ok(B1.revenue > 0 && B2.revenue > 0, 'both branches must have May revenue');
})();
