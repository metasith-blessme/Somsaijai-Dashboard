// Unbundle three Mar26 slips that each paid for more than one thing but were filed under
// whichever item the description happened to name first. Found by audit/find_bundled.js,
// splits read from each slip's own memo via ocr_bin, owner-approved 2026-08-28.
//
// Mar26 is the owner's hand-kept month — see SKILL.md. These are category corrections
// only: every split sums back to the original amount, so the month's total is unchanged.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// Whole row was one category all along; "น้ำส้ม" in "แก้วร้านน้ำส้ม" is the shop's name,
// not a purchase of oranges, and it pulled ฿5,667 of cups and lids into orange's cost.
const RECAT = [
  { month: 'Mar26', date: '10/03/2026', amt: 5667, from: 'Orange', to: 'Packaging',
    desc: 'แก้วร้านน้ำส้ม 2 ลัง x1,560 = 3,120 + ฝา 4 ลัง 2,547' },
];

const SPLIT = [
  { month: 'Mar26', date: '15/03/2026', amt: 4800, from: 'Watermelon', parts: [
    { cat: 'Watermelon',    amt: 4000, desc: 'แตงโม เบอร์ 80฿ 50 ลูก = 4,000 (แยกจากสลิปรวม 4,800)' },
    { cat: 'Coconut Meat',  amt:  550, desc: 'เนื้อมะพร้าว 5 โล x110 = 550 (แยกจากสลิปรวม 4,800)' },
    { cat: 'Coconut Water', amt:  250, desc: 'น้ำมะพร้าว 5 ขวด x50 = 250 (แยกจากสลิปรวม 4,800)' },
  ]},
  { month: 'Mar26', date: '30/03/2026', amt: 3500, from: 'Watermelon', parts: [
    { cat: 'Watermelon',   amt: 2400, desc: 'แตงโม 30 ลูก = 2,400 (แยกจากสลิปรวม 3,500)' },
    { cat: 'Coconut Meat', amt: 1100, desc: 'เนื้อมะพร้าว 10 โล = 1,100 (แยกจากสลิปรวม 3,500)' },
  ]},
];

for (const s of SPLIT) {
  const sum = s.parts.reduce((a, p) => a + p.amt, 0);
  if (sum !== s.amt) throw new Error(`${s.date} ฿${s.amt}: parts sum to ${sum}`);
}

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const hit = (r, s) =>
  String(r[MONTH] ?? '').trim() === s.month &&
  String(r[DATE] ?? '').trim() === s.date &&
  Math.round(Number(r[AMOUNT]) || 0) === s.amt &&
  String(r[CATEGORY] ?? '').trim() === s.from;

const done = [];
let next = rows.map((r) => {
  const m = RECAT.find((s) => hit(r, s));
  if (!m) return r;
  const out = [...r];
  out[CATEGORY] = m.to; out[DESC] = m.desc; out[BUCKET] = 'COGS';
  done.push({ kind: 'recat', ...m });
  return out;
});

for (const s of SPLIT) {
  const i = next.findIndex((r) => hit(r, s));
  if (i < 0) { done.push({ kind: 'skip', ...s }); continue; }
  const base = next[i];
  const made = s.parts.map((p) => {
    const r = [...base];
    r[CATEGORY] = p.cat; r[DESC] = p.desc; r[AMOUNT] = p.amt; r[BUCKET] = 'COGS';
    return r;
  });
  next = [...next.slice(0, i), ...made, ...next.slice(i + 1)];
  done.push({ kind: 'split', ...s });
}

console.log(APPLY ? 'APPLYING\n' : 'DRY RUN — ใส่ --apply เพื่อเขียนจริง\n');
for (const d of done) {
  if (d.kind === 'skip') { console.log(`  ข้าม  ${d.date} ฿${d.amt} ${d.from} — ไม่เจอ (แก้ไปแล้ว?)`); continue; }
  if (d.kind === 'recat') {
    console.log(`  ย้าย  ${d.date} ฿${d.amt.toLocaleString()}  ${d.from} -> ${d.to}`);
    console.log(`          ${d.desc}`);
    continue;
  }
  console.log(`  แยก   ${d.date} ฿${d.amt.toLocaleString()} (${d.from}) ->`);
  d.parts.forEach((p) => console.log(`          ${p.cat.padEnd(14)} ฿${String(p.amt.toLocaleString()).padStart(6)}`));
}
if (!done.length) console.log('  ไม่มีอะไรต้องทำ');

if (APPLY && done.some((d) => d.kind !== 'skip')) {
  const backup = file.replace(/\.xlsx$/, '.bak-prebundled.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`\nWROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}
