// One-shot repair: the COGS/Ice category in B1 Daily_Expenses was a dumping ground.
// All 23 rows audited against the owner's monthly cost reports (B1/2_Expenses/*/cost_*.md);
// none of them are ice. Real ice is recorded per-day in the sales sheets' Expenses column.
//
// Rows are matched on (date, amount, description), never on a row offset — the three
// monthly sheet layouts don't share one. Re-running after a successful pass is a no-op.
//
// Run: node fix_ice_categories.js [--dry]
const XLSX = require('xlsx');
const path = require('path');

const FILE = path.join(__dirname, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const SHEET = 'Daily_Expenses';
const COL = { date: 0, month: 1, bucket: 2, cat: 3, desc: 4, amt: 5 };
const DRY_RUN = process.argv.includes('--dry');

// date | amount | bucket | category  — desc is rewritten only where it was "Unknown".
const FIXES = [
    ['09/01/2026', 500, 'COGS', 'Transportation'],
    ['17/01/2026', 60, 'COGS', 'Other'],
    ['08/02/2026', 798, 'COGS', 'Other'],
    ['10/02/2026', 389, 'OPEX', 'Utilities'],
    ['14/02/2026', 350, 'COGS', 'Other'],
    ['05/03/2026', 105, 'COGS', 'Transportation'],
    ['15/03/2026', 115, 'COGS', 'Transportation'],
    ['17/03/2026', 2779.47, 'OPEX', 'Utilities'],
    ['21/03/2026', 117, 'OPEX', 'Other'],
    ['24/03/2026', 1752, 'CAPEX', 'Investment'],
    // Owner's Mar26 cost report: "ส้ม ... (23,202) + เพิ่มเติม (49,560) = 72,762".
    ['02/04/2026', 49560, 'COGS', 'Orange', 'ส้มเพิ่มเติม มี.ค. (ตามรายงานต้นทุน Mar26: 23,202 + 49,560 = 72,762)'],
    ['04/04/2026', 1700, 'COGS', 'Coconut'],
    ['04/04/2026', 3200, 'COGS', 'Watermelon'],
    ['10/04/2026', 180, 'COGS', 'Milk/Conden'],
    ['11/04/2026', 1700, 'COGS', 'Coconut'],
    ['23/04/2026', 2900, 'COGS', 'Coconut'],
    ['27/04/2026', 4000, 'COGS', 'Watermelon'],
    ['30/04/2026', 1500, 'COGS', 'Pineapple'],
    ['02/05/2026', 706, 'OPEX', 'Other'],
    ['02/05/2026', 13, 'OPEX', 'Other'],
    ['16/05/2026', 4290, 'OPEX', 'Other'],
    ['15/06/2026', 18, 'COGS', 'Other']
];

// "ผ้าปิดร้าน 218 ค่ารถ 198" is one receipt covering two buckets. The row keeps the
// shop-cover part; the transport part is appended as its own row.
const SPLIT = {
    date: '20/02/2026',
    amt: 416,
    keep: { bucket: 'OPEX', cat: 'Other', desc: 'ผ้าปิดร้าน', amt: 218 },
    append: { month: 'Feb26', bucket: 'COGS', cat: 'Transportation', desc: 'ค่ารถ (แยกจากใบเสร็จผ้าปิดร้าน 416)', amt: 198 }
};

const wb = XLSX.readFile(FILE);
const ws = wb.Sheets[SHEET];
if (!ws) throw new Error(`${SHEET} sheet not found in ${FILE}`);

const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

/** Row indices still sitting in the Ice category that match this date+amount. */
function findIceRows(date, amt) {
    const hits = [];
    grid.forEach((r, i) => {
        if (!r || r[COL.cat] !== 'Ice') return;
        if (String(r[COL.date]) === date && near(r[COL.amt], amt)) hits.push(i);
    });
    return hits;
}

const applied = [];
const skipped = [];

FIXES.forEach(([date, amt, bucket, cat, desc]) => {
    const hits = findIceRows(date, amt);
    if (hits.length === 0) { skipped.push(`${date} ฿${amt} — no Ice row matched (already fixed?)`); return; }
    if (hits.length > 1) { skipped.push(`${date} ฿${amt} — ${hits.length} Ice rows matched, refusing to guess`); return; }
    const i = hits[0];
    const before = `${grid[i][COL.bucket]}/${grid[i][COL.cat]}`;
    grid[i][COL.bucket] = bucket;
    grid[i][COL.cat] = cat;
    if (desc) grid[i][COL.desc] = desc;
    applied.push(`${date} ฿${Number(amt).toLocaleString()}  ${before} → ${bucket}/${cat}`);
});

const splitHits = findIceRows(SPLIT.date, SPLIT.amt);
if (splitHits.length === 1) {
    const i = splitHits[0];
    grid[i][COL.bucket] = SPLIT.keep.bucket;
    grid[i][COL.cat] = SPLIT.keep.cat;
    grid[i][COL.desc] = SPLIT.keep.desc;
    grid[i][COL.amt] = SPLIT.keep.amt;
    const row = [];
    row[COL.date] = SPLIT.date;
    row[COL.month] = SPLIT.append.month;
    row[COL.bucket] = SPLIT.append.bucket;
    row[COL.cat] = SPLIT.append.cat;
    row[COL.desc] = SPLIT.append.desc;
    row[COL.amt] = SPLIT.append.amt;
    grid.push(row);
    applied.push(`${SPLIT.date} ฿416  COGS/Ice → split: OPEX/Other ฿218 + COGS/Transportation ฿198`);
} else {
    skipped.push(`${SPLIT.date} ฿${SPLIT.amt} split — ${splitHits.length} Ice rows matched (already fixed?)`);
}

console.log(`\nApplied ${applied.length}:`);
applied.forEach(l => console.log('  ' + l));
if (skipped.length) {
    console.log(`\nSkipped ${skipped.length}:`);
    skipped.forEach(l => console.log('  ' + l));
}

const remaining = grid.filter(r => r && r[COL.cat] === 'Ice');
console.log(`\nIce rows remaining: ${remaining.length}`);
remaining.forEach(r => console.log(`  ${r[COL.date]} ฿${r[COL.amt]} ${r[COL.desc]}`));

// The amount column must be untouched overall — a recategorisation may never move money.
const total = grid.reduce((s, r) => s + (r && Number(r[COL.amt]) || 0), 0);
console.log(`\nLedger total: ฿${total.toLocaleString()}`);

if (DRY_RUN) { console.log('\n--dry: nothing written.'); process.exit(0); }

const next = XLSX.utils.aoa_to_sheet(grid);
wb.Sheets[SHEET] = next;
XLSX.writeFile(wb, FILE);
console.log(`\n✅ Wrote ${SHEET} back to ${path.basename(FILE)}`);
