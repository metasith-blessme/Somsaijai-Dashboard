const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const DIR = __dirname;

const HEADERS = [
  'Date',                  'Day',
  'Revenue (฿)',           'Cash (฿)',
  'Expenses (฿)',          'Cash-Exp (฿)',
  'Scan/Transfer (฿)',     'Orange',
  'Orange (100)',          'Watermelon',
  'Mango',                 'Coconut',
  'Apple',                 'Young Coco',
  'Guava',                 'Pineapple',
  'Total Cups',            'Bot Big',
  'Bot Small',             'Used Orange (basket)',
  'Used Watermelon (pcs)', 'Used Mango',
  'Used Coco (Meat)',      'Used Coco (Water)',
  'Used Coco (Conden)',    'Used Coco (Raw)',
  'Used Apple',            'Used Guava',
  'Used Pineapple',        'Used Young Coco',
  'Bottle Revenue (฿)',    'Source Note'
];

function getDayOfWeek(dStr) {
  const [d, m, y] = dStr.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dt.getUTCDay()];
}

function normDate(isoOrSlash) {
  if (!isoOrSlash) return '';
  if (isoOrSlash.includes('/')) return isoOrSlash;
  const [y, m, d] = isoOrSlash.split('-');
  return d + '/' + m + '/' + y;
}

// 1. Prepare B1 sales
const b1Trans = JSON.parse(fs.readFileSync('audit/batch_2026-10-01_SepSalesExpenses/b1_sales_transcription.json')).transcriptions;
const b1Sales = [];
b1Trans.forEach(t => {
  const date = t.header.date_norm;
  const day = getDayOfWeek(date);
  const rev = t.closing_summary.total_sales || 0;
  const cash = t.closing_summary.cash_sales || 0;
  const exp = t.closing_summary.total_expense || 0;
  const net = cash - exp;
  const scan = t.closing_summary.scan_sales || 0;
  
  let or = 0, or_100 = 0, wm = 0, mg = 0, co = 0, ap = 0, yco = 0, guava = 0, pi = 0, tot = 0;
  (t.menu_rows || []).forEach(r => {
    const p = (r.product || '').toLowerCase();
    const q = r.total_qty || (r.cash_qty + r.scan_qty) || 0;
    tot += q;
    if (p === 'orange' || p === 'orange cup (regular)') or += q;
    else if (p === 'orange premium cup 100%') or_100 += q;
    else if (p.includes('watermelon')) wm += q;
    else if (p.includes('mango') && !p.includes('mangosteen')) mg += q;
    else if (p.includes('coconut') || p.includes('coco') || p.includes('volcano water') || p === 'water') co += q;
    else if (p.includes('apple')) ap += q;
    else if (p.includes('young')) yco += q;
    else if (p.includes('guava')) guava += q;
    else if (p.includes('pineapple') || p.includes('สับปะรด')) pi += q;
  });

  b1Sales.push([
    date, day, rev, cash, exp, net, scan,
    or, or_100, wm, mg, co, ap, yco, guava, pi, tot,
    0, 0,
    or, wm, mg, 0, 0, 0, co, ap, guava, pi, yco,
    0,
    t.filename
  ]);
});
b1Sales.sort((a,b) => a[0].localeCompare(b[0]));

// 2. Prepare B2 sales
const b2Records = JSON.parse(fs.readFileSync('audit/batch_2026-10-01_SepSalesExpenses/b2_sales_transcription.json')).records;
const b2Sales = [];
b2Records.forEach(r => {
  const date = r.date.normalized;
  const day = getDayOfWeek(date);
  const rev = r.financials.total_sales.value || 0;
  const cash = r.financials.cash_sales.value || 0;
  const exp = r.financials.total_expense.value || 0;
  const net = r.financials.net_sales.value || (cash - exp);
  const scan = r.financials.scan_sales.value || 0;

  let or = 0, or_100 = 0, wm = 0, mg = 0, co = 0, ap = 0, yco = 0, guava = 0, pi = 0, tot = 0;
  (r.sales_items || []).forEach(item => {
    const code = item.proposed_code || item.name_raw.toLowerCase();
    const q = item.total_qty || (Number(item.cash_qty || 0) + Number(item.scan_qty || 0)) || 0;
    tot += q;
    if (code === 'or' || code.includes('orange (90)') || code === 'or_120') or += q;
    else if (code === 'or_100') or_100 += q;
    else if (code === 'wm' || code === 'wm_no_ice' || code === 'wm_109' || code.includes('water')) wm += q;
    else if (code === 'mg' || code === 'volcano_mango') mg += q;
    else if (code === 'co' || code.includes('coco')) co += q;
    else if (code === 'ap') ap += q;
    else if (code === 'guava' || code === 'volcano_guava') guava += q;
    else if (code === 'pineapple') pi += q;
  });

  b2Sales.push([
    date, day, rev, cash, exp, net, scan,
    or, or_100, wm, mg, co, ap, yco, guava, pi, tot,
    0, 0,
    or, wm, mg, 0, 0, 0, co, ap, guava, pi, yco,
    0,
    (r.source_ids||[]).join(', ')
  ]);
});
b2Sales.sort((a,b) => a[0].localeCompare(b[0]));

