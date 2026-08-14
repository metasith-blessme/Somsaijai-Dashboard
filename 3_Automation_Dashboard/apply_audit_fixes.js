// One-time corrections from the full Jun-Jul26 data audit (Aug 2026).
// B2 Jun26 sales sheet: 2 days had Cash/Revenue overstated vs the source images.
// B1 Daily_Expenses: missing receipts, a mis-cited/wrong-dated purchase, a wrong
// crate count, and COGS entries that bundled non-COGS spend (police fees,
// investment budget, extraction-machine equipment).
//
// Run: node apply_audit_fixes.js [--dry]
const XLSX = require('xlsx');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry');

function loadGrid(wb, sheet) {
    return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: null });
}

// ---------- B2 Jun26 sales sheet ----------
const b2File = path.join(__dirname, 'SomSaiJai_Dashboard_B2_2026.xlsx');
const b2wb = XLSX.readFile(b2File);
const b2grid = loadGrid(b2wb, 'Jun26');
const b2Header = b2grid[1];
const col = {};
b2Header.forEach((h, i) => { if (h) col[h] = i; });

const b2Fixes = [
    { date: '15/06/2026', cash: 2770, cashExp: 2680, rev: 4260 },
    { date: '17/06/2026', cash: 3940, cashExp: 3880, rev: 5050 },
];

let b2Changes = 0;
for (const fix of b2Fixes) {
    const row = b2grid.find(r => r && r[0] === fix.date);
    if (!row) throw new Error(`B2 Jun26: no row for ${fix.date}`);
    const before = { rev: row[col['Revenue (฿)']], cash: row[col['Cash (฿)']], cashExp: row[col['Cash-Exp (฿)']] };
    row[col['Revenue (฿)']] = fix.rev;
    row[col['Cash (฿)']] = fix.cash;
    row[col['Cash-Exp (฿)']] = fix.cashExp;
    console.log(`B2 ${fix.date}: Revenue ${before.rev}->${fix.rev}, Cash ${before.cash}->${fix.cash}, Cash-Exp ${before.cashExp}->${fix.cashExp}`);
    b2Changes++;
}

