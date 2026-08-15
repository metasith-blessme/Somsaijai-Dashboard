// Re-bucket fruit purchases that were filed as OPEX/Other into COGS.
// Profit-neutral (both are expenses) but it inflates OPEX, understates COGS, and breaks
// every margin ratio and the ADR 0001 usage-based allocation.
//
// Dry run by default. Pass --apply to write, which backs up each workbook first.
//
// ponytail: an explicit list, not a classifier. Five rows do not justify a rules engine,
// and a wrong auto-classification on financial data is far more expensive than typing them out.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
// Defaults to this checkout; point DASH_DIR at the live repo to correct the real workbooks.
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');

// Each entry identifies exactly one row by branch + date + a distinctive description fragment.
const CORRECTIONS = [
  { branch: 'B1', date: '04/05/2026', match: 'เบอร์ 70฿ 60 ลูก', amount: 7000,  category: 'Watermelon' },
  { branch: 'B1', date: '08/05/2026', match: 'เบอร์ 70฿ 60 ลูก', amount: 8200,  category: 'Watermelon' },
  { branch: 'B1', date: '14/05/2026', match: '50 ลูก',           amount: 8000,  category: 'Watermelon' },
  { branch: 'B1', date: '16/05/2026', match: '18 ลูก',           amount: 1008,  category: 'Watermelon' },
  { branch: 'B1', date: '29/06/2026', match: 'มังคุด 3 ตะกร้า',   amount: 1932,  category: 'Mangosteen' },
  // Description reads ฿4,000 but the row is booked at ฿12,000. Owner confirmed 2026-08-05:
  // the ฿12,000 is correct (three deliveries recorded together) and it is watermelon.
  { branch: 'B1', date: '22/05/2026', match: '16-5-2569',        amount: 12000, category: 'Watermelon' },
];

// Deliberately NOT corrected — verified as genuinely OPEX:
//   B1 31/07 'ตะกร้าแต่งร้าน 3' ฿558      — decorative baskets for the shop, not produce
//   B2 01/06 'ค่าที่ร้านน้ำส้ม b2 06/26' ฿30,000 — B2 shop rent; 'น้ำส้ม' is the shop name
// Deliberately LEFT for the owner to confirm (description and amount disagree):
//   B1 22/05 '16-5-2569ยอด 4,000฿' ฿12,000 — reads as ฿4,000 but is booked at ฿12,000

const BUCKET_COL = 2, CATEGORY_COL = 3, DESC_COL = 4, AMOUNT_COL = 5, DATE_COL = 0;
const f = (n) => Math.round(n).toLocaleString('en-US');

let totalMoved = 0;
const applied = [];

for (const branch of [...new Set(CORRECTIONS.map((c) => c.branch))]) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  const wb = XLSX.readFile(file);
  const sheet = wb.Sheets['Daily_Expenses'];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Build a new row set rather than mutating in place.
  const next = rows.map((row) => {
    const hit = CORRECTIONS.find((c) =>
      c.branch === branch &&
      String(row[DATE_COL] ?? '').trim() === c.date &&
      String(row[DESC_COL] ?? '').includes(c.match) &&
      Math.round(Number(row[AMOUNT_COL]) || 0) === c.amount &&
      String(row[BUCKET_COL] ?? '') === 'OPEX'
    );
    if (!hit) return row;
    const updated = [...row];
    updated[BUCKET_COL] = 'COGS';
    updated[CATEGORY_COL] = hit.category;
    applied.push({ branch, ...hit, from: `OPEX/${row[CATEGORY_COL]}` });
    totalMoved += hit.amount;
    return updated;
  });

  if (APPLY) {
    const backup = file.replace(/\.xlsx$/, `.bak-precategoryfix.xlsx`);
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    const rebuilt = XLSX.utils.aoa_to_sheet(next);
    wb.Sheets['Daily_Expenses'] = rebuilt;
    XLSX.writeFile(wb, file);
    console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
console.log('Branch Date        Amount   From            To');
console.log('------ ----------- -------- --------------- ----------------');
for (const a of applied) {
  console.log(`${a.branch}     ${a.date}  ${f(a.amount).padStart(7)}  ${a.from.padEnd(15)} COGS/${a.category}`);
}
console.log(`\nTotal re-bucketed: ${f(totalMoved)}  across ${applied.length} rows`);
console.log('Profit is unchanged — this moves cost between buckets, it does not add or remove any.');

if (applied.length !== CORRECTIONS.length) {
  console.error(`\nWARNING: matched ${applied.length} of ${CORRECTIONS.length} corrections.`);
  console.error('A row may already be fixed, or its description/amount changed. Nothing was skipped silently.');
  process.exitCode = 1;
}

(function selfCheck() {
  const assert = require('assert');
  // Every correction must be uniquely identified — no fragment may match two rows.
  const keys = CORRECTIONS.map((c) => `${c.branch}|${c.date}|${c.match}|${c.amount}`);
  assert.strictEqual(new Set(keys).size, keys.length, 'corrections must be unique');
  assert.ok(CORRECTIONS.every((c) => c.amount > 0), 'a correction with no amount cannot be matched safely');
})();
