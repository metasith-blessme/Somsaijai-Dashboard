// The manager's ฿19,000 salary is booked for Jan26 (row 53) and May26 (row 254), each matching
// a real bank transfer to their account. March's matching transfer (05/03/2026 ฿19,000) has no
// row — B1's only March Salary line is "ค่าแรงคนงาน Mar26" ฿27,600, confirmed by the owner to be
// a different employee's wages, not the manager's.
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

const ADD = { branch: 'B1', date: '05/03/2026', month: 'Mar26', desc: 'เงินเดือนเมน 3/26', amount: 19000 };

const file = path.join(DASH, `SomSaiJai_Dashboard_${ADD.branch}_2026.xlsx`);
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

// Idempotent: never add the same salary row twice.
const seen = rows.slice(HEADER_ROWS).some((r) => String(r[DATE] ?? '').trim() === ADD.date &&
  r[CATEGORY] === 'Salary' && Math.round(Number(r[AMOUNT]) || 0) === ADD.amount);

if (seen) {
  console.log('Nothing to do — already applied.');
} else if (APPLY) {
  const next = [...rows, [ADD.date, ADD.month, 'OPEX', 'Salary', ADD.desc, ADD.amount]];
  const backup = file.replace(/\.xlsx$/, '.bak-premarchsalary.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)} (backup: ${path.basename(backup)})`);
  console.log(`${ADD.branch} ${ADD.date}  add  ${ADD.amount}  ${ADD.desc}`);
} else {
  console.log('DRY RUN — pass --apply to write');
  console.log(`${ADD.branch} ${ADD.date}  add  ${ADD.amount}  ${ADD.desc}`);
}
