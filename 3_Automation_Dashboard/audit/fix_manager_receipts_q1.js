// Books 3 of the 4 manager-account slips from Feb-Apr26 (see FINDINGS.md), now that the owner
// supplied a breakdown for each from their own K PLUS "note" memory:
//   20/02 ฿416  = ฿218 shop cover + ฿198 transport — SKIPPED, already booked as two separate
//                 rows (B1 rows 75 and 454); reconcile_bank.js missed it because it matches one
//                 bank line against one ledger row, not a 1-to-2 split.
//   27/02 ฿5,000  = equipment
//   18/03 ฿230    = milk + condensed milk
//   01/04 ฿24,600 = March salary for 3 employees
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const HEADER_ROWS = 3;
const [DATE, , , CATEGORY, , AMOUNT] = [0, 1, 2, 3, 4, 5];

const ADD = [
  { date: '27/02/2026', month: 'Feb26', category: 'Investment', desc: 'อุปกรณ์ (จากสลิปโอนผู้จัดการ)', amount: 5000 },
  { date: '18/03/2026', month: 'Mar26', category: 'Milk/Conden', desc: 'นม + นมข้นหวาน (จากสลิปโอนผู้จัดการ)', amount: 230 },
  { date: '01/04/2026', month: 'Apr26', category: 'Salary', desc: 'เงินเดือนพนักงาน 3 คน มี.ค. 26', amount: 24600 },
];

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const seen = new Set(rows.slice(HEADER_ROWS).filter((r) => r[DATE])
  .map((r) => `${String(r[DATE]).trim()}|${r[CATEGORY]}|${Math.round(Number(r[AMOUNT]) || 0)}`));

const toAdd = ADD.filter((a) => !seen.has(`${a.date}|${a.category}|${a.amount}`));
const f = (n) => Math.round(n).toLocaleString('en-US');

if (!toAdd.length) {
  console.log('Nothing to do — already applied.');
} else if (APPLY) {
  const next = [...rows, ...toAdd.map((a) => [a.date, a.month, 'OPEX', a.category, a.desc, a.amount])];
  const backup = file.replace(/\.xlsx$/, '.bak-premanagerq1.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)} (backup: ${path.basename(backup)})`);
  for (const a of toAdd) console.log(`B1 ${a.date}  add  ${f(a.amount).padStart(7)}  ${a.category} — ${a.desc}`);
} else {
  console.log('DRY RUN — pass --apply to write');
  for (const a of toAdd) console.log(`B1 ${a.date}  add  ${f(a.amount).padStart(7)}  ${a.category} — ${a.desc}`);
}
