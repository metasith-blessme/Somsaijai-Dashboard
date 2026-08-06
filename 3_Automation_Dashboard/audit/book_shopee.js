// Book Shopee purchases that never reached the ledger.
// Owner confirmed 2026-08-06: the purchasing team buys supplies on Shopee and he transfers to
// Shopee, so every Shopee outflow is a business cost.
//
// Rows are generated from the bank statement rather than hand-typed, and matched by per-day
// occurrence count — Shopee amounts repeat, and nearest-date matching pairs the wrong two.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { parse } = require('./parse_bank');
const { parseDate } = require('./sheet_rows');

const APPLY = process.argv.includes('--apply');
const BANK_DIR = process.env.BANK_DIR;
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const HEADER_ROWS = 3;
const DAY_WINDOW = 3;
// Shared purchases are booked against B1 and allocated out per ADR 0001.
const BRANCH = 'B1';
// 40 of the 60 already-booked Shopee payments sit in COGS/Packaging; it is the honest default.
const CATEGORY = { bucket: 'COGS', category: 'Packaging' };
const MONTH_ABBR = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATEMENTS = [
  ['STM_SA8285_01JAN26_30JUN26.txt', 'SA8285'],
  ['STM_SA5601_01MAR26_31JUL26.txt', 'SA5601'],
];

const f = (n) => Math.round(n).toLocaleString('en-US');

if (!BANK_DIR || !fs.existsSync(BANK_DIR)) {
  console.error('Set BANK_DIR to the directory holding the extracted statement .txt files.');
  process.exit(2);
}

const shopee = STATEMENTS
  .filter(([file]) => fs.existsSync(path.join(BANK_DIR, file)))
  .flatMap(([file, label]) => parse(path.join(BANK_DIR, file), label).txns)
  .filter((t) => t.direction === 'out' && /ช้อปปี้|Shopee|SHOPEE/i.test(t.text))
  .map((t) => ({ ...t, day: Number(t.date.slice(0, 2)), month: Number(t.date.slice(3, 5)) }));

// Every ledger row, across all branches — a Shopee payment may already be booked anywhere.
const ledger = [];
for (const branch of ['B1', 'B2', 'B3']) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) continue;
  const wb = XLSX.readFile(file);
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 }).slice(HEADER_ROWS)) {
    const d = parseDate(r[0]);
    const amount = Math.round(Number(r[5]) || 0);
    if (!d || !amount) continue;
    ledger.push({ day: d.day, month: d.month, amount, used: false });
  }
}

// Claim one ledger row per payment; whatever is left is genuinely unbooked.
const unbooked = [];
for (const t of shopee) {
  const amount = Math.round(t.amount);
  const i = ledger.findIndex((l) => !l.used && l.month === t.month && l.amount === amount
    && Math.abs(l.day - t.day) <= DAY_WINDOW);
  if (i >= 0) ledger[i].used = true;
  else unbooked.push(t);
}

const rows = unbooked.map((t) => [
  t.date,
  `${MONTH_ABBR[t.month]}26`,
  CATEGORY.bucket,
  CATEGORY.category,
  `Shopee (ทีมจัดซื้อ) [bank ${t.account}]`,
  Math.round(t.amount),
]);

if (APPLY && rows.length) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${BRANCH}_2026.xlsx`);
  const wb = XLSX.readFile(file);
  const backup = file.replace(/\.xlsx$/, '.bak-preshopee.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  const existing = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet([...existing, ...rows]);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
console.log(`Shopee payments in the statements : ${shopee.length}  ${f(shopee.reduce((a, t) => a + t.amount, 0))}`);
console.log(`Already in the ledger             : ${shopee.length - unbooked.length}`);
console.log(`Booking now                       : ${unbooked.length}  ${f(unbooked.reduce((a, t) => a + t.amount, 0))}\n`);

const byMonth = {};
for (const t of unbooked) byMonth[`${MONTH_ABBR[t.month]}26`] = (byMonth[`${MONTH_ABBR[t.month]}26`] || 0) + t.amount;
console.log('Month   Added cost');
console.log('------ -----------');
for (const [m, v] of Object.entries(byMonth)) console.log(`${m}  ${f(v).padStart(10)}`);
console.log('\nProfit falls by these amounts in each month — and the profit share already paid');
console.log('on April was calculated before them.');

(function selfCheck() {
  const assert = require('assert');
  assert.ok(shopee.length > 0, 'must find Shopee payments');
  // A ledger row may never be claimed by two payments.
  assert.strictEqual(ledger.filter((l) => l.used).length, shopee.length - unbooked.length,
    'claimed ledger rows must equal matched payments');
  assert.ok(rows.every((r) => r[5] > 0), 'no zero-amount rows');
  assert.ok(rows.every((r) => /^\d{2}\/\d{2}\/\d{4}$/.test(r[0])), 'dates must be DD/MM/YYYY');
})();
