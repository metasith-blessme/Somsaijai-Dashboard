// Restore the quantity lines that parseNote used to drop, and split two rows that hold
// two fruits at once.
//
// Every string below is transcribed from the slip's own memo, recovered by re-running
// ocr_bin over B1/2_Expenses/{Feb..Jun}26 — the same 269 images the pipeline already had.
// Amounts are untouched; only descriptions change, plus the two splits which keep their
// combined total.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

// month + date + amount -> the memo as written on the slip. Month is part of the key
// because two ฿7,312 orange rows share the date 05/03 while belonging to Feb26 and Mar26
// (two different payees paid the same amount that day — see find_duplicates.js).
const RESTORE = [
  ['Feb26', '24/02/2026', 10680, 'Orange', 'ส้ม 30 ตะกร้า (660 กก.) 18/2/69'],
  ['Feb26', '05/03/2026',  7312, 'Orange', 'ค่าส้ม 20 ตะกร้า (440 กก.) วันที่ 27/2/69'],
  ['Mar26', '10/03/2026',  9804, 'Orange', 'ส้ม 660 กก. x14 = 9,240 + ค่าส่ง 1,140 - ลบยอดเกิน 576 (09/03/69)'],
  ['Mar26', '02/04/2026', 49560, 'Orange', 'ส้มเพิ่มเติม มี.ค. (สลิปไม่มีบันทึกช่วยจำ - ไม่ทราบจำนวน) [bank 02/04]'],
  ['Apr26', '25/04/2026', 14400, 'Orange', 'ส้ม 20x22กก 440 กก. x30 = 13,200 + ค่าขนส่ง 1,200 (22/04/69)'],
  ['Apr26', '28/04/2026', 21600, 'Orange', 'ส้ม 660 กก. x30 = 19,800 + ค่าส่ง 1,800 (รอบ 27/04/69)'],
  ['May26', '15/05/2026', 15730, 'Orange', 'ส้ม 22x22กก 484 กก. x30 = 14,520 + ค่าส่ง 22x55 = 1,210 (15/05/69)'],
  ['May26', '25/05/2026', 15015, 'Orange', 'ส้ม 21x22กก 462 กก. x30 = 13,860 + ค่าส่ง 21x55 = 1,155 (24/05/69)'],
  ['Jun26', '17/06/2026', 16445, 'Orange', 'ส้ม 23x22กก 506 กก. x30 = 15,180 + ค่าขนส่ง 23x55 = 1,265 (รอบ 09/06/69)'],
  ['Jun26', '29/06/2026', 17815, 'Orange', 'ส้ม 25x22กก 550 กก. x30 = 16,500 + ค่าขนส่ง 25x55 = 1,375 (รอบ 18/06/69)'],
];

// Two slips from นาง ศิริพร (the watermelon supplier, who also sells orange when the main
// supplier runs short) carry both fruits. One row cannot be both, so each is split in two.
// 2026-08-28: the ฿7,700 row was previously moved wholesale to Watermelon on the strength
// of its first line — that was wrong, it is ฿3,500 watermelon and ฿4,200 orange.
const SPLIT = [
  { month: 'Mar26', date: '05/03/2026', amt: 7700, from: 'Watermelon', parts: [
    { cat: 'Watermelon', amt: 3500, desc: 'แตงโม 51 ลูก ยอด 3,500 (แยกจากสลิปรวม 7,700 - นาง ศิริพร)' },
    { cat: 'Orange',     amt: 4200, desc: 'ส้ม 150 กก. ยอด 4,200 (แยกจากสลิปรวม 7,700 - นาง ศิริพร)' },
  ]},
  { month: 'Mar26', date: '23/03/2026', amt: 5890, from: 'Orange', parts: [
    { cat: 'Watermelon', amt: 3440, desc: 'แตงโม 43 ลูก x80 = 3,440 (แยกจากสลิปรวม 5,890 - นาง ศิริพร 22/3)' },
    { cat: 'Orange',     amt: 2450, desc: 'ส้ม 70 กก. x35 = 2,450 (แยกจากสลิปรวม 5,890 - นาง ศิริพร 22/3)' },
  ]},
];

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });

const hit = (r, month, date, amt, cat) =>
  String(r[MONTH] ?? '').trim() === month &&
  String(r[DATE] ?? '').trim() === date &&
  Math.round(Number(r[AMOUNT]) || 0) === amt &&
  String(r[CATEGORY] ?? '').trim() === cat;

const done = [];
let next = rows.map((r) => {
  const m = RESTORE.find(([mo, d, a, c]) => hit(r, mo, d, a, c));
  if (!m) return r;
  if (String(r[DESC] ?? '') === m[4]) return r;        // already restored
  const out = [...r];
  out[DESC] = m[4];
  done.push({ kind: 'restore', date: m[1], amt: m[2], desc: m[4] });
  return out;
});

for (const s of SPLIT) {
  const i = next.findIndex((r) => hit(r, s.month, s.date, s.amt, s.from));
  if (i < 0) { done.push({ kind: 'skip', date: s.date, amt: s.amt }); continue; }
  const base = next[i];
  const made = s.parts.map((p) => {
    const r = [...base];
    r[CATEGORY] = p.cat; r[DESC] = p.desc; r[AMOUNT] = p.amt; r[BUCKET] = 'COGS';
    return r;
  });
  next = [...next.slice(0, i), ...made, ...next.slice(i + 1)];
  done.push({ kind: 'split', date: s.date, amt: s.amt, parts: s.parts });
}

console.log(APPLY ? 'APPLYING\n' : 'DRY RUN — ใส่ --apply เพื่อเขียนจริง\n');
for (const d of done) {
  if (d.kind === 'skip') { console.log(`  ข้าม  ${d.date} ฿${d.amt} — ไม่เจอ (แยกไปแล้ว?)`); continue; }
  if (d.kind === 'split') {
    console.log(`  แยก   ${d.date} ฿${d.amt.toLocaleString()} ->`);
    d.parts.forEach((p) => console.log(`          ${p.cat.padEnd(11)} ฿${String(p.amt.toLocaleString()).padStart(6)}  ${p.desc.slice(0, 50)}`));
    continue;
  }
  console.log(`  เติม  ${d.date} ฿${String(d.amt.toLocaleString()).padStart(7)}  ${d.desc.slice(0, 62)}`);
}
if (!done.length) console.log('  ไม่มีอะไรต้องทำ');

if (APPLY && done.some((d) => d.kind !== 'skip')) {
  const backup = file.replace(/\.xlsx$/, '.bak-preorangeqty.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`\nWROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}
