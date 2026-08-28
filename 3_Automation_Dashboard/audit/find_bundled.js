// Find slips that paid for several different things but were booked under one category.
//
// The entry habit is to file a bundled slip under whichever item is named first, so the
// rest of the money lands in the wrong place. It has already produced three wrong SKU
// margins: ฿16,835 of condensed milk hidden in Packaging/Stock (coconut read 525% instead
// of 312%), ฿4,200 of orange inside a watermelon row, and ฿2,450 the other way round.
//
// Signal: the description names items belonging to two or more different categories, and
// usually carries their sub-totals inline. Read-only — prints candidates to check by hand.
const path = require('path');
const d = require(path.join(__dirname, '..', 'data.json'));

// keyword -> the category that item really belongs to
const ITEMS = [
  [/นมข้น|falcon|goodwil/i, 'Milk/Conden'],
  [/ฝา(?!รั่ง)|แก้ว|หลอด|ถุงขยะ|ถุงมือ|ขวด/, 'Packaging'],
  [/ส้ม/, 'Orange'],
  [/แตงโม/, 'Watermelon'],
  [/มะม่วง/, 'Mango'],
  [/แอปเปิ้ล|แอพเปิ้ล/, 'Apple'],
  [/ฝรั่ง/, 'Guava'],
  [/สับปะร|สับประ/, 'Pineapple'],
  [/มะพร้าว/, 'Coconut'],
  [/มังคุด/, 'Mangosteen'],
  [/ทุเรียน/, 'Durian'],
  [/น้ำแข็ง/, 'Ice'],
  [/ค่าส่ง|ขนส่ง|lalamove/i, 'Transportation'],
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const rows = d.expenses.filter((e) => e.amt > 0 && e.desc && e.desc !== 'Unknown');

// Freight riding along with the goods it delivered is normal and correctly costed to
// them — the orange supplier always bills fruit + haulage from ฝาง on one transfer. Only
// two distinct PRODUCTS on one slip is a misfiling risk.
const isProduct = (c) => c !== 'Transportation';

const found = [];
for (const e of rows) {
  const cats = [...new Set(ITEMS.filter(([re]) => re.test(e.desc)).map(([, c]) => c))];
  if (cats.filter(isProduct).length < 2) continue;
  // Sub-totals written inline: numbers that are a plausible part of the row, not the row.
  const nums = (e.desc.match(/[\d,]{3,}/g) || [])
    .map((n) => parseFloat(n.replace(/,/g, '')))
    .filter((n) => n >= 50 && n < e.amt);
  const other = cats.filter((c) => c !== e.cat && isProduct(c));
  found.push({ e, cats, other, nums, exact: nums.reduce((a, b) => a + b, 0) === Math.round(e.amt) });
}

found.sort((a, b) => b.e.amt - a.e.amt);

console.log('=== สลิปที่มีของหลายอย่างแต่ลงหมวดเดียว ===\n');
console.log('เรียงตามยอด — ที่มี ✓ คือยอดย่อยบวกกันได้เท่ายอดรวมพอดี (แยกได้เลย)\n');
let n = 0, sum = 0;
for (const x of found) {
  const { e } = x;
  if (!x.other.length) continue;                 // already filed under one of its own items
  n++; sum += e.amt;
  console.log(`${x.exact ? '✓' : ' '} ${e.month} ${e.date} ${(e.bucket + '/' + e.cat).padEnd(18)} ฿${f(e.amt).padStart(7)}`);
  console.log(`    ${e.desc.slice(0, 88)}`);
  console.log(`    มีของหมวด: ${x.cats.join(', ')}  ->  ควรแยกออก: ${x.other.join(', ')}`);
  if (x.nums.length) console.log(`    ยอดย่อยในข้อความ: ${x.nums.map(f).join(' + ')} = ${f(x.nums.reduce((a, b) => a + b, 0))}`);
  console.log();
}
console.log(`พบ ${n} แถว รวม ฿${f(sum)}`);
console.log('\nแถวที่ขึ้น ✓ แยกได้ทันทีโดยไม่ต้องเปิดสลิป — ยอดย่อยครบพอดี');
