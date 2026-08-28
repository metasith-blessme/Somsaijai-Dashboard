// Monthly fruit purchases: how much was bought, in what unit, for how much.
//
// Needed because COGS is allocated by ACTUAL USAGE (ADR 0001, owner's choice 2026-08-28),
// so the per-unit buying price has to be known before usage can be turned into cost.
//
// Quantities live in free-text Thai descriptions written by whoever entered the receipt,
// in mixed units — ลูก (piece), ลัง / ตะกร้า (crate/basket), โล / กิโล (kg). This parses what
// it can and reports the rest as unparsed rather than guessing: a wrong unit is worse
// than a missing one.
//
// Read-only.
const path = require('path');
const d = require(path.join(__dirname, '..', 'data.json'));

const MONTHS = ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26'];
const FRUITS = ['Orange', 'Watermelon', 'Mango', 'Apple', 'Coconut', 'Guava', 'Pineapple'];

// The orange supplier writes crate-maths inline: "ส้ม 30x22กก 660กกx30" is 30 crates of
// 22 kg = 660 kg at ฿30/kg. A plain "(\d+)\s*กก" grabs the 22 and undercounts by 30x, so
// the compound forms must be tried first.
const COMPOUND = [
  [/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*(?:กก|กิโล|โล)/, (a, b) => a * b],  // 30x22กก
  [/(\d+(?:\.\d+)?)\s*(?:กก|กิโล|โล)\s*[xX×]/, (a) => a],                            // 660กกx30
];

// unit -> canonical bucket. ลัง and ตะกร้า are used interchangeably by this supplier.
const UNITS = [
  [/(\d+(?:\.\d+)?)\s*(?:ลัง|ตะกร้า)/, 'ลัง'],
  [/(\d+(?:\.\d+)?)\s*(?:กิโลกรัม|กิโล|โล|กก\.?)/, 'กก.'],
  [/(\d+(?:\.\d+)?)\s*ลูก/, 'ลูก'],
];

// Delivery-only rows carry no fruit; counting them as purchases inflates ฿/unit.
const FREIGHT = /ค่าส่ง|ขนส่ง|lalamove|ลาลามูฟ/i;

// Owner-confirmed 2026-08-28: one orange ลัง / ตะกร้า is 22 kg. Normalising lets the
// whole year be compared — the supplier switched from selling by crate (Jan-Apr) to
// selling by kilo (May-Jul), so unconverted ฿/unit is not comparable across that break.
const TO_KG = { Orange: { 'ลัง': 22 } };

function parseQty(desc, fruit) {
  const s = String(desc || '');
  for (const [re, calc] of COMPOUND) {
    const m = s.match(re);
    if (m) return { qty: calc(parseFloat(m[1]), parseFloat(m[2])), unit: 'กก.' };
  }
  for (const [re, unit] of UNITS) {
    const m = s.match(re);
    if (!m) continue;
    const qty = parseFloat(m[1]);
    const factor = TO_KG[fruit]?.[unit];
    return factor ? { qty: qty * factor, unit: 'กก.' } : { qty, unit };
  }
  return null;
}

const f = (n) => Math.round(n).toLocaleString('en-US');
const agg = {};   // fruit -> month -> { baht, units:{unit:qty}, freight, unparsed }

for (const e of d.expenses) {
  if (!FRUITS.includes(e.cat) || !(e.amt > 0)) continue;
  const a = (agg[e.cat] = agg[e.cat] || {});
  const m = (a[e.month] = a[e.month] || { baht: 0, units: {}, freight: 0, unparsed: 0, rows: 0 });
  m.baht += e.amt;
  m.rows++;
  // Quantity first. Many rows bundle fruit and its delivery in one line
  // ("ค่าส้ม 5720 ค่าส่งส้ม 960") — testing FREIGHT first threw the whole row away.
  // A row is freight-only when it names no quantity AND mentions delivery.
  const q = parseQty(e.desc, e.cat);
  if (q) { m.units[q.unit] = (m.units[q.unit] || 0) + q.qty; continue; }
  if (FREIGHT.test(e.desc || '')) { m.freight += e.amt; continue; }
  m.unparsed += e.amt;
}

for (const fruit of FRUITS) {
  const a = agg[fruit];
  if (!a) continue;
  console.log(`\n=== ${fruit} ===`);
  console.log('เดือน     ยอดซื้อ   ค่าส่ง  แกะไม่ได้   จำนวนที่ซื้อ            ฿/หน่วย');
  let tb = 0, tf = 0, tu = 0;
  const totUnits = {};
  for (const mo of MONTHS) {
    const m = a[mo];
    if (!m) continue;
    tb += m.baht; tf += m.freight; tu += m.unparsed;
    const qty = Object.entries(m.units).map(([u, q]) => `${+q.toFixed(1)} ${u}`).join(' + ') || '-';
    Object.entries(m.units).forEach(([u, q]) => (totUnits[u] = (totUnits[u] || 0) + q));
    // ฿/unit only when a single unit was used and the whole spend is attributable
    const keys = Object.keys(m.units);
    const net = m.baht - m.freight - m.unparsed;
    const per = keys.length === 1 && net > 0 ? `${f(net / m.units[keys[0]])} /${keys[0]}` : '-';
    console.log(
      mo.padEnd(8),
      f(m.baht).padStart(8), f(m.freight).padStart(7), f(m.unparsed).padStart(9), '  ',
      qty.padEnd(22), per
    );
  }
  const allQty = Object.entries(totUnits).map(([u, q]) => `${+q.toFixed(1)} ${u}`).join(' + ') || '-';
  console.log('รวม     ', f(tb).padStart(8), f(tf).padStart(7), f(tu).padStart(9), '  ', allQty);
  if (tu > 0) console.log(`  ⚠ แกะจำนวนไม่ได้ ฿${f(tu)} (${(100 * tu / tb).toFixed(0)}% ของยอดซื้อ) — คำอธิบายไม่ได้บอกจำนวน`);
}

// Roll-up: what share of fruit spend can be tied to a quantity at all
let B = 0, U = 0, F2 = 0;
for (const fruit of FRUITS)
  for (const mo of MONTHS) {
    const m = agg[fruit]?.[mo];
    if (m) { B += m.baht; U += m.unparsed; F2 += m.freight; }
  }
console.log(`\n=== สรุป ===`);
console.log(`ยอดซื้อผลไม้ทั้งหมด   ฿${f(B)}`);
console.log(`  ค่าส่ง (ไม่ใช่ผลไม้)  ฿${f(F2)}`);
console.log(`  แกะจำนวนไม่ได้       ฿${f(U)}  (${(100 * U / B).toFixed(0)}%)`);
console.log(`  แกะจำนวนได้          ฿${f(B - U - F2)}  (${(100 * (B - U - F2) / B).toFixed(0)}%)`);
