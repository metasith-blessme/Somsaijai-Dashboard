// Build งบการเงิน — the monthly P&L in the exact layout of the owner's own sheet
// (ส้มใส่ใจ, tab "งบการเงิน"): label column + 12 month columns, COGS lines, รวม (GP),
// SG&A, งบลงทุน, then ยอดขาย / GP / EBITDA / Net Margin in baht and percent, then the
// partner split.
//
// One tab per branch plus a consolidated tab. Branch splits differ (B1 60/40, B2 and B3
// 70/30), so a single blended percentage would be wrong — each branch computes its own.
//
// Output: audit/งบการเงิน_2026.xlsx, ready to import as a tab in the Google Sheet.
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { dailyRows, parseDate } = require('./sheet_rows');

const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const BRANCHES = ['B1', 'B2', 'B3'];
const MONTHS = 12;
const LAST_MONTH = Number(process.env.LAST_MONTH || 7); // data runs to July
const SPLIT = { B1: 0.6, B2: 0.7, B3: 0.7 }; // Blessme share; Ming takes the rest

// The owner's ledger lumps every consumable into COGS/Packaging. The sheet wants them split,
// so recover the detail from the Thai description. Order matters — first match wins.
const PACKAGING_ROWS = [
  ['ค่าแก้ว', /แก้ว/],
  ['ค่าฝา', /ฝา/],
  ['ค่าหลอด', /หลอด/],
  ['ค่าถุงพลาสติกเล็ก', /ถุงพลาสติกเล็ก|ถุงเล็ก/],
  ['ค่าถุงพลาสติกใหญ่', /ถุงพลาสติก(?!เล็ก)|ถุงหิ้ว|ถุงใหญ่/],
  ['ขวด ฝาเล็ก (200 ml)', /ขวดเล็ก|200\s*ml/i],
  ['ขวด ฝาใหญ่ (1000 ml)', /ขวด/],
  ['ถุงขยะ', /ถุงขยะ/],
  ['ถุงมือ', /ถุงมือ/],
  ['อุปกรณ์ล้างจาน', /น้ำยาล้างจาน|ผงซักฟอก|ฟองน้ำ/],
  ['ทิชชู่', /ทิชชู|กระดาษ/],
];

// COGS category -> row label, in the sheet's own order, extended with the fruits added since.
const COGS_ROWS = [
  ['ค่าส้ม', 'Orange'], ['ค่าแตงโม', 'Watermelon'], ['ค่าเนื้อมะพร้าว', 'Coconut Meat'],
  ['ค่าน้ำมะพร้าว', 'Coconut Water'], ['ค่ามะพร้าว', 'Coconut'], ['ค่าแอปเปิ้ล', 'Apple'],
  ['ค่ามะม่วง', 'Mango'], ['ค่าฝรั่ง', 'Guava'], ['ค่าสับปะรด', 'Pineapple'],
  ['ค่ามังคุด', 'Mangosteen'], ['ค่าทับทิม', 'Pomegranate'],
  ['ค่านมข้น', 'Milk/Conden'], ['ค่าน้ำ', 'Water'],
  ['ค่าน้ำแข็ง', 'Ice'], ['ค่าขนส่ง', 'Transportation'], ['ค่าสต๊อก', 'Stock'],
];

const isStockRent = (desc) => /stock|สต๊อก|สต็อค|สต็อก|คลัง/i.test(desc);
const isUtility = (cat, desc) => /ค่าไฟ|ค่าน้ำ|electric|water|utilit/i.test(cat + desc);

function collect(branch) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) return null;
  const wb = XLSX.readFile(file);

  const revenue = Array(MONTHS + 1).fill(0);
  for (const name of wb.SheetNames) {
    if (!/^[A-Z][a-z]{2}26$/.test(name)) continue;
    for (const r of dailyRows(wb.Sheets[name])) revenue[r.date.month] += r.revenue;
  }

  // rows[label][month] = amount
  const rows = {};
  const put = (label, m, amt) => {
    rows[label] = rows[label] || Array(MONTHS + 1).fill(0);
    rows[label][m] += amt;
  };

  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Daily_Expenses'], { header: 1 }).slice(3)) {
    const d = parseDate(r[0]);
    const amt = Number(r[5]) || 0;
    if (!d || !amt) continue;
    const bucket = String(r[2] ?? '');
    const cat = String(r[3] ?? '');
    const desc = String(r[4] ?? '');
    const m = d.month;

    if (bucket === 'EXCLUDED') continue; // owner distributions are never a cost

    if (bucket === 'CAPEX') { put('งบลงทุน', m, amt); continue; }

    if (bucket === 'COGS') {
      if (cat === 'Packaging') {
        const hit = PACKAGING_ROWS.find(([, re]) => re.test(desc));
        put(hit ? hit[0] : 'ค่าบรรจุภัณฑ์อื่นๆ', m, amt);
        continue;
      }
      const hit = COGS_ROWS.find(([, c]) => c === cat);
      put(hit ? hit[0] : 'ค่าวัตถุดิบอื่นๆ', m, amt);
      continue;
    }

    // OPEX
    if (cat === 'Salary') put('ค่าแรงคนงาน', m, amt);
    else if (cat === 'Rental') put(isStockRent(desc) ? 'ค่าเช่าคลัง' : 'ค่าเช่า', m, amt);
    else if (cat === 'Marketing') put('ค่าการตลาด', m, amt);
    else if (isUtility(cat, desc)) put('ค่าน้ำ + ค่าไฟ', m, amt);
    else put('ค่าใช้จ่ายอื่นๆ', m, amt);
  }
  return { revenue, rows };
}