// ---------- B1 Daily_Expenses ----------
const b1File = path.join(__dirname, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const b1wb = XLSX.readFile(b1File);
const b1grid = loadGrid(b1wb, 'Daily_Expenses');

function findRow(date, amt, descFragment) {
    const idx = b1grid.findIndex(r => r && r[0] === date && r[5] === amt && (!descFragment || String(r[4]).includes(descFragment)));
    if (idx === -1) throw new Error(`B1 Daily_Expenses: no row for ${date} / ${amt} / ${descFragment}`);
    return idx;
}

let b1Changes = 0;
const newRows = [];

// 1. Split 04/06/2026 ฿5,750 COGS/Pineapple into Watermelon/Pineapple/Orange/Police-fee
{
    const idx = findRow('04/06/2026', 5750, 'Watermelon 750+pineapple');
    b1grid[idx] = ['04/06/2026', 'Jun26', 'COGS', 'Watermelon', 'สลิปรวม: แตงโม 750 (audit fix, was bundled into Pineapple line)', 750];
    newRows.push(['04/06/2026', 'Jun26', 'COGS', 'Pineapple', 'สลิปรวม: สับปะรด 750 (audit fix, was bundled)', 750]);
    newRows.push(['04/06/2026', 'Jun26', 'COGS', 'Orange', 'สลิปรวม: ส้ม 2250 (audit fix, was bundled into Pineapple line)', 2250]);
    newRows.push(['04/06/2026', 'Jun26', 'OPEX', 'Other', 'ค่าปรับตำรวจ 2 คน (police fee, audit fix - was miscategorized as COGS/Pineapple)', 2000]);
    console.log('B1 04/06/2026: split ฿5750 COGS/Pineapple -> Watermelon 750 + Pineapple 750 + Orange 2250 + OPEX/Other(police fee) 2000');
    b1Changes++;
}

// 2. Split 26/07/2026 ฿4,710 COGS/Mango into Mango + investment budget
{
    const idx = findRow('26/07/2026', 4710, 'มะม่วง 3 ลัง');
    b1grid[idx] = ['26/07/2026', 'Jul26', 'COGS', 'Mango', 'มะม่วง 3 ลัง 3900 (LINE_ALBUM_Cost July_260802_8.jpg)', 3900];
    newRows.push(['26/07/2026', 'Jul26', 'CAPEX', 'Investment', 'งบลงทุน - ทดลองอื่นๆ (LINE_ALBUM_Cost July_260802_8.jpg, audit fix - was bundled into COGS/Mango)', 810]);
    console.log('B1 26/07/2026: split ฿4710 COGS/Mango -> Mango 3900 + CAPEX/Investment 810');
    b1Changes++;
}

// 3. Fix Coconut: wrong date (26/07->27/07), wrong amount (6700->7620), wrong citation
{
    const idx = findRow('26/07/2026', 6700, 'น้ำมะพร้าว 30ลิตร');
    b1grid[idx] = ['27/07/2026', 'Jul26', 'COGS', 'Coconut', 'น้ำมะพร้าว 30ลิตร 1350 เนื้อ 50kg 5000 น้ำมะพร้าวขวด 920 ค่าส่ง 350 (LINE_ALBUM_Cost July_260802_14.jpg, audit fix - was dated 26/07 citing wrong image, missing ฿920 bottles line)', 7620];
    console.log('B1 Coconut: 26/07/2026 ฿6700 (image_9, wrong) -> 27/07/2026 ฿7620 (image_14, correct)');
    b1Changes++;
}

// 4. Recategorize 2 extraction-machine purchases: COGS/Packaging -> CAPEX/Investment
{
    const idx1 = findRow('26/07/2026', 1015, 'Shopee');
    b1grid[idx1] = ['26/07/2026', 'Jul26', 'CAPEX', 'Investment', 'เครื่องสกัดเย็น 1 เครื่อง (Shopee, audit fix - was COGS/Packaging)', 1015];
    const idx2 = findRow('26/07/2026', 1087, 'Shopee');
    b1grid[idx2] = ['26/07/2026', 'Jul26', 'CAPEX', 'Investment', 'เครื่องสกัดเย็น 1 เครื่อง (Shopee, audit fix - was COGS/Packaging)', 1087];
    console.log('B1 26/07/2026: 2 extraction-machine purchases (1015, 1087) recategorized COGS/Packaging -> CAPEX/Investment');
    b1Changes += 2;
}

// 5. Fix Apple: "4 ลัง" ฿1600 -> "5 ลัง" ฿2150 on 28/07/2026
{
    const idx = findRow('28/07/2026', 1600, 'แอปเปิ้ล 4 ลัง');
    b1grid[idx] = ['28/07/2026', 'Jul26', 'COGS', 'Apple', 'แอปเปิ้ล 5 ลัง (LINE_ALBUM_Cost July_260802_16.jpg, audit fix - was recorded as 4 ลัง/฿1600)', 2150];
    console.log('B1 28/07/2026: Apple "4 ลัง" ฿1600 -> "5 ลัง" ฿2150');
    b1Changes++;
}

// 6-9. Add missing receipts
newRows.push(['26/07/2026', 'Jul26', 'OPEX', 'Other', 'ค่าส่งของ (LINE_ALBUM_Cost July_260802_11.jpg, audit fix - missing entry)', 212]);
newRows.push(['28/07/2026', 'Jul26', 'COGS', 'Pineapple', 'สับปะรด 30 ลูก (LINE_ALBUM_Cost July_260802_17.jpg, audit fix - missing entry)', 1188]);
newRows.push(['28/07/2026', 'Jul26', 'OPEX', 'Other', 'ค่าขนส่ง (LINE_ALBUM_Cost July_260802_19.jpg, audit fix - missing entry)', 100]);
newRows.push(['31/07/2026', 'Jul26', 'OPEX', 'Other', 'Lalamove (LINE_ALBUM_Cost July_260802_25.jpg, audit fix - missing entry)', 2000]);
console.log('B1: adding 4 missing receipts (212 + 1188 + 100 + 2000 = 3500)');
b1Changes += 4;

console.log(`\nTotal: B2 ${b2Changes} row(s) corrected, B1 ${b1Changes} change(s) (${newRows.length} new row(s) added).`);

if (!DRY_RUN) {
    b2wb.Sheets['Jun26'] = XLSX.utils.aoa_to_sheet(b2grid);
    XLSX.writeFile(b2wb, b2File);
    console.log(`✅ ${path.basename(b2File)} written`);

    const finalB1Grid = b1grid.concat(newRows);
    b1wb.Sheets['Daily_Expenses'] = XLSX.utils.aoa_to_sheet(finalB1Grid);
    XLSX.writeFile(b1wb, b1File);
    console.log(`✅ ${path.basename(b1File)} written`);
} else {
    console.log('\n--dry: no files written.');
}
