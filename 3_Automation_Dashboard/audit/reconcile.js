// Reconcile B1 Excel dashboard against the owner's hand-kept Google Sheet (Jan-Mar 26).
// Two independent records of the same days -> any difference is a real error in one of them.
const XLSX = require('xlsx');
const path = require('path');
const { dailyRows } = require('./sheet_rows');

const SRC = require('./gsheet_source.json');
const XL = path.join(__dirname, '..', 'SomSaiJai_Dashboard_B1_2026.xlsx');
const MONTHS = ['Jan26', 'Feb26', 'Mar26'];

const baht = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }));

// Excel daily rows keyed by day-of-month.
function excelDays(sheet) {
  return new Map(dailyRows(sheet).map((r) => [r.date.day, r]));
}

function reconcileMonth(month, sheet) {
  const excel = excelDays(sheet);
  const rows = [];
  for (const [day, gRev, gCash, gScan] of SRC[month]) {
    const e = excel.get(day);
    rows.push({
      day,
      gRev, gCash, gScan,
      eRev: e ? e.revenue : null,
      eCash: e ? e.cash : null,
      eScan: e ? e.scan : null,
      missing: !e,
      revDiff: e ? Math.round(e.revenue - gRev) : null,
      // Excel has no daily scan for Jan/Feb; flag it rather than scoring it as a diff.
      splitMissing: !!e && e.scan === 0 && gScan > 0,
    });
  }
  const orphans = [...excel.keys()].filter((d) => !SRC[month].some((r) => r[0] === d));
  return { rows, orphans };
}

const wb = XLSX.readFile(XL);
let grand = { revDiff: 0, mismatch: 0, missing: 0, splitMissing: 0 };

for (const month of MONTHS) {
  const { rows, orphans } = reconcileMonth(month, wb.Sheets[month]);
  const bad = rows.filter((r) => r.missing || (r.revDiff !== null && r.revDiff !== 0));

  const gRev = rows.reduce((a, r) => a + r.gRev, 0);
  const eRev = rows.reduce((a, r) => a + (r.eRev || 0), 0);
  const stated = SRC._sheet_stated_totals[month].revenue;

  console.log(`\n===== ${month} =====`);
  console.log(`Google Sheet daily sum : ${baht(gRev)}   (sheet's own รวม: ${baht(stated)}${gRev === stated ? ' ✓' : ' ✗ SHEET SELF-INCONSISTENT'})`);
  console.log(`Excel daily sum        : ${baht(eRev)}`);
  console.log(`DIFFERENCE             : ${baht(eRev - gRev)}`);

  const noSplit = rows.filter((r) => r.splitMissing).length;
  if (noSplit) console.log(`Days with no cash/scan split in Excel: ${noSplit} (Google Sheet HAS them — backfillable)`);
  if (orphans.length) console.log(`Excel days not in sheet: ${orphans.join(', ')}`);

  if (bad.length) {
    console.log(`\n  Day | GSheet Rev | Excel Rev  | Diff     | Note`);
    console.log(`  ----+------------+------------+----------+------------------`);
    for (const r of bad) {
      const note = r.missing ? 'MISSING FROM EXCEL' : '';
      console.log(
        `  ${String(r.day).padStart(3)} | ${baht(r.gRev).padStart(10)} | ${baht(r.eRev).padStart(10)} | ` +
        `${baht(r.revDiff).padStart(8)} | ${note}`
      );
    }
  } else {
    console.log('  All days match on revenue.');
  }

  grand.revDiff += eRev - gRev;
  grand.mismatch += bad.filter((r) => !r.missing).length;
  grand.missing += bad.filter((r) => r.missing).length;
  grand.splitMissing += noSplit;
}

console.log(`\n===== TOTAL Jan-Mar =====`);
console.log(`Net revenue difference   : ${baht(grand.revDiff)}`);
console.log(`Days mismatched          : ${grand.mismatch}`);
console.log(`Days missing from Excel  : ${grand.missing}`);
console.log(`Days lacking cash/scan   : ${grand.splitMissing}`);

const d = Object.fromEntries(Object.entries(SRC._distributions).filter(([k]) => !k.startsWith('_')));
const total = Object.values(d).reduce((a, x) => a + x.total, 0);
console.log(`\n===== DISTRIBUTIONS (Dec25-Mar26) =====`);
for (const [m, v] of Object.entries(d)) {
  const net = SRC._sheet_pnl[m].net;
  console.log(`${m}: Blessme ${baht(v.blessme).padStart(9)} + Ming ${baht(v.ming).padStart(9)} = ${baht(v.total).padStart(9)}  (net profit ${baht(net)} -> ${((v.total / net) * 100).toFixed(1)}% paid out)`);
}
console.log(`TOTAL PAID OUT: ${baht(total)}  | TOTAL RETAINED: ${baht(0)}`);

// One runnable check: the reconciler must detect a difference it is shown.
function selfCheck() {
  const assert = require('assert');
  const fake = XLSX.utils.aoa_to_sheet([
    ['t'], [], ['Date', 'Day', 'Revenue', 'Cash', 'Expenses', 'CE', 'Scan'],
    ['1/1/2026', 'Thu', 13690 + 500, 8590, 0, null, 5100],
    ['AVG/DAY', '', 999999],
  ]);
  const { rows } = reconcileMonth('Jan26', fake);
  assert.strictEqual(rows[0].revDiff, 500, 'must detect a seeded 500 difference');
  assert.strictEqual(rows[1].missing, true, 'must flag days absent from Excel');
  assert.ok(!rows.some((r) => r.day > 31), 'AVG/DAY row must never become a day');
}
selfCheck();
