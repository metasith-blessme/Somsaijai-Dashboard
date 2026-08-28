// Remove double-booked expense rows and fix one month attribution.
// Every deletion below was verified against the K PLUS statements: the ledger held N rows
// where the bank shows only ONE payment. Candidates where the bank showed two real
// payments (23/01 & 26/01 Lalamove ฿400, 05/03 ฿7,312 to two different payees, 22/06
// ฿700, 21/06 Shopee ฿1,210) are legitimate and deliberately left alone.
//
//   rows 48-50  Jan26 — rows 45-47 pasted a second time (486 / 400 / 4,000)
//   row  86     Feb26 — "ค่าส่งส้ม" ฿2,237 entered twice, one bank payment
//   row  462    Jul26 — "audit fix - missing entry" re-added ฿2,000 that row 350 had
//   rows 181-2  Apr26 — "Employee 1" ฿19,000 + "Employee 2" ฿12,000 = the ฿31,000
//                       payroll transfer already booked from the bank slip (row 416).
//                       Keeping the [bank] row: it is the one tied to a statement line.
//   row  467    Apr26 -> Mar26 — the row says "เงินเดือนพนักงาน 3 คน มี.ค. 26"; it is
//                       March payroll settled on 01/04 and belongs to March.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, , CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// Delete the LAST matching row for each spec, so the original entry survives.
const DELETE = [
  { date: '28/01/2026', cat: 'Transportation', amt: 486,   why: 'ซ้ำกับ row 45' },
  { date: '28/01/2026', cat: 'Transportation', amt: 400,   why: 'ซ้ำกับ row 46' },
  { date: '28/01/2026', cat: 'Watermelon',     amt: 4000,  why: 'ซ้ำกับ row 47' },
  { date: '28/02/2026', cat: 'Orange',         amt: 2237,  why: 'ค่าส่งส้ม ลงสองครั้ง' },
  { date: '31/07/2026', cat: 'Other',          amt: 2000,  why: 'audit fix เติมทับของเดิม' },
];

// Split duplicates: the parts exist ONCE each, so DELETE's "needs 2+ rows" guard cannot
// see them. Guard instead on the sibling [bank] row still being present and the parts
// summing to it — if a rerun already removed them, the sum no longer matches and we skip.
const DELETE_SPLIT = [
  { date: '30/04/2026', cat: 'Salary', keep: 31000,
    parts: [19000, 12000], why: 'รวมอยู่ใน 31,000 [bank] แล้ว' },
];

const REMONTH = [
  { date: '01/04/2026', cat: 'Salary', amt: 24600, from: 'Apr26', to: 'Mar26' },
];

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets[SHEET], { header: 1 });

const match = (r, s) =>
  String(r[DATE] ?? '').trim() === s.date &&
  String(r[CATEGORY] ?? '').trim() === s.cat &&
  Math.round(Number(r[AMOUNT]) || 0) === s.amt;

const drop = new Set();
const done = [];
for (const s of DELETE) {
  const idxs = rows.map((r, i) => (match(r, s) ? i : -1)).filter((i) => i >= 0 && !drop.has(i));
  if (idxs.length < 2) { done.push({ skip: true, s, n: idxs.length }); continue; }
  const last = idxs[idxs.length - 1];
  drop.add(last);
  done.push({ s, row: last, desc: rows[last][DESC] });
}

for (const s of DELETE_SPLIT) {
  const bankRow = rows.findIndex((r) => match(r, { ...s, amt: s.keep }));
  const partIdx = s.parts.map((amt) =>
    rows.findIndex((r, i) => !drop.has(i) && match(r, { ...s, amt })));
  if (bankRow < 0 || partIdx.some((i) => i < 0)) {
    done.push({ skip: true, s: { ...s, amt: s.parts.join('+') }, n: 0 });
    continue;
  }
  partIdx.forEach((i, k) => {
    drop.add(i);
    done.push({ s: { date: s.date, cat: s.cat, amt: s.parts[k], why: s.why }, row: i, desc: rows[i][DESC] });
  });
}

const next = rows.filter((_, i) => !drop.has(i)).map((r) => {
  const m = REMONTH.find((s) => match(r, s) && String(r[MONTH] ?? '') === s.from);
  if (!m) return r;
  const out = [...r];
  out[MONTH] = m.to;
  done.push({ remonth: true, ...m });
  return out;
});

console.log(APPLY ? 'APPLYING\n' : 'DRY RUN — ใส่ --apply เพื่อเขียนจริง\n');
let sum = 0;
for (const d of done) {
  if (d.skip) { console.log(`  ข้าม  ${d.s.date} ${d.s.cat} ฿${d.s.amt} — เจอ ${d.n} แถว (ต้องมี 2+) — แก้ไปแล้ว?`); continue; }
  if (d.remonth) { console.log(`  ย้าย  ${d.date} ${d.cat} ฿${d.amt.toLocaleString()}  ${d.from} -> ${d.to}`); continue; }
  sum += d.s.amt;
  console.log(`  ลบ    row ${String(d.row).padStart(3)}  ${d.s.date} ${d.s.cat.padEnd(15)} ฿${String(d.s.amt.toLocaleString()).padStart(7)}  (${d.s.why})`);
}
console.log(`\n  ลบออกทั้งหมด ฿${sum.toLocaleString()}`);

if (APPLY && (drop.size || REMONTH.length)) {
  const backup = file.replace(/\.xlsx$/, '.bak-predupes.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  const wb = XLSX.readFile(file);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`\nWROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}
