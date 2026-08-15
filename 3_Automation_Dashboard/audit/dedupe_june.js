// Remove duplicated June rows, confirmed against the bank statements.
// Each of these appears twice in the ledger with an identical date, category, amount and
// description, while the bank shows only ONE payment of that amount on that day.
//
// Deliberately NOT removed — the bank shows genuine repeat payments, so both rows are real:
//   ฿700 pineapple on 22/06 (bank has three ฿700 payments that day)
//   ฿1,210 Shopee on 21/06 (bank has two)
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const BRANCH = 'B1';
const [DATE, , , CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// date, category, amount, and how many rows should survive (bank payment count for that day).
const KEEP_ONE = [
  { date: '17/06/2026', category: 'Orange',        amount: 16445 },
  { date: '19/06/2026', category: 'Coconut Water', amount: 5700 },
  { date: '18/06/2026', category: 'Coconut Water', amount: 3400 },
  { date: '18/06/2026', category: 'Mango',         amount: 1300 },
  { date: '18/06/2026', category: 'Guava',         amount: 800 },
  { date: '19/06/2026', category: 'Packaging',     amount: 149 },
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const file = path.join(DASH, `SomSaiJai_Dashboard_${BRANCH}_2026.xlsx`);
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const matches = (row, d) => String(row[DATE] ?? '').trim() === d.date
  && String(row[CATEGORY] ?? '') === d.category
  && Math.round(Number(row[AMOUNT]) || 0) === d.amount;

// Keep the first occurrence of each, drop the rest.
const kept = new Map();
const removed = [];
const next = rows.filter((row) => {
  const d = KEEP_ONE.find((x) => matches(row, x));
  if (!d) return true;
  const k = `${d.date}|${d.category}|${d.amount}`;
  if (!kept.has(k)) { kept.set(k, true); return true; }
  removed.push({ ...d, desc: String(row[DESC] ?? '') });
  return false;
});

if (APPLY && removed.length) {
  const backup = file.replace(/\.xlsx$/, '.bak-predejune.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
console.log('Date        Category        Amount  Description');
console.log('----------- --------------- ------- -----------------------------------');
for (const r of removed) {
  console.log(`${r.date}  ${r.category.padEnd(15)} ${f(r.amount).padStart(6)}  ${r.desc.slice(0, 35)}`);
}
console.log(`\nRemoved ${removed.length} duplicate rows, ${f(removed.reduce((a, r) => a + r.amount, 0))} of phantom cost.`);

if (removed.length !== KEEP_ONE.length) {
  console.error(`\nWARNING: expected ${KEEP_ONE.length} duplicates, removed ${removed.length}.`);
  console.error('Already applied, or a row changed. Nothing was skipped silently.');
  process.exitCode = 1;
}

(function selfCheck() {
  const assert = require('assert');
  // Exactly one of each must survive.
  for (const d of KEEP_ONE) {
    const survivors = next.filter((row) => matches(row, d)).length;
    assert.strictEqual(survivors, 1, `exactly one ${d.category} ${d.amount} on ${d.date} must remain`);
  }
  assert.strictEqual(rows.length - next.length, removed.length, 'row count must drop by exactly the removals');
})();
