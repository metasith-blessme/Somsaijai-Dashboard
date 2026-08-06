// Split the shared ฿12,000 stock-storage rent across branches.
// Owner confirmed 2026-08-06: ฿35,000 shop rental + ฿12,000 stock, and the stock splits
// B1 ฿6,000 / B2 ฿6,000 while only two branches trade. July already splits 4/4/4 with B3.
//
// The engine does NOT allocate Rental — it stays with whichever branch the row is booked to
// (business_rules.js: `if (e.cat === 'Rental') branchCalcs[e.branch].rental += e.amt`).
// So an unsplit row silently loads the whole cost onto B1 and flatters B2's profit.
//
// Dry run by default. Pass --apply to write; each workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const HEADER_ROWS = 3;
const [DATE, , , CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];
const STOCK_SHARE = 6000;

// May's row bundles shop rent and stock into one ฿47,000 line; restate it to rent + B1 share.
const SPLIT = [
  { branch: 'B1', date: '14/05/2026', match: 'ค่าเช่า+สต๊อกร้าน 1', from: 47000, to: 35000 + STOCK_SHARE },
];

// Stock-share rows that are simply absent. Verified against the ฿47,000 paid to the landlord
// on 10/04, 14/05 and 08/06 — each is ฿35,000 rent + ฿12,000 stock.
const ADD = [
  { branch: 'B1', date: '30/04/2026', month: 'Apr26', desc: 'ค่าเช่า stock เม.ย. (B1 ครึ่งหนึ่ง)', amount: STOCK_SHARE },
  { branch: 'B2', date: '30/04/2026', month: 'Apr26', desc: 'ค่าเช่า stock เม.ย. (B2 ครึ่งหนึ่ง)', amount: STOCK_SHARE },
  { branch: 'B2', date: '14/05/2026', month: 'May26', desc: 'ค่าเช่า stock พ.ค. (B2 ครึ่งหนึ่ง)', amount: STOCK_SHARE },
];

// June needs no new row: it already carries B1 COGS/Stock ฿12,000 "Stock June 2026 (split from
// rent slip)" plus B2 Rental ฿6,000, which is ฿18,000 for a ฿12,000 cost. The B1 line is
// restated to ฿6,000 so the two halves sum correctly.
const RESTATE_JUN = [
  { branch: 'B1', date: '08/06/2026', match: 'Stock June 2026', from: 12000, to: STOCK_SHARE },
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const done = [];

for (const branch of [...new Set([...SPLIT, ...ADD].map((r) => r.branch))]) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) { console.error(`missing ${file}`); continue; }
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });
  let touched = false;

  const next = rows.map((row) => {
    const hit = [...SPLIT, ...RESTATE_JUN].find((s) => s.branch === branch &&
      String(row[DATE] ?? '').trim() === s.date &&
      String(row[DESC] ?? '').includes(s.match) &&
      Math.round(Number(row[AMOUNT]) || 0) === s.from);
    if (!hit) return row;
    const updated = [...row];
    updated[AMOUNT] = hit.to;
    updated[DESC] = hit.from === 12000
      ? `Stock June 2026 (B1 ครึ่งหนึ่ง ${f(STOCK_SHARE)}; B2 ถืออีก ${f(STOCK_SHARE)})`
      : `ค่าเช่าร้าน 1 35,000 + stock ${f(STOCK_SHARE)} (แยกส่วน B2 แล้ว)`;
    done.push({ kind: 'split', branch, date: hit.date, from: hit.from, to: hit.to });
    touched = true;
    return updated;
  });

  // Idempotent: never add the same stock-share row twice.
  const seen = new Set(rows.slice(HEADER_ROWS).filter((r) => r[DATE])
    .map((r) => `${r[DATE]}|${r[CATEGORY]}|${Math.round(Number(r[AMOUNT]) || 0)}`));
  for (const a of ADD.filter((x) => x.branch === branch)) {
    if (seen.has(`${a.date}|Rental|${a.amount}`)) continue;
    next.push([a.date, a.month, 'OPEX', 'Rental', a.desc, a.amount]);
    done.push({ kind: 'add', ...a });
    touched = true;
  }

  if (APPLY && touched) {
    const backup = file.replace(/\.xlsx$/, '.bak-prestockrent.xlsx');
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
    wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
    XLSX.writeFile(wb, file);
    console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
  }
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
for (const d of done) {
  if (d.kind === 'split') console.log(`${d.branch} ${d.date}  split ${f(d.from)} -> ${f(d.to)}  (B2 takes ${f(STOCK_SHARE)})`);
  else console.log(`${d.branch} ${d.date}  add    ${f(d.amount).padStart(7)}  ${d.desc}`);
}
if (!done.length) console.log('Nothing to do — already applied.');

const groupDelta = ADD.reduce((a, r) => a + r.amount, 0)
  - SPLIT.reduce((a, s) => a + (s.from - s.to), 0)
  - RESTATE_JUN.reduce((a, s) => a + (s.from - s.to), 0);
console.log(`\nGroup cost change: ${f(groupDelta)} (April +12,000 never booked, June -6,000 double-booked).`);
console.log(`May is a pure reallocation: B1 down 6,000, B2 up 6,000, group unchanged.`);

(function selfCheck() {
  const assert = require('assert');
  assert.strictEqual(SPLIT[0].from - SPLIT[0].to, STOCK_SHARE, 'the split must move exactly B2 share');
  // Every month that pays the landlord 47,000 must end with 12,000 of stock booked in total.
  const perMonth = {};
  for (const a of ADD) perMonth[a.month] = (perMonth[a.month] || 0) + a.amount;
  assert.strictEqual(perMonth.Apr26, 12000, 'April must gain the full 12,000');
  assert.strictEqual((perMonth.May26 || 0) + SPLIT[0].to - 35000, 12000, 'May must total 12,000 of stock');
  assert.strictEqual(RESTATE_JUN[0].to + 6000, 12000, 'June must total 12,000 across B1 and B2');
  assert.ok(!perMonth.Jun26, 'June must not gain a new row — it already had both halves');
})();
