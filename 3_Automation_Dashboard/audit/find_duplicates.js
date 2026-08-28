// Find double-booked expenses in the ledger.
//
// Two shapes, both seen in the real books:
//   A. EXACT   — same branch+month+category+amount, entered twice.
//   B. SPLIT   — one [bank] row for the whole transfer, plus per-person/per-item rows
//                that sum to it. reconcile_bank.js matches 1 bank line against 1 ledger
//                row, so a 1-to-N split slips through and gets booked a second time.
//                (FINDINGS.md flags this for the 20/02 ฿416 case; Apr26 payroll is the
//                same shape at ฿31,000.)
//
// Read-only. Prints candidates for a human to confirm — never edits.
const path = require('path');
const d = require(path.join(__dirname, '..', 'data.json'));

const f = (n) => Math.round(n).toLocaleString('en-US');
const isBank = (e) => /\[bank/.test(e.desc || '');
const rows = d.expenses.filter((e) => e.amt > 0);

// --- A. exact duplicates -------------------------------------------------
// Keyed on DATE, not month: this supplier is restocked on a fixed cycle, so the same
// fruit at the same price on different days is normal trade, not a double-booking.
// Only two rows on the SAME day for the same thing are suspicious.
const byKey = {};
for (const e of rows) {
  const k = [e.branch, e.date, e.cat, Math.round(e.amt)].join('|');
  (byKey[k] = byKey[k] || []).push(e);
}
const exact = Object.entries(byKey).filter(([, v]) => v.length > 1);

console.log('=== A. ซ้ำตรงๆ (สาขา+วันที่+หมวด+ยอด เหมือนกัน) ===');
if (!exact.length) console.log('  ไม่พบ');
for (const [k, v] of exact) {
  const [br, dt, cat, amt] = k.split('|');
  console.log(`  ${br} ${dt} ${cat} ฿${f(+amt)} — ${v.length} ครั้ง`);
  v.forEach((e) => console.log(`      ${(e.desc || '').slice(0, 70)}`));
}

// --- B. bank row == sum of sibling rows ----------------------------------
// For each [bank] row, look for 2..4 non-bank rows in the same branch+month whose
// amounts sum to it. Same-day rows rank first — that is the strongest signal.
console.log('\n=== B. แถว [bank] ที่เท่ากับผลรวมของแถวย่อย (ลงซ้ำแบบแตกย่อย) ===');
let found = 0;
// Constrained to the SAME DATE and SAME CATEGORY. Without both, subset-sum over a
// month of small rows finds coincidental combinations almost every time — it reports
// noise, not duplicates. A real split-booking is same day, same category, by construction.
for (const b of rows.filter(isBank)) {
  const pool = rows.filter(
    (e) => e !== b && !isBank(e) && e.branch === b.branch &&
           e.date === b.date && e.cat === b.cat && e.amt < b.amt
  );
  const target = Math.round(b.amt);
  const hits = [];
  const walk = (start, acc, sum) => {
    if (hits.length) return;                       // first (smallest) combination wins
    if (Math.round(sum) === target && acc.length >= 2) { hits.push([...acc]); return; }
    if (acc.length >= 4 || sum > target) return;
    for (let i = start; i < pool.length; i++) walk(i + 1, [...acc, pool[i]], sum + pool[i].amt);
  };
  walk(0, [], 0);
  if (!hits.length) continue;
  found++;
  const parts = hits[0];
  const sameDay = true;
  console.log(`  ${b.branch} ${b.month} ฿${f(b.amt)} ${sameDay ? '(วันเดียวกัน — น่าจะซ้ำแน่)' : '(คนละวัน — ต้องเช็ค)'}`);
  console.log(`      [bank] ${b.date}  ${(b.desc || '').slice(0, 65)}`);
  parts.forEach((p) => console.log(`      ย่อย   ${p.date}  ฿${String(f(p.amt)).padStart(7)}  ${(p.desc || '').slice(0, 55)}`));
}
if (!found) console.log('  ไม่พบ');

// --- C. month attribution: description names a month != the month column --
const TH = { 'ม.ค': 'Jan', 'ก.พ': 'Feb', 'มี.ค': 'Mar', 'เม.ย': 'Apr', 'พ.ค': 'May',
             'มิ.ย': 'Jun', 'ก.ค': 'Jul', 'ส.ค': 'Aug', 'ก.ย': 'Sep' };
console.log('\n=== C. คำอธิบายบอกเดือนหนึ่ง แต่ลงอีกเดือน ===');
let mism = 0;
for (const e of rows) {
  for (const [th, en] of Object.entries(TH)) {
    if (!(e.desc || '').includes(th)) continue;
    if (e.month && !e.month.startsWith(en)) {
      console.log(`  ${e.branch} ${e.date} [${e.month}] ฿${String(f(e.amt)).padStart(7)}  ${(e.desc || '').slice(0, 60)}  -> น่าจะเป็น ${en}26`);
      mism++;
    }
    break;
  }
}
if (!mism) console.log('  ไม่พบ');

console.log(`\nสรุป: ซ้ำตรงๆ ${exact.length} กลุ่ม | ซ้ำแบบแตกย่อย ${found} กลุ่ม | ลงผิดเดือน ${mism} แถว`);
