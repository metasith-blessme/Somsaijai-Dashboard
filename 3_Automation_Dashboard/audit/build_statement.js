// Build a running cash statement in the owner's sample format:
//   วันที่ | สาขา | รายละเอียด | ประเภท | รายรับ | รายจ่าย | ยอดรวม
// One shared Somsaijai account, branch tagged per row. Output: CSV to paste into the Google Sheet.
//
// This is a CASH statement, not a P&L. Owner distributions ARE money out — that is the
// whole point: a P&L cannot show why the account is empty, a running balance can.
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SRC = require('./gsheet_source.json');
const { dailyRows, parseDate } = require('./sheet_rows');
const BRANCHES = ['B1', 'B2', 'B3'];

// ponytail: opening balance is a CLI arg, not config. Owner's sheet shows ต้นทุน 100,000.
// Override once the real 1-Jan bank figure is known: node build_statement.js 123456
const OPENING = Number(process.argv[2] ?? SRC._opening_capital.capital_injected);

// Profit-share rows wrongly filed as COGS/Ice. Excluded here so they are not double-counted
// against the explicit distribution entries below.
const MISFILED_DISTRIBUTIONS = new Set(['ส่วนแบ่ง60เปอ', 'ค่าส่วนแบ่งกำไรเมน 40เปอ']);

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDate = (key) => { const [y, m, d] = key.split('-'); return `${d}/${m}/${y}`; };

const entries = [];
const add = (dateKey, branch, desc, type, inAmt, outAmt) =>
  entries.push({ dateKey, branch, desc, type, in: inAmt || 0, out: outAmt || 0 });

const MONTHS = ['Jan26','Feb26','Mar26','Apr26','May26','Jun26','Jul26','Aug26'];

for (const branch of BRANCHES) {
  const file = path.join(__dirname, '..', `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) continue;
  const wb = XLSX.readFile(file);

  // --- Money in: daily sales, split cash vs transfer ---
  for (const month of MONTHS) {
    const sheet = wb.Sheets[month];
    if (!sheet) continue;
    for (const row of dailyRows(sheet)) {
      const key = row.date.key;
      const { cash, scan, revenue: rev } = row;
      if (cash) add(key, branch, 'ยอดขายเงินสด', 'Sales-Cash', cash, 0);
      if (scan) add(key, branch, 'ยอดขายเงินโอน', 'Sales-Transfer', scan, 0);
      // Jan/Feb B1 have revenue but no split recorded — book the remainder so the
      // balance stays honest instead of silently losing the money.
      const unsplit = Math.round(rev - cash - scan);
      if (unsplit !== 0) add(key, branch, 'ยอดขาย (ยังไม่แยกสด/โอน)', 'Sales-Unsplit', unsplit, 0);
    }
  }

  // --- Money out: every expense row in the ledger ---
  const de = wb.Sheets['Daily_Expenses'];
  if (de) {
    for (const r of XLSX.utils.sheet_to_json(de, { header: 1 }).slice(3)) {
      const d = parseDate(r[0]);
      const amt = Number(r[5]) || 0;
      if (!d || !amt) continue;
      const key = d.key;
      const desc = String(r[4] ?? '').trim();
      if (MISFILED_DISTRIBUTIONS.has(desc)) continue;
      add(key, branch, desc || String(r[3] ?? 'ไม่ระบุ'), String(r[2] ?? 'OPEX'), 0, amt);
    }
  }
}

// --- Money out: owner distributions (the liquidity leak, stated explicitly) ---
// Paid on the 2nd of the following month, matching the 02/01/2026 entry found in B1.
const PAYOUT_DATE = { Dec25: '2026-01-02', Jan26: '2026-02-02', Feb26: '2026-03-02', Mar26: '2026-04-02' };
for (const [month, v] of Object.entries(SRC._distributions)) {
  if (month.startsWith('_')) continue;
  const key = PAYOUT_DATE[month];
  if (!key) continue;
  add(key, 'B1', `ส่วนแบ่งกำไร Blessme 60% (${month})`, 'DISTRIBUTION', 0, v.blessme);
  add(key, 'B1', `ส่วนแบ่งกำไร Ming 40% (${month})`, 'DISTRIBUTION', 0, v.ming);
}

entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.branch.localeCompare(b.branch));

// --- Running balance ---
let balance = OPENING;
const rows = [['วันที่', 'สาขา', 'รายละเอียด', 'ประเภท', 'รายรับ', 'รายจ่าย', 'ยอดรวม']];
rows.push(['', '', 'ยอดยกมา (Opening balance)', 'OPENING', OPENING, '', OPENING]);
let minBal = { bal: balance, date: 'opening' };
for (const e of entries) {
  balance += e.in - e.out;
  if (balance < minBal.bal) minBal = { bal: balance, date: fmtDate(e.dateKey) };
  rows.push([fmtDate(e.dateKey), e.branch, e.desc, e.type, e.in || '', e.out || '', Math.round(balance * 100) / 100]);
}

const csv = rows.map((r) => r.map((c) => {
  const s = String(c ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}).join(',')).join('\n');

const outFile = path.join(__dirname, 'statement.csv');
fs.writeFileSync(outFile, '﻿' + csv, 'utf8');  // BOM so Google Sheets reads Thai correctly

const totalIn = entries.reduce((a, e) => a + e.in, 0);
const totalOut = entries.reduce((a, e) => a + e.out, 0);
const dist = entries.filter((e) => e.type === 'DISTRIBUTION').reduce((a, e) => a + e.out, 0);
const unsplit = entries.filter((e) => e.type === 'Sales-Unsplit').reduce((a, e) => a + e.in, 0);
const f = (n) => Math.round(n).toLocaleString('en-US');

console.log(`Wrote ${outFile}  (${entries.length} entries)`);
console.log(`Opening balance      : ${f(OPENING)}${process.argv[2] ? '' : '   << ASSUMED from ต้นทุน 100,000 — replace with real 1-Jan figure'}`);
console.log(`Total in             : ${f(totalIn)}   (of which unsplit cash/transfer: ${f(unsplit)})`);
console.log(`Total out            : ${f(totalOut)}   (of which owner distributions: ${f(dist)})`);
console.log(`Closing balance      : ${f(balance)}`);
console.log(`Lowest point         : ${f(minBal.bal)} on ${minBal.date}`);
console.log(`Balance without distributions would be: ${f(balance + dist)}`);

// One runnable check: the running balance must be arithmetically sound.
(function selfCheck() {
  const assert = require('assert');
  assert.strictEqual(Math.round(balance), Math.round(OPENING + totalIn - totalOut),
    'running balance must equal opening + in - out');
  const last = rows[rows.length - 1];
  assert.strictEqual(Math.round(Number(last[6])), Math.round(balance),
    'final CSV row must carry the final balance');
  assert.ok(!entries.some((e) => e.in && e.out), 'no entry may be both money in and money out');
})();
