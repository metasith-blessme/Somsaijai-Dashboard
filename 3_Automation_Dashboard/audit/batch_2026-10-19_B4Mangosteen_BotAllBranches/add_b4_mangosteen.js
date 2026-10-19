#!/usr/bin/env node
// Adds "Mangosteen" (cups) and "Mangosteen (฿)" columns after "Pineapple" on B4 Sep26-Dec26 and backfills Sep/Oct.
// Sep26: mangosteen cups had been booked inside "Mango" -> moved out of Mango into Mangosteen (Total Cups unchanged).
// Oct26: mangosteen cups were in Total Cups only -> written to Mangosteen (Mango and Total Cups unchanged).
// Revenue / cash / scan / expenses are never touched. Dry run by default; --commit writes. Fails closed.
const XLSX = require('xlsx'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2]; if (!DIR) { console.error('usage: add_b4_mangosteen.js <3_Automation_Dashboard dir> [--commit]'); process.exit(1); }
const COMMIT = process.argv.includes('--commit');
const FILE = path.join(DIR, 'SomSaiJai_Dashboard_B4_2026.xlsx');
const fail = m => { console.error('FAIL - ' + m + '\nNothing was written.'); process.exit(1); };
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
// ---- source counts
const sepT = require(path.join(DIR, 'audit/batch_2026-10-01_SepSalesExpenses/b4_sales_transcription.json'));
const SEP = {};
for (const r of sepT.records) {
  if (r.is_duplicate_of) continue;
  const dd = r.date.split('-').reverse().join('/');
  let mangosteen = 0, rev = 0, mango = 0;
  for (const i of r.sales_items || []) {
    if (/^mangosteen$/i.test(i.product)) { mangosteen += i.total_qty; rev += i.total_qty * i.price; }
    if (/^mango$/i.test(i.product)) mango += i.total_qty;
  }
  SEP[dd] = { mangosteen, rev, mango };
}
const octS = require('/workspace/b4oct/sheets.json').days;
const OCT = {};
for (const [k, d] of Object.entries(octS)) {
  const dd = (k === 'UNDATED' ? '18' : k) + '/10/2026';
  let mangosteen = 0, rev = 0, mango = 0;
  for (const [n, p, c, s] of d.items) {
    if (/^Mangosteen( no ice)?$/.test(n)) { mangosteen += c + s; rev += p * (c + s); }
    if (/^Mango( no ice)?$/.test(n)) mango += c + s;
  }
  OCT[dd] = { mangosteen, rev, mango };
}
// ---- workbook
const wb = XLSX.readFile(FILE, { cellStyles: true });
const report = []; const plan = [];
for (const m of ['Sep26', 'Oct26', 'Nov26', 'Dec26']) {
  const sh = wb.Sheets[m]; if (!sh) fail('no ' + m);
  const g = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
  const h = g.findIndex(r => r && norm(r[0]) === 'Date'); if (h !== 2) fail(m + ': header not on row 3');
  const hdr = g[h].map(norm);
  if (hdr.includes('Mangosteen')) fail(m + ' already has a Mangosteen column');
  const pi = hdr.indexOf('Pineapple'), mi = hdr.indexOf('Mango'), ti = hdr.indexOf('Total Cups'), ri = hdr.indexOf('Revenue (฿)');
  if (pi !== 15 || mi < 0 || ti !== 16 || hdr.length !== 32) fail(m + ': unexpected layout ' + hdr.join('|'));
  const rows = [];
  for (let r = h + 1; r < g.length; r++) {
    const row = g[r]; if (!row || !row[0]) continue;
    const d = norm(row[0]);
    const src = m === 'Sep26' ? SEP[d] : m === 'Oct26' ? OCT[d] : null;
    if (!src) fail(`${m} ${d}: no source counts`);
    const mg = Number(row[mi]) || 0, tot = Number(row[ti]) || 0;
    let newMg = mg;
    if (m === 'Sep26') { // mango column held mango + mangosteen
      if (mg !== src.mango + src.mangosteen) fail(`${m} ${d}: Mango ${mg} != mango ${src.mango} + mangosteen ${src.mangosteen}`);
      newMg = src.mango;
    } else if (mg !== src.mango) fail(`${m} ${d}: Mango ${mg} != sheet mango ${src.mango}`);
    rows.push({ r, d, rev: row[ri], mg, newMg, tot, mangosteen: src.mangosteen, mrev: src.rev });
  }
  if (m === 'Sep26' && rows.length !== 10) fail('Sep26 row count ' + rows.length);
  if (m === 'Oct26' && rows.length !== 18) fail('Oct26 row count ' + rows.length);
  plan.push({ m, sh, h, mi, rows });
  const s = k => rows.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  report.push(`${m}: ${rows.length} rows, revenue ${s('rev')} (unchanged), mangosteen ${s('mangosteen')} cups / ฿${s('mrev')}, Mango ${s('mg')} -> ${s('newMg')}, Total Cups ${s('tot')} (unchanged)`);
}
console.log(report.join('\n'));
for (const p of plan) for (const x of p.rows) if (x.mangosteen || x.mg !== x.newMg) console.log(`  ${p.m} ${x.d}: mangosteen ${x.mangosteen} (฿${x.mrev})${x.mg !== x.newMg ? `, Mango ${x.mg}->${x.newMg}` : ''}`);
if (!COMMIT) { console.log('Dry run only.'); process.exit(0); }
// ---- write: shift columns >= 16 two to the right, write header + values
const INS = 16;
for (const p of plan) {
  const sh = p.sh; const rg = XLSX.utils.decode_range(sh['!ref']);
  for (let R = rg.s.r; R <= rg.e.r; R++) {
    for (let C = rg.e.c; C >= INS; C--) {
      const from = XLSX.utils.encode_cell({ r: R, c: C }), to = XLSX.utils.encode_cell({ r: R, c: C + 2 });
      if (sh[from]) { sh[to] = sh[from]; delete sh[from]; } else delete sh[to];
    }
  }
  rg.e.c += 2; sh['!ref'] = XLSX.utils.encode_range(rg);
  const hc = sh[XLSX.utils.encode_cell({ r: p.h, c: 15 })];
  sh[XLSX.utils.encode_cell({ r: p.h, c: INS })] = { t: 's', v: 'Mangosteen', s: hc && hc.s };
  sh[XLSX.utils.encode_cell({ r: p.h, c: INS + 1 })] = { t: 's', v: 'Mangosteen (฿)', s: hc && hc.s };
  for (const x of p.rows) {
    sh[XLSX.utils.encode_cell({ r: x.r, c: INS })] = { t: 'n', v: x.mangosteen };
    sh[XLSX.utils.encode_cell({ r: x.r, c: INS + 1 })] = { t: 'n', v: x.mrev };
    if (x.newMg !== x.mg) sh[XLSX.utils.encode_cell({ r: x.r, c: p.mi })] = { t: 'n', v: x.newMg };
  }
}
XLSX.writeFile(wb, FILE, { cellStyles: true });
// ---- readback
const rb = XLSX.readFile(FILE);
for (const p of plan) {
  const g = XLSX.utils.sheet_to_json(rb.Sheets[p.m], { header: 1, defval: null }); const hdr = g[2].map(norm);
  if (hdr[16] !== 'Mangosteen' || hdr[17] !== 'Mangosteen (฿)' || hdr[18] !== 'Total Cups' || hdr.length !== 34) fail('readback header ' + p.m);
  for (const x of p.rows) { const row = g[x.r]; if (row[16] !== x.mangosteen || row[17] !== x.mrev || row[18] !== x.tot || row[2] !== x.rev || (Number(row[p.mi]) || 0) !== x.newMg) fail('readback ' + p.m + ' ' + x.d); }
}
console.log('written + readback verified');