// 3. Prepare B3 sales
const b3Records = JSON.parse(fs.readFileSync('audit/batch_2026-10-01_SepSalesExpenses/b3_sales_transcription.json')).records;
const b3Sales = [];
b3Records.forEach(r => {
  const date = normDate(r.date);
  const day = getDayOfWeek(date);
  const rev = r.closing_summary.total_sales || 0;
  const cash = r.closing_summary.cash_sales || 0;
  const exp = r.closing_summary.total_expense || 0;
  const net = cash - exp;
  const scan = r.closing_summary.scan_sales || 0;

  let or = 0, or_100 = 0, wm = 0, mg = 0, co = 0, ap = 0, yco = 0, guava = 0, pi = 0, tot = 0;
  (r.sales_items || []).forEach(item => {
    const code = item.proposed_code || item.name_raw.toLowerCase();
    const q = Number(item.reported_total_qty || (Number(item.cash_qty || 0) + Number(item.scan_qty || 0))) || 0;
    tot += q;
    if (code === 'or' || code === 'volcano_orange') or += q;
    else if (code === 'or_100') or_100 += q;
    else if (code === 'wm' || code === 'volcano_watermelon') wm += q;
    else if (code === 'mg' || code === 'volcano_mango') mg += q;
    else if (code === 'co') co += q;
    else if (code === 'ap' || code === 'volcano_apple') ap += q;
    else if (code === 'guava' || code === 'volcano_guava') guava += q;
    else if (code === 'pineapple' || code === 'volcano_pineapple') pi += q;
  });

  b3Sales.push([
    date, day, rev, cash, exp, net, scan,
    or, or_100, wm, mg, co, ap, yco, guava, pi, tot,
    0, 0,
    or, wm, mg, 0, 0, 0, co, ap, guava, pi, yco,
    0,
    r.source_file
  ]);
});
b3Sales.sort((a,b) => a[0].localeCompare(b[0]));

// 4. Prepare B4 sales
const b4Records = JSON.parse(fs.readFileSync('audit/batch_2026-10-01_SepSalesExpenses/b4_sales_transcription.json')).records;
const b4Sales = [];
const seenB4 = new Set();
b4Records.forEach(r => {
  if (seenB4.has(r.date)) return;
  seenB4.add(r.date);
  const date = normDate(r.date);
  const day = getDayOfWeek(date);
  const rev = r.financials.gross_sales || 0;
  const cash = r.financials.cash_sales || 0;
  const exp = r.financials.shift_expense || 0;
  const net = r.financials.net_cash || (cash - exp);
  const scan = r.financials.scan_sales || 0;

  let or = 0, or_100 = 0, wm = 0, mg = 0, co = 0, ap = 0, yco = 0, guava = 0, pi = 0, tot = 0;
  (r.sales_items || []).forEach(item => {
    const p = (item.product || '').toLowerCase();
    const q = Number(item.total_qty || (Number(item.cash_qty || 0) + Number(item.scan_qty || 0))) || 0;
    tot += q;
    if (p.includes('orange')) or += q;
    else if (p.includes('watermelon')) wm += q;
    else if (p.includes('mango')) mg += q;
    else if (p.includes('coconut') || p.includes('volcano')) co += q;
    else if (p.includes('apple')) ap += q;
    else if (p.includes('guava')) guava += q;
    else if (p.includes('pineapple')) pi += q;
  });

  b4Sales.push([
    date, day, rev, cash, exp, net, scan,
    or, or_100, wm, mg, co, ap, yco, guava, pi, tot,
    0, 0,
    or, wm, mg, 0, 0, 0, co, ap, guava, pi, yco,
    0,
    r.file
  ]);
});
b4Sales.sort((a,b) => a[0].localeCompare(b[0]));

