// A coconut cup costs four things: เนื้อมะพร้าว, น้ำมะพร้าว, นมข้นหวาน (Goodwill) and
// นมข้นจืด (Falcon). Only the first three were ever counted against it.
//
// Two separate faults:
//   1. Condensed milk was scattered across Packaging and Stock as well as Milk/Conden,
//      usually bundled with ฝา or ถุงขยะ on the same slip. ฿15,533 of it sat outside
//      Milk/Conden, so even the milk total was wrong (฿10,937 booked vs ฿26,470 real).
//   2. business_rules.js maps fruit cost with cat.includes('Coconut'), so Milk/Conden was
//      never charged to Coconut at all — which is why its ROI read 525%.
//
// This script fixes (1). The mapping fix for (2) is in business_rules.js.
// Every split below is taken from the slip's own memo via ocr_bin; the parts always sum
// back to the original amount, so no money is created or destroyed.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// Whole row is condensed milk, just filed under the wrong category.
const RECAT = [
  { month: 'Mar26', date: '30/03/2026', amt: 1720, from: 'Packaging', desc: 'นมข้นจืด 3 ลัง (36 กล่อง)' },
  { month: 'Mar26', date: '30/03/2026', amt: 2016, from: 'Packaging', desc: 'นมข้นหวาน 3 ลัง 24 ถุง' },
  { month: 'Jul26', date: '22/07/2026', amt:  716, from: 'Stock',     desc: 'นมข้นจืด Falcon (LINE_ALBUM_Cost July_260802_77.jpg)' },
];

// Slip covers milk plus something else. Split per the memo.
const SPLIT = [
  { month: 'Apr26', date: '29/04/2026', amt: 3210, from: 'Packaging', parts: [
    { cat: 'Milk/Conden', amt: 2240, desc: 'นมข้นหวาน 2 ลัง 1,602 + นมข้นจืด 1 ลัง 638' },
    { cat: 'Packaging',   amt:  970, desc: 'ถุงขยะ 15 แพค 970' },
  ]},
  { month: 'May26', date: '09/05/2026', amt: 1122, from: 'Milk/Conden', parts: [
    { cat: 'Milk/Conden', amt: 636, desc: 'นมข้นจืด 1 ลัง 636' },
    { cat: 'Other',       amt: 486, desc: 'ลิ้นชักเก็บเงิน 486' },
  ]},
  { month: 'May26', date: '09/05/2026', amt: 4875, from: 'Packaging', parts: [
    { cat: 'Milk/Conden', amt: 4047, desc: 'นมข้น 3 ลัง 2,568 + นมข้นจืด 2 ลัง 1,479' },
    { cat: 'Packaging',   amt:  828, desc: 'ฝา 1 ลัง 828' },
  ]},
  { month: 'Jul26', date: '24/07/2026', amt: 2636, from: 'Stock', parts: [
    { cat: 'Milk/Conden', amt: 2127, desc: 'นมข้นหวาน 1 ลัง 785 + นมข้นจืด 2 ลัง 1,342' },
    { cat: 'Packaging',   amt:  509, desc: 'ฝา 1 ลัง 509' },
  ]},
  { month: 'Jul26', date: '24/07/2026', amt: 3084, from: 'Stock', parts: [
    { cat: 'Milk/Conden', amt: 2582, desc: 'นมข้นหวาน 3 ลัง 2,582' },
    { cat: 'Packaging',   amt:  502, desc: 'ฝา 1 ลัง 502' },
  ]},
  { month: 'Jul26', date: '24/07/2026', amt: 1225, from: 'Stock', parts: [
    { cat: 'Milk/Conden', amt: 751, desc: 'นมข้นจืด 1 ลัง 751' },
    { cat: 'Packaging',   amt: 474, desc: 'ฝา 1 ลัง 474' },
  ]},
];

for (const s of SPLIT) {
  const sum = s.parts.reduce((a, p) => a + p.amt, 0);
  if (sum !== s.amt) throw new Error(`${s.date} ฿${s.amt}: parts sum to ${sum}`);
}

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const hit = (r, s, cat) =>
  String(r[MONTH] ?? '').trim() === s.month &&
  String(r[DATE] ?? '').trim() === s.date &&
  Math.round(Number(r[AMOUNT]) || 0) === s.amt &&
  String(r[CATEGORY] ?? '').trim() === (cat || s.from);

const done = [];
let next = rows.map((r) => {
  const m = RECAT.find((s) => hit(r, s));
  if (!m) return r;
  const out = [...r];
  out[CATEGORY] = 'Milk/Conden'; out[BUCKET] = 'COGS'; out[DESC] = m.desc;
  done.push({ kind: 'recat', ...m });
  return out;
});

for (const s of SPLIT) {
  const i = next.findIndex((r) => hit(r, s));
  if (i < 0) { done.push({ kind: 'skip', ...s }); continue; }
  const base = next[i];
  const made = s.parts.map((p) => {
    const r = [...base];
    r[CATEGORY] = p.cat; r[DESC] = p.desc; r[AMOUNT] = p.amt;
    r[BUCKET] = p.cat === 'Other' ? 'OPEX' : 'COGS';
    return r;
  });
  next = [...next.slice(0, i), ...made, ...next.slice(i + 1)];
  done.push({ kind: 'split', ...s });
}

console.log(APPLY ? 'APPLYING\n' : 'DRY RUN — ใส่ --apply เพื่อเขียนจริง\n');
let moved = 0;
for (const d of done) {
  if (d.kind === 'skip') { console.log(`  ข้าม  ${d.date} ฿${d.amt} ${d.from} — ไม่เจอ (แก้ไปแล้ว?)`); continue; }
  if (d.kind === 'recat') {
    moved += d.amt;
    console.log(`  ย้าย  ${d.date} ฿${String(d.amt.toLocaleString()).padStart(6)}  ${d.from} -> Milk/Conden  ${d.desc}`);
    continue;
  }
  console.log(`  แยก   ${d.date} ฿${d.amt.toLocaleString()} (${d.from}) ->`);
  d.parts.forEach((p) => {
    if (p.cat === 'Milk/Conden') moved += p.amt;
    console.log(`          ${p.cat.padEnd(12)} ฿${String(p.amt.toLocaleString()).padStart(6)}  ${p.desc}`);
  });
}
if (done.length) console.log(`\n  นมข้นที่ย้ายเข้า Milk/Conden รวม ฿${moved.toLocaleString()}`);
else console.log('  ไม่มีอะไรต้องทำ');

if (APPLY && done.some((d) => d.kind !== 'skip')) {
  const backup = file.replace(/\.xlsx$/, '.bak-precoconut.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`\nWROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}
