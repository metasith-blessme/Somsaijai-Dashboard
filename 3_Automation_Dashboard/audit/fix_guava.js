// The 01/05 row of ฿7,823 is a multi-item receipt filed entirely under COGS/Guava, but its own
// description shows only ฿300 of it is guava:
//   ร่ม 1176 · ร่ม 843 · ฝรั่ง 300 · นมข้นจืด 785 · ที่ปั้ม 176   = ฿3,280 itemised
// The remaining ฿4,543 is not described — the description is truncated — so it is parked in
// OPEX/Other flagged for review rather than guessed at.
//
// Confirmation this is right: ประนอม (the guava supplier) was paid ฿4,200 in May. With guava
// on this row reduced to ฿300, May guava becomes ฿4,500 — the ฿4,200 of supplier payments plus
// this ฿300. It reconciles to the bank exactly.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

const TARGET = { date: '01/05/2026', category: 'Guava', amount: 7823 };
const SPLIT = [
  { bucket: 'COGS',  category: 'Guava',       desc: 'ฝรั่ง (แยกจากใบเสร็จรวม 01/05)',              amount: 300 },
  { bucket: 'CAPEX', category: 'Investment',  desc: 'ร่ม 2 คัน (1,176 + 843)',                     amount: 2019 },
  { bucket: 'COGS',  category: 'Milk/Conden', desc: 'นมข้นจืด (แยกจากใบเสร็จรวม 01/05)',           amount: 785 },
  { bucket: 'OPEX',  category: 'Other',       desc: 'ที่ปั๊ม (แยกจากใบเสร็จรวม 01/05)',            amount: 176 },
  { bucket: 'OPEX',  category: 'Other',       desc: 'ยอดคงเหลือใบเสร็จ 01/05 — ไม่ระบุรายการ ต้องตรวจสอบสลิป', amount: 4543 },
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const out = [];
let split = 0;
for (const row of rows) {
  const hit = String(row[DATE] ?? '').trim() === TARGET.date
    && String(row[CATEGORY] ?? '') === TARGET.category
    && Math.round(Number(row[AMOUNT]) || 0) === TARGET.amount;
  if (!hit) { out.push(row); continue; }
  for (const s of SPLIT) out.push([row[DATE], row[MONTH], s.bucket, s.category, s.desc, s.amount]);
  split++;
}

if (APPLY && split) {
  const backup = file.replace(/\.xlsx$/, '.bak-preguava.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(out);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
if (!split) { console.log('Nothing to do — already split.'); }
else {
  console.log('Bucket Category      Amount  Description');
  console.log('------ ------------- ------- --------------------------------------------');
  for (const s of SPLIT) console.log(`${s.bucket.padEnd(6)} ${s.category.padEnd(13)} ${f(s.amount).padStart(6)}  ${s.desc}`);
  console.log(`\nGuava on this row: ${f(TARGET.amount)} -> ${f(SPLIT[0].amount)}`);
}

(function selfCheck() {
  const assert = require('assert');
  const total = SPLIT.reduce((a, s) => a + s.amount, 0);
  assert.strictEqual(total, TARGET.amount, `the split must preserve the receipt total (${total} vs ${TARGET.amount})`);
  assert.ok(SPLIT.every((s) => s.amount > 0), 'no zero-amount fragments');
})();