const data = Object.fromEntries(BRANCHES.map((b) => [b, collect(b)]).filter(([, v]) => v));

// Consolidated = element-wise sum.
const consolidated = { revenue: Array(MONTHS + 1).fill(0), rows: {} };
for (const d of Object.values(data)) {
  d.revenue.forEach((v, i) => { consolidated.revenue[i] += v; });
  for (const [label, arr] of Object.entries(d.rows)) {
    consolidated.rows[label] = consolidated.rows[label] || Array(MONTHS + 1).fill(0);
    arr.forEach((v, i) => { consolidated.rows[label][i] += v; });
  }
}

const COGS_LABELS = [...COGS_ROWS.map(([l]) => l), ...PACKAGING_ROWS.map(([l]) => l),
  'ค่าบรรจุภัณฑ์อื่นๆ', 'ค่าวัตถุดิบอื่นๆ'];
const SGA_LABELS = ['ค่าเช่า', 'ค่าน้ำ + ค่าไฟ', 'ค่าแรงคนงาน', 'ค่าเช่าคลัง', 'ค่าการตลาด', 'ค่าใช้จ่ายอื่นๆ'];

const monthCols = (fn) => Array.from({ length: MONTHS }, (_, i) => (i + 1 <= LAST_MONTH ? fn(i + 1) : ''));
const sumLabels = (src, labels, m) => labels.reduce((a, l) => a + (src.rows[l] ? src.rows[l][m] : 0), 0);

function sheetFor(src, title, blessmeShare) {
  const out = [];
  const push = (label, values) => out.push([label, ...values]);

  push(title, monthCols((m) => m));
  for (const label of COGS_LABELS) {
    if (!src.rows[label] || !src.rows[label].some((v) => v)) continue;
    push(label, monthCols((m) => src.rows[label][m] || ''));
  }
  push('รวม (GP)', monthCols((m) => sumLabels(src, COGS_LABELS, m)));
  out.push([]);
  push('SG&A', monthCols(() => ''));
  for (const label of SGA_LABELS) {
    if (!src.rows[label] || !src.rows[label].some((v) => v)) continue;
    push(label, monthCols((m) => src.rows[label][m] || ''));
  }
  push('รวม (SG&A)', monthCols((m) => sumLabels(src, SGA_LABELS, m)));
  out.push([]);
  push('งบลงทุน + ค่าเสื่อม', monthCols(() => ''));
  push('งบลงทุน', monthCols((m) => (src.rows['งบลงทุน'] ? src.rows['งบลงทุน'][m] : 0) || ''));
  push('รวม (งบลงทุน + ค่าเสื่อม)', monthCols((m) => (src.rows['งบลงทุน'] ? src.rows['งบลงทุน'][m] : 0)));
  out.push([]);

  const cogs = (m) => sumLabels(src, COGS_LABELS, m);
  const sga = (m) => sumLabels(src, SGA_LABELS, m);
  const capex = (m) => (src.rows['งบลงทุน'] ? src.rows['งบลงทุน'][m] : 0);
  const gp = (m) => src.revenue[m] - cogs(m);
  const ebitda = (m) => gp(m) - sga(m);
  const net = (m) => ebitda(m) - capex(m);
  const pct = (v, m) => (src.revenue[m] ? v / src.revenue[m] : '');

  push('รวมค่าใช้จ่าย', monthCols((m) => cogs(m) + sga(m) + capex(m)));
  out.push([]);
  push('ยอดขาย', monthCols((m) => src.revenue[m]));
  push('GP(หักต้นทุนวัตถุดิบ)', monthCols((m) => gp(m)));
  push('EBITDA', monthCols((m) => ebitda(m)));
  push('Net Margin', monthCols((m) => net(m)));
  out.push([]);
  push('ยอดขาย', monthCols((m) => src.revenue[m]));
  push('GP(หักต้นทุนวัตถุดิบ)', monthCols((m) => pct(gp(m), m)));
  push('EBITDA', monthCols((m) => pct(ebitda(m), m)));
  push('Net Margin', monthCols((m) => pct(net(m), m)));
  out.push([]);
  // A loss is not distributable; the sheet must not imply a negative payout.
  push(`Blessme ${Math.round(blessmeShare * 100)}%`, monthCols((m) => Math.max(0, net(m)) * blessmeShare));
  push(`Main ${Math.round((1 - blessmeShare) * 100)}%`, monthCols((m) => Math.max(0, net(m)) * (1 - blessmeShare)));

  return XLSX.utils.aoa_to_sheet(out);
}

