// Book bank outflows that never reached the ledger, using the categories the owner already
// uses for each payee (derived from 373 previously matched transactions, not guessed).
//
// Costs are booked to the month they BELONG to, not the month the transfer cleared:
// Songkran is mid-April and payroll paid on the 1st settles the prior month. Booking on the
// payment date would understate April profit and overstate May's.
//
// Dry run by default. Pass --apply to write; each workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
// Daily_Expenses columns: Date | Month | Bucket | Category | Description | Amount (฿)
const HEADER_ROWS = 3;

const ROWS = [
  // --- May: genuine May cost, confirmed by the owner ---
  { branch: 'B1', date: '23/05/2026', month: 'May26', bucket: 'COGS', category: 'Mangosteen',
    desc: 'มังคุด (โอน ฐนกร 23/05) [bank]', amount: 28000 },
  { branch: 'B1', date: '01/05/2026', month: 'May26', bucket: 'COGS', category: 'Transportation',
    desc: 'ลาลามูฟ Lalamove [bank]', amount: 2000 },
  { branch: 'B1', date: '07/05/2026', month: 'May26', bucket: 'OPEX', category: 'Other',
    desc: 'บจก. อาร์.เอ็น.คลีน ทำความสะอาด [bank]', amount: 1000 },
  { branch: 'B1', date: '01/05/2026', month: 'May26', bucket: 'COGS', category: 'Mango',
    desc: 'LINE Pay Merchant [bank]', amount: 780 },
  { branch: 'B1', date: '01/05/2026', month: 'May26', bucket: 'COGS', category: 'Pineapple',
    desc: 'น.ส. สุพิชญา [bank]', amount: 684 },
  // ประนอม is paid ฿600 seven times in May (9,11,14,19,22,25,30) but the ledger has only six
  // (11,14,19,22,25,30). The unbooked one is the 9th. Established by counting occurrences per
  // day, not by nearest-date matching — with a recurring identical amount, a greedy matcher
  // pairs the wrong two and reports the wrong date.
  { branch: 'B1', date: '09/05/2026', month: 'May26', bucket: 'COGS', category: 'Guava',
    desc: 'ฝรั่ง 1 ตะกร้า (นาง ประนอม) [bank]', amount: 600 },

  // --- April: paid in May, but the cost belongs to April ---
  { branch: 'B1', date: '30/04/2026', month: 'Apr26', bucket: 'OPEX', category: 'Marketing',
    desc: 'ปืนฉีดน้ำ สงกรานต์ (จ่าย 06/05) [bank]', amount: 24016 },
  { branch: 'B1', date: '30/04/2026', month: 'Apr26', bucket: 'OPEX', category: 'Salary',
    desc: 'เงินเดือน เม.ย. (จ่าย 01/05) [bank]', amount: 31000 },
];

// NOT booked — needs an owner decision first:
//   06/05 ฿45,000 to ฐิติภูมิ "B2 rental fee + deposit". The deposit portion is refundable and
//   belongs on the balance sheet as an asset, not in COGS/OPEX. Booking the whole ฿45,000 as
//   expense would understate profit by whatever the deposit is. Needs the rent/deposit split.

const f = (n) => Math.round(n).toLocaleString('en-US');
const key = (r) => `${r.date}|${r.bucket}|${r.category}|${r.amount}`;

let added = 0, skipped = 0;

for (const branch of [...new Set(ROWS.map((r) => r.branch))]) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); continue; }
  const wb = XLSX.readFile(file);
  const existing = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

  // Idempotent: re-running must not double-book. Match on date+bucket+category+amount.
  const seen = new Set(existing.slice(HEADER_ROWS)
    .filter((r) => r[0])
    .map((r) => `${r[0]}|${r[2]}|${r[3]}|${Math.round(Number(r[5]) || 0)}`));

  const toAdd = ROWS.filter((r) => r.branch === branch && !seen.has(key(r)));
  skipped += ROWS.filter((r) => r.branch === branch).length - toAdd.length;
  if (!toAdd.length) continue;

  // Build a new row set rather than mutating the parsed sheet.
  const next = [
    ...existing,
    ...toAdd.map((r) => [r.date, r.month, r.bucket, r.category, r.desc, r.amount]),
  ];

  if (APPLY) {
    const backup = file.replace(/\.xlsx$/, '.bak-prebookmissing.xlsx');
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
    XLSX.writeFile(wb, file);
    console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
  }
  added += toAdd.length;
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
console.log('Branch Date        Month  Bucket Category        Amount  Description');
console.log('------ ----------- ------ ------ --------------- ------- -------------------------');
for (const r of ROWS) {
  console.log(
    `${r.branch}     ${r.date}  ${r.month}  ${r.bucket.padEnd(6)} ${r.category.padEnd(15)} ` +
    `${f(r.amount).padStart(7)}  ${r.desc.slice(0, 34)}`
  );
}
const byMonth = {};
for (const r of ROWS) byMonth[r.month] = (byMonth[r.month] || 0) + r.amount;
console.log(`\nAdded ${added} rows, skipped ${skipped} already present.`);
for (const [m, v] of Object.entries(byMonth)) console.log(`  ${m}: +${f(v)} cost`);
console.log(`\nApril rises by ${f(byMonth.Apr26 || 0)} — April profit falls by the same amount,`);
console.log(`so the April distribution of ฿95,405 was paid on an overstated profit.`);

(function selfCheck() {
  const assert = require('assert');
  assert.strictEqual(new Set(ROWS.map(key)).size, ROWS.length, 'no duplicate rows in the batch');
  assert.ok(ROWS.every((r) => r.amount > 0), 'every row needs a positive amount');
  // The month label must agree with the date, except where accrual deliberately differs —
  // and in those cases the description must say when it was actually paid.
  const MON = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (const r of ROWS) {
    const expected = MON[Number(r.date.split('/')[1])] + '26';
    if (expected !== r.month) assert.ok(/จ่าย/.test(r.desc), `accrual row ${r.date} must record its payment date`);
  }
})();
