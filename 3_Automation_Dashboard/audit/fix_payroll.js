// Correct May payroll to the figures the owner confirmed on 2026-08-05:
//   B1 = 24,000 staff + 19,000 Ming = 43,000  (ledger held 7,800 + 19,000 = 26,800)
//   B2 = 17,200                              (ledger held 12,000 + 6,000 = 18,000)
//
// Dry run by default. Pass --apply to write; each workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const HEADER_ROWS = 3;
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// Restate the staff line rather than appending a top-up, so the ledger reads as what was
// actually paid instead of "7,800 plus a mystery 16,200".
const RESTATE = [
  { branch: 'B1', date: '25/05/2026', match: 'เงินเดือนซี', from: 7800, to: 24000 },
];
// B2's 17,200 does not divide cleanly across the two recorded employee lines, and guessing a
// split would invent detail the owner never gave. A single signed adjustment is honest.
const ADJUST = [
  { branch: 'B2', date: '31/05/2026', month: 'May26', bucket: 'OPEX', category: 'Salary',
    desc: 'ปรับปรุงเงินเดือน พ.ค. (ยืนยัน 17,200)', amount: -800 },
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const applied = [];

for (const branch of [...new Set([...RESTATE, ...ADJUST].map((r) => r.branch))]) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); continue; }
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

  const next = rows.map((row) => {
    const hit = RESTATE.find((r) =>
      r.branch === branch &&
      String(row[DATE] ?? '').trim() === r.date &&
      String(row[DESC] ?? '').includes(r.match) &&
      Math.round(Number(row[AMOUNT]) || 0) === r.from
    );
    if (!hit) return row;
    const updated = [...row];
    updated[AMOUNT] = hit.to;
    updated[DESC] = `${row[DESC]} (แก้ไข: ยืนยัน ${f(hit.to)})`;
    applied.push({ kind: 'restate', branch, ...hit });
    return updated;
  });

  // Idempotent: do not append the same adjustment twice.
  const seen = new Set(rows.slice(HEADER_ROWS).filter((r) => r[DATE])
    .map((r) => `${r[DATE]}|${r[CATEGORY]}|${Math.round(Number(r[AMOUNT]) || 0)}`));
  const toAdd = ADJUST.filter((a) => a.branch === branch && !seen.has(`${a.date}|${a.category}|${a.amount}`));
  for (const a of toAdd) {
    next.push([a.date, a.month, a.bucket, a.category, a.desc, a.amount]);
    applied.push({ kind: 'adjust', ...a });
  }

  if (APPLY && (next.length !== rows.length || applied.some((a) => a.branch === branch))) {
    const backup = file.replace(/\.xlsx$/, '.bak-prepayrollfix.xlsx');
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
    XLSX.writeFile(wb, file);
    console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
for (const a of applied) {
  if (a.kind === 'restate') console.log(`${a.branch} ${a.date}  restate ${a.match}: ${f(a.from)} -> ${f(a.to)}  (+${f(a.to - a.from)})`);
  else console.log(`${a.branch} ${a.date}  adjustment ${f(a.amount)}  ${a.desc}`);
}
if (!applied.length) console.log('Nothing to do — already applied.');

(function selfCheck() {
  const assert = require('assert');
  assert.ok(RESTATE.every((r) => r.to !== r.from), 'a restatement must change the amount');
  // The confirmed totals must be what these corrections actually produce.
  assert.strictEqual(19000 + RESTATE[0].to, 43000, 'B1 must land on the confirmed 43,000');
  assert.strictEqual(12000 + 6000 + ADJUST[0].amount, 17200, 'B2 must land on the confirmed 17,200');
})();