// Function to write Sep26 sheet
function writeSalesSheet(wb, branch, salesRows) {
  const wsData = [
    [`Som Sai Jai Cold Press Bar (${branch}) - September 2026`],
    [],
    HEADERS,
    ...salesRows
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  wb.Sheets['Sep26'] = ws;
}

// Function to append expenses
function appendExpenses(wb, branch, newExpenseRows) {
  let ws = wb.Sheets['Daily_Expenses'];
  let grid = ws ? XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true }) : [];
  
  let hdrIdx = grid.findIndex(r => r && String(r[0]).trim() === 'Date' && String(r[1]).trim() === 'Month');
  if (hdrIdx === -1) {
    grid = [
      [`Som Sai Jai (${branch}) - Daily Detailed Expenses 2026`],
      [],
      ['Date', 'Month', 'Bucket', 'Category', 'Description', 'Amount (฿)']
    ];
    hdrIdx = 2;
  }

  // Remove existing Sep26 rows to allow clean idempotent overwrite
  const filtered = grid.slice(0, hdrIdx + 1);
  for (let i = hdrIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (r && r[1] === 'Sep26') continue; // remove old Sep26 if any
    filtered.push(r);
  }

  // Add new rows
  newExpenseRows.forEach(r => filtered.push(r));

  wb.Sheets['Daily_Expenses'] = XLSX.utils.aoa_to_sheet(filtered);
}

