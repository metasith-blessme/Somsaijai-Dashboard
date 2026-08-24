// Two corrections, both confirmed line-by-line against the K PLUS statements
// (STM_SA5601 / STM_SA8285) on 2026-08-23:
//
// 1. Mangosteen is NOT a Som Sai Jai cost. The owner collects cash for another shop and
//    remits it to ฐนกร. Both rows are pass-throughs that net to zero in the bank:
//      23/05 17:22 ฝากเงินสด +28,000 -> 17:23 โอนไป ฐนกร -28,000
//      29/06 13:48 โอนไป supplier -1,932 -> 13:56 รับโอน from ฐนกร +1,932
//    Only the outflow was ever booked, so the ledger carried ฿29,932 of cost against
//    revenue that was never SSJ's. Same treatment as a partner payout: EXCLUDED / ฿0.
//
// 2. The 30/04 "duplicate" row was not a duplicate. There were two DIFFERENT ฿1,500
//    transfers that day:
//      16:18 UOBT X9679 นาง ศิครินธาร  -> pineapple (สับปะรส 3 ตะกร้า), already booked
//      22:50 BBL  X8148 นาง ประนอม     -> guava, the first guava purchase
//    ประนอม is the guava supplier (21 transfers, every other one booked as ฝรั่ง).
//    An earlier pass saw matching amounts on one date and zeroed this row; restoring it.
//    B2 sold 45 guava cups from 23/04 — delivered on credit, settled at month end, which
//    is the same convention FINDINGS.md documents for the other fruit suppliers.
//
// ponytail: matched on exact (date, category, amount, description) rather than row index,
// so a re-run after rows shift is still a no-op. Widen only if a row is edited by hand.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SHEET = 'Daily_Expenses';
const [DATE, MONTH, BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];

const FIXES = [
  { date: '23/05/2026', cat: 'Mangosteen', from: 28000,
    to: { bucket: 'EXCLUDED', cat: 'Pass-Through', amt: 0,
          desc: 'มังคุด (รับเงินสด 28,000 แล้วโอนต่อ ฐนกร 23/05 17:23) - ไม่ใช่ต้นทุน SSJ [bank]' } },
  { date: '29/06/2026', cat: 'Mangosteen', from: 1932,
    to: { bucket: 'EXCLUDED', cat: 'Pass-Through', amt: 0,
          desc: 'มังคุด 3 ตะกร้า (จ่ายแทน 1,932 แล้ว ฐนกร โอนคืน 29/06 13:56) - ไม่ใช่ต้นทุน SSJ [bank]' } },
  { date: '30/04/2026', cat: 'Other', from: 0, needsDesc: 'duplicate',
    to: { bucket: 'COGS', cat: 'Guava', amt: 1500,
          desc: 'ฝรั่ง ตะกร้าแรก (นาง ประนอม, BBL X8148) [bank 30/04 22:50]' } },
];

const file = path.join(DASH, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });
const done = [];

const next = rows.map((row) => {
  const hit = FIXES.find((f) =>
    String(row[DATE] ?? '').trim() === f.date &&
    String(row[CATEGORY] ?? '').trim() === f.cat &&
    Math.round(Number(row[AMOUNT]) || 0) === f.from &&
    (!f.needsDesc || String(row[DESC] ?? '').includes(f.needsDesc)));
  if (!hit) return row;
  const out = [...row];
  out[BUCKET] = hit.to.bucket;
  out[CATEGORY] = hit.to.cat;
  out[DESC] = hit.to.desc;
  out[AMOUNT] = hit.to.amt;
  done.push({ date: hit.date, from: `${hit.cat} ฿${hit.from.toLocaleString()}`,
              to: `${hit.to.cat} ฿${hit.to.amt.toLocaleString()}` });
  return out;
});

console.log(APPLY ? 'APPLYING' : 'DRY RUN — pass --apply to write', `\n${done.length}/3 rows matched\n`);
for (const d of done) console.log(`  ${d.date}  ${d.from.padEnd(28)} -> ${d.to}`);
if (!done.length) console.log('  (nothing to do — already applied)');

if (APPLY && done.length) {
  const backup = file.replace(/\.xlsx$/, '.bak-prepassthrough.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`\nWROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}
