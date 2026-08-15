// Two Q1 corrections, both evidenced by the owner's own Google Sheet (ส้มใส่ใจ):
//
// 1. The December profit distribution (฿47,961 Blessme + ฿32,000 Ming, paid 02/01/2026 and
//    visible in the bank statement) is filed as COGS/Ice. CLAUDE.md requires distributions to
//    be EXCLUDED / Profit Distribution. As COGS it inflates January cost by ฿79,961.
//
// 2. Jan-Mar fixed costs never reached Daily_Expenses — they lived in the Fixed_Expenses tab,
//    which holds placeholder data (rent = electricity = water = 12,324). March SG&A currently
//    reads ฿0. Real figures come from the owner's sheet, tab "งบการเงิน", rows ค่าเช่า /
//    ค่าแรงคนงาน / ค่าเช่าคลัง / ค่าน้ำ + ค่าไฟ.
//
// Dry run by default. Pass --apply to write; the workbook is backed up first.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const SRC = require('./gsheet_source.json');
const SHEET = 'Daily_Expenses';
const HEADER_ROWS = 3;
const [DATE, , BUCKET, CATEGORY, DESC, AMOUNT] = [0, 1, 2, 3, 4, 5];
const SHOP_RENT_MARK = 'ค่าเช่าร้าน';
const BRANCH = 'B1'; // B2/B3 did not exist in Q1

const RECLASSIFY = [
  { date: '02/01/2026', match: 'ส่วนแบ่ง60เปอ', amount: 47961, who: 'Blessme 60% (ธ.ค.68)' },
  { date: '02/01/2026', match: 'ค่าส่วนแบ่งกำไรเมน 40เปอ', amount: 32000, who: 'Ming 40% (ธ.ค.68)' },
];

// month -> { label: [category, amount] } taken from _sheet_fixed_costs_SGA.
const MONTH_END = { Jan26: '31/01/2026', Feb26: '28/02/2026', Mar26: '31/03/2026' };
const FIXED = [];
for (const [month, v] of Object.entries(SRC._sheet_fixed_costs_SGA)) {
  if (month.startsWith('_') || !MONTH_END[month]) continue;
  FIXED.push(
    { month, date: MONTH_END[month], category: 'Rental', desc: `ค่าเช่าร้าน ${month}`, amount: v.rent },
    { month, date: MONTH_END[month], category: 'Salary', desc: `ค่าแรงคนงาน ${month}`, amount: v.labour },
    { month, date: MONTH_END[month], category: 'Rental', desc: `ค่าเช่าคลัง ${month}`, amount: v.warehouse },
    { month, date: MONTH_END[month], category: 'Other', desc: `ค่าน้ำ + ค่าไฟ ${month}`, amount: v.utilities },
  );
}

const f = (n) => Math.round(n).toLocaleString('en-US');
const file = path.join(DASH, `SomSaiJai_Dashboard_${BRANCH}_2026.xlsx`);
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET], { header: 1 });
const done = [];

// --- 1. Reclassify the distributions ---
const next = rows.map((row) => {
  const hit = RECLASSIFY.find((r) => String(row[DATE] ?? '').trim() === r.date
    && String(row[DESC] ?? '').includes(r.match)
    && Math.round(Number(row[AMOUNT]) || 0) === r.amount
    && String(row[BUCKET] ?? '') === 'COGS');
  if (!hit) return row;
  const updated = [...row];
  updated[BUCKET] = 'EXCLUDED';
  updated[CATEGORY] = 'Profit Distribution';
  updated[DESC] = `ส่วนแบ่งกำไร ${hit.who} — ไม่ใช่ต้นทุน`;
  updated[AMOUNT] = 0; // per CLAUDE.md: recorded at zero so it never enters cost
  done.push({ kind: 'reclass', ...hit });
  return updated;
});

// --- 2. Add the missing Q1 fixed costs ---
// Existing Q1 OPEX, so we top up to the sheet's figure rather than double-booking.
const existing = {};
for (const row of rows.slice(HEADER_ROWS)) {
  const d = String(row[DATE] ?? '').match(/^\d{2}\/(\d{2})\/2026$/);
  if (!d || Number(d[1]) > 3) continue;
  if (String(row[BUCKET] ?? '') !== 'OPEX') continue;
  const month = ['', 'Jan26', 'Feb26', 'Mar26'][Number(d[1])];
  const cat = String(row[CATEGORY] ?? '');
  const desc = String(row[DESC] ?? '');
  // Shop rent and warehouse rent are both category Rental but must land on different P&L
  // rows. Only a row this script itself wrote is tagged "ค่าเช่าร้าน" (shop); everything
  // else filed under Rental predates it and is a warehouse charge (12,324 / 12,000).
  const bucket = cat === 'Salary' ? 'Salary'
    : cat === 'Rental' ? (desc.includes(SHOP_RENT_MARK) ? 'RentalShop' : 'RentalWarehouse')
    : 'Other';
  const key = `${month}|${bucket}`;
  existing[key] = (existing[key] || 0) + (Number(row[AMOUNT]) || 0);
}

for (const [month, v] of Object.entries(SRC._sheet_fixed_costs_SGA)) {
  if (month.startsWith('_') || !MONTH_END[month]) continue;
  const items = [
    { category: 'Rental', label: `ค่าเช่าร้าน ${month}`, want: v.rent, have: existing[`${month}|RentalShop`] || 0 },
    { category: 'Rental', label: `ค่าเช่าคลัง ${month}`, want: v.warehouse, have: existing[`${month}|RentalWarehouse`] || 0 },
    { category: 'Salary', label: `ค่าแรงคนงาน ${month}`, want: v.labour, have: existing[`${month}|Salary`] || 0 },
    { category: 'Other', label: `ค่าน้ำ + ค่าไฟ ${month}`, want: v.utilities, have: existing[`${month}|Other`] || 0 },
  ];
  for (const it of items) {
    const gap = Math.round(it.want - it.have);
    if (gap <= 0) continue;
    next.push([MONTH_END[month], month, 'OPEX', it.category, `${it.label} (ปรับตามงบการเงินเจ้าของ)`, gap]);
    done.push({ kind: 'fixed', month, category: it.label, want: it.want, have: it.have, gap });
  }
}

if (APPLY && done.length) {
  const backup = file.replace(/\.xlsx$/, '.bak-preq1.xlsx');
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(next);
  XLSX.writeFile(wb, file);
  console.log(`WROTE ${path.basename(file)}  (backup: ${path.basename(backup)})`);
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN — pass --apply to write'}\n`);
for (const d of done) {
  if (d.kind === 'reclass') console.log(`reclassify ${d.date}  ${f(d.amount).padStart(7)}  COGS/Ice -> EXCLUDED/Profit Distribution  (${d.who})`);
  else console.log(`add ${d.month} ${d.category.padEnd(7)} want ${f(d.want).padStart(7)}  have ${f(d.have).padStart(7)}  -> add ${f(d.gap)}`);
}
if (!done.length) console.log('Nothing to do — already applied.');

(function selfCheck() {
  const assert = require('assert');
  assert.strictEqual(RECLASSIFY.reduce((a, r) => a + r.amount, 0), 79961, 'the distribution total must be 79,961');
  // Q1 SG&A must end up matching the owner's sheet exactly.
  for (const [month, v] of Object.entries(SRC._sheet_fixed_costs_SGA)) {
    if (month.startsWith('_') || !MONTH_END[month]) continue;
    const target = v.rent + v.labour + v.warehouse + v.utilities;
    assert.strictEqual(Math.round(target), Math.round(v.total), `${month} SG&A parts must equal its stated total`);
  }
})();