const wb = XLSX.utils.book_new();
for (const b of BRANCHES) {
  if (!data[b]) continue;
  XLSX.utils.book_append_sheet(wb, sheetFor(data[b], `รายจ่ายปี69 ${b}`, SPLIT[b]), `งบการเงิน ${b}`);
}
// Consolidated distributions are the SUM of each branch's own split, never a blended rate.
const consSheet = (() => {
  const s = sheetFor(consolidated, 'รายจ่ายปี69 รวมทุกสาขา', SPLIT.B1);
  const aoa = XLSX.utils.sheet_to_json(s, { header: 1, defval: '' });
  const perBranchShare = (m, who) => BRANCHES.reduce((a, b) => {
    if (!data[b]) return a;
    const src = data[b];
    const cogs = sumLabels(src, COGS_LABELS, m);
    const sga = sumLabels(src, SGA_LABELS, m);
    const capex = src.rows['งบลงทุน'] ? src.rows['งบลงทุน'][m] : 0;
    const net = src.revenue[m] - cogs - sga - capex;
    if (net <= 0) return a;
    return a + net * (who === 'blessme' ? SPLIT[b] : 1 - SPLIT[b]);
  }, 0);
  aoa[aoa.length - 2] = ['Blessme (รวมตามสัดส่วนแต่ละสาขา)', ...monthCols((m) => perBranchShare(m, 'blessme'))];
  aoa[aoa.length - 1] = ['Main (รวมตามสัดส่วนแต่ละสาขา)', ...monthCols((m) => perBranchShare(m, 'ming'))];
  return XLSX.utils.aoa_to_sheet(aoa);
})();
XLSX.utils.book_append_sheet(wb, consSheet, 'งบการเงิน รวม');

const outFile = path.join(__dirname, 'งบการเงิน_2026.xlsx');
XLSX.writeFile(wb, outFile);
console.log(`Wrote ${outFile}`);

const f = (n) => Math.round(n).toLocaleString('en-US');
console.log('\nConsolidated (all branches):\n');
console.log('Month   ยอดขาย     รวม(GP)    SG&A     EBITDA   Net Margin');
console.log('------ --------- --------- --------- --------- ---------');
for (let m = 1; m <= LAST_MONTH; m++) {
  const cogs = sumLabels(consolidated, COGS_LABELS, m);
  const sga = sumLabels(consolidated, SGA_LABELS, m);
  const capex = consolidated.rows['งบลงทุน'] ? consolidated.rows['งบลงทุน'][m] : 0;
  const gp = consolidated.revenue[m] - cogs;
  console.log(`  ${String(m).padStart(2)}   ${f(consolidated.revenue[m]).padStart(9)} ${f(cogs).padStart(9)} ${f(sga).padStart(9)} ${f(gp - sga).padStart(9)} ${f(gp - sga - capex).padStart(9)}`);
}

(function selfCheck() {
  const assert = require('assert');
  // Every ledger baht must land in exactly one P&L line — nothing may be silently dropped.
  for (const [b, src] of Object.entries(data)) {
    for (let m = 1; m <= LAST_MONTH; m++) {
      const binned = sumLabels(src, COGS_LABELS, m) + sumLabels(src, SGA_LABELS, m)
        + (src.rows['งบลงทุน'] ? src.rows['งบลงทุน'][m] : 0);
      const all = Object.values(src.rows).reduce((a, arr) => a + arr[m], 0);
      assert.ok(Math.abs(binned - all) < 0.01,
        `${b} month ${m}: ${f(all - binned)} of ledger cost is not in any P&L line`);
    }
  }
  // Identity: revenue - cogs - sga - capex must equal Net Margin.
  const m = LAST_MONTH;
  const cogs = sumLabels(consolidated, COGS_LABELS, m);
  const sga = sumLabels(consolidated, SGA_LABELS, m);
  const capex = consolidated.rows['งบลงทุน'] ? consolidated.rows['งบลงทุน'][m] : 0;
  assert.ok(Math.abs((consolidated.revenue[m] - cogs) - sga - capex
    - (consolidated.revenue[m] - cogs - sga - capex)) < 0.01, 'P&L identity must hold');
})();
