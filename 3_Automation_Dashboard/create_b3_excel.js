const XLSX = require('xlsx');
const path = require('path');

const DASHBOARD_DIR = __dirname;
const OUT = path.join(DASHBOARD_DIR, 'SomSaiJai_Dashboard_B3_2026.xlsx');

// B3 Jul26 sales data from "Sale b3 July.md" — revenue-only
const jul26Data = [
  { d: '11/07/2026', day: 'Sat', rev: 5849 },
  { d: '12/07/2026', day: 'Sun', rev: 7124 },
  { d: '13/07/2026', day: 'Mon', rev: 6109 },
  { d: '14/07/2026', day: 'Tue', rev: 8430 },
  { d: '15/07/2026', day: 'Wed', rev: 8181 },
  { d: '16/07/2026', day: 'Thu', rev: 7737 },
  { d: '17/07/2026', day: 'Fri', rev: 7321 },
  { d: '18/07/2026', day: 'Sat', rev: 9064 },
  { d: '19/07/2026', day: 'Sun', rev: 8925 },
  { d: '20/07/2026', day: 'Mon', rev: 11046 },
  { d: '21/07/2026', day: 'Tue', rev: 11646 },
  { d: '22/07/2026', day: 'Wed', rev: 9789 },
  { d: '23/07/2026', day: 'Thu', rev: 6157 },
  { d: '24/07/2026', day: 'Fri', rev: 8224 },
  { d: '25/07/2026', day: 'Sat', rev: 9184 },
  { d: '26/07/2026', day: 'Sun', rev: 10668 },
  { d: '27/07/2026', day: 'Mon', rev: 6749 },
  { d: '28/07/2026', day: 'Tue', rev: 6519 },
  { d: '29/07/2026', day: 'Wed', rev: 7739 },
  { d: '30/07/2026', day: 'Thu', rev: 9248 },
  { d: '31/07/2026', day: 'Fri', rev: 6188 },
];

// Verify total
const total = jul26Data.reduce((s, r) => s + r.rev, 0);
console.log(`B3 Jul26: ${jul26Data.length} days, total revenue: ฿${total.toLocaleString()}`);

// Build Excel with same structure as B1/B2
const wb = XLSX.utils.book_new();

// Headers matching B1/B2 format
const headers = ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)', 'Expenses (฿)', 'Cash-Exp (฿)', 'Scan/Transfer (฿)',
  'Orange', 'Orange (100)', 'Watermelon', 'Mango', 'Coconut', 'Apple', 'Young Coco', 'Guava', 'Pineapple', 'Total Cups',
  'Bot Big', 'Bot Small',
  'Used Orange (basket)', 'Used Watermelon (pcs)', 'Used Mango', 'Used Coco (Meat)', 'Used Coco (Water)',
  'Used Coco (Conden)', 'Used Coco (Raw)', 'Used Apple', 'Used Guava', 'Used Pineapple', 'Used Young Coco'];

// Create Jul26 sheet
const rows = [
  ['SomSaiJai Branch 3 (Platinum Pop) - Jul 2026'],
  headers,
  ...jul26Data.map(r => [
    r.d, r.day, r.rev, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  ]),
  ['TOTAL', '', total, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
];

const ws = XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb, ws, 'Jul26');

// Create empty monthly sheets for Jan-Jun (B3 didn't exist yet)
// and Aug-Dec for future use
const emptyMonths = ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Aug26', 'Sep26', 'Oct26', 'Nov26', 'Dec26'];
emptyMonths.forEach(m => {
  const emptyWs = XLSX.utils.aoa_to_sheet([
    [`SomSaiJai Branch 3 (Platinum Pop) - ${m}`],
    headers
  ]);
  XLSX.utils.book_append_sheet(wb, emptyWs, m);
});

// Create Daily_Expenses sheet (empty template)
const expHeaders = ['Date', 'Month', 'Bucket', 'Category', 'Description', 'Amount'];
const expRows = [
  ['SomSaiJai Branch 3 (Platinum Pop) - Daily Expenses'],
  [''],
  [''],
  expHeaders
];
const expWs = XLSX.utils.aoa_to_sheet(expRows);
XLSX.utils.book_append_sheet(wb, expWs, 'Daily_Expenses');

XLSX.writeFile(wb, OUT);
console.log(`✅ Created ${OUT}`);