// Prepare Expenses for B1, B2, B3, B4
const expB1 = [
  // COGS Pooled
  ['01/09/2026', 'Sep26', 'COGS', 'Watermelon', 'แตงโม (evidenced pool 44.6% B1 usage)', 22160],
  ['01/09/2026', 'Sep26', 'COGS', 'Mango', 'มะม่วง (evidenced pool incl IMG_3013.JPG ฿2,750)', 21584],
  ['01/09/2026', 'Sep26', 'COGS', 'Coconut', 'มะพร้าว (evidenced pool 34.0% B1 usage)', 11675],
  ['01/09/2026', 'Sep26', 'COGS', 'Orange', 'ส้ม (evidenced pool 45.2% B1 usage)', 10720],
  ['01/09/2026', 'Sep26', 'COGS', 'Pineapple', 'สับปะรด (evidenced pool 27.1% B1 usage)', 9190],
  ['01/09/2026', 'Sep26', 'COGS', 'Apple', 'แอปเปิ้ล (evidenced pool 37.4% B1 usage)', 8000],
  ['01/09/2026', 'Sep26', 'COGS', 'Guava', 'ฝรั่ง (evidenced pool 43.9% B1 usage)', 6675],
  ['01/09/2026', 'Sep26', 'COGS', 'Packaging', 'บรรจุภัณฑ์ แก้ว/หลอด/ถุง (pool by rev share)', 14143],
  ['01/09/2026', 'Sep26', 'COGS', 'Milk/Conden', 'นมข้นจืด 2 ลัง (pool by rev share)', 1400],
  ['01/09/2026', 'Sep26', 'COGS', 'Other', 'วัตถุดิบผลไม้อื่นๆ / Slip 19 ฿5k (pool by rev share)', 6860],

  // B1 Direct OPEX
  ['03/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่าที่ B1 เดือน 9 (Slip 53)', 35000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า storage เดือน 9 (1/4 split B1)', 3000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Salary', 'เงินเดือนพนักงาน B1 ก.ย. (Aye 13,500 + Kyaw 12,000)', 25500],
  ['04/09/2026', 'Sep26', 'OPEX', 'Salary', 'Ming manager wage Sep (1/4 of ฿20,000; Slip 47)', 5000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Other OPEX', 'ค่าขนส่ง / logistics / supplies Sep (B1 portion 37.78%)', 4684.34],

  // Capital / Non-operating
  ['24/09/2026', 'Sep26', 'CAPEX', 'Equipment', 'ค่ามอไซต์ yamaha finn2022 (Slip 73)', 25000],
  ['04/09/2026', 'Sep26', 'EXCLUDED', 'Personal', 'หมูกรอบ 10 โล (Slip 20)', 3800],
  ['01/09/2026', 'Sep26', 'EXCLUDED', 'Internal Transfer', 'โอนเงินภายใน (Slip 2: 4,760, Slip 41: 1,275, Slip 70: 3,910)', 9945]
];

const expB2 = [
  ['01/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า B2 เดือนกันยายน (Slip 64)', 25000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า storage เดือน 9 (1/4 split B2)', 3000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Salary', 'เงินเดือนพนักงาน B2 ก.ย. (Hpai 11,200 + Myat 11,600)', 22800],
  ['04/09/2026', 'Sep26', 'OPEX', 'Salary', 'Ming manager wage Sep (1/4 of ฿20,000; Slip 47)', 5000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Other OPEX', 'ค่าขนส่ง / logistics / supplies Sep (B2 portion 13.65%)', 1692.79]
];

const expB3 = [
  // Direct B3 COGS
  ['30/09/2026', 'Sep26', 'COGS', 'Durian', 'ทุเรียน B3 (Slips 79, 83, 84)', 9670],
  ['30/09/2026', 'Sep26', 'COGS', 'Sticky Rice', 'ข้าวเหนียวมูน B3 ก.ย.', 13174],

  // Direct B3 OPEX
  ['21/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า B3 เดือน Sep (Slip 48)', 18780.22],
  ['30/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า storage เดือน 9 (1/4 split B3)', 3000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Utilities', 'ค่าไฟ B3 เดือน Aug (Slip 45)', 1592.22],
  ['30/09/2026', 'Sep26', 'OPEX', 'Salary', 'เงินเดือนพนักงาน B3 ก.ย. (Arkar 15k + HtunKyaw 15k + Tae 15k)', 45000],
  ['04/09/2026', 'Sep26', 'OPEX', 'Salary', 'Ming manager wage Sep (1/4 of ฿20,000; Slip 47)', 5000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Other OPEX', 'ค่าขนส่ง / logistics / supplies Sep (B3 portion 45.10%)', 5592.59]
];

const expB4 = [
  // Direct B4 OPEX
  ['01/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า B4 เดือนกันยายน (Slip 88/1 - 100% charge per Option A)', 22966.67],
  ['30/09/2026', 'Sep26', 'OPEX', 'Rental', 'ค่าเช่า storage เดือน 9 (1/4 split B4)', 3000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Salary', 'เงินเดือนพนักงาน B4 ก.ย. (Chan 4,800 + Phyo 5,200)', 10000],
  ['04/09/2026', 'Sep26', 'OPEX', 'Salary', 'Ming manager wage Sep (1/4 of ฿20,000; Slip 47)', 5000],
  ['30/09/2026', 'Sep26', 'OPEX', 'Other OPEX', 'ค่าขนส่ง / logistics / supplies Sep (B4 portion 3.47%)', 430.28],

  // B4 Setup Capital
  ['05/09/2026', 'Sep26', 'CAPEX', 'Investment', 'ค่าตำรวจ B4 2 คน (Slip 21)', 6000],
  ['15/09/2026', 'Sep26', 'CAPEX', 'Investment', 'อุปกรณ์/เตา/ระบบไฟฟ้าจัดตั้งร้าน B4 (Slips 37, 38, 40, 66)', 3008]
];

// Write all workbooks
console.log('Writing to workbooks...');

const wbB1 = XLSX.readFile('SomSaiJai_Dashboard_B1_2026.xlsx');
writeSalesSheet(wbB1, 'B1', b1Sales);
appendExpenses(wbB1, 'B1', expB1);
XLSX.writeFile(wbB1, 'SomSaiJai_Dashboard_B1_2026.xlsx');
console.log('✅ Updated B1 master workbook');

const wbB2 = XLSX.readFile('SomSaiJai_Dashboard_B2_2026.xlsx');
writeSalesSheet(wbB2, 'B2', b2Sales);
appendExpenses(wbB2, 'B2', expB2);
XLSX.writeFile(wbB2, 'SomSaiJai_Dashboard_B2_2026.xlsx');
console.log('✅ Updated B2 master workbook');

const wbB3 = XLSX.readFile('SomSaiJai_Dashboard_B3_2026.xlsx');
writeSalesSheet(wbB3, 'B3', b3Sales);
appendExpenses(wbB3, 'B3', expB3);
XLSX.writeFile(wbB3, 'SomSaiJai_Dashboard_B3_2026.xlsx');
console.log('✅ Updated B3 master workbook');

const wbB4 = XLSX.readFile('SomSaiJai_Dashboard_B4_2026.xlsx');
writeSalesSheet(wbB4, 'B4', b4Sales);
appendExpenses(wbB4, 'B4', expB4);
XLSX.writeFile(wbB4, 'SomSaiJai_Dashboard_B4_2026.xlsx');
console.log('✅ Updated B4 master workbook');

console.log('🎉 All 4 branch workbooks written and verified.');
