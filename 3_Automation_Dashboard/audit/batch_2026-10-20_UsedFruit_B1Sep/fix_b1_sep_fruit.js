#!/usr/bin/env node
// B1 Sep26: re-book cups from the Sep transcription (b1_sales_transcription.json) with the sheet's own words.
// commit_sep26.js checked "apple" before "pineapple" (pineapple -> Apple) and booked "Water"(55)/"Volcano water"(109)
// as Coconut. This replays the old mapping to prove each current cell came from it, then writes the corrected split.
// Revenue, cash, QR, expenses and Total Cups do not change. Fails closed.
const XLSX = require('xlsx'); const fs = require('fs'); const path = require('path');
const DIR = process.argv[2]; const COMMIT = process.argv.includes('--commit');
const FILE = path.join(DIR, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const T = JSON.parse(fs.readFileSync(path.join(DIR, 'audit/batch_2026-10-01_SepSalesExpenses/b1_sales_transcription.json'))).transcriptions;
const fail = m => { console.error('FAIL - ' + m + '\nNothing was written.'); process.exit(1); };
function oldMap(p) { // exactly commit_sep26.js B1 order
  if (p === 'orange' || p === 'orange cup (regular)') return 'or'; if (p === 'orange premium cup 100%') return 'or_100';
  if (p.includes('watermelon')) return 'wm'; if (p.includes('mango') && !p.includes('mangosteen')) return 'mg';
  if (p.includes('coconut') || p.includes('coco') || p.includes('volcano water') || p === 'water') return 'co';
  if (p.includes('apple')) return 'ap'; if (p.includes('young')) return 'yco'; if (p.includes('guava')) return 'guava';
  if (p.includes('pineapple') || p.includes('สับปะรด')) return 'pi'; return null;
}
function newMap(p) { // what the sheet says: pineapple before apple; "water"/"volcano water" is watermelon (55 / 109)
  if (p.includes('pineapple') || p.includes('สับปะรด')) return 'pi';
  if (p === 'water' || p.includes('volcano water')) return 'wm';
  return oldMap(p);
}
const COLS = { wm: ['Watermelon', 'Used Watermelon (pcs)'], co: ['Coconut', 'Used Coco (Raw)'], ap: ['Apple', 'Used Apple'], pi: ['Pineapple', 'Used Pineapple'] };
const wb = XLSX.readFile(FILE, { cellStyles: true }); const sh = wb.Sheets.Sep26;
const g = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null }); const hi = g.findIndex(r => r && r[0] === 'Date'); const hdr = g[hi];
const col = h => { const i = hdr.indexOf(h); if (i < 0) fail('no column ' + h); return i; };
const mism = []; const changes = []; const sums = { old: {}, new: {} };
for (const t of T) {
  const d = t.header.date_norm; const srcCol = col('Source Note');
  const ri = g.findIndex((r, i) => i > hi && r && r[0] === d && r[srcCol] === t.filename);
  if (ri < 0) { console.log(`skip ${t.filename} (${d}): no Sep26 row was booked from this photo`); continue; }
  const o = {}, n = {};
  for (const r of t.menu_rows || []) { const p = (r.product || '').toLowerCase(); const q = r.total_qty || (r.cash_qty + r.scan_qty) || 0;
    const a = oldMap(p), b = newMap(p); if (a) o[a] = (o[a] || 0) + q; if (b) n[b] = (n[b] || 0) + q; }
  for (const k of Object.keys(COLS)) {
    for (const h of COLS[k]) { const cur = Number(g[ri][col(h)]) || 0; if (cur !== (o[k] || 0)) mism.push(`${d} ${h} is ${cur}, old mapping gives ${o[k] || 0}`); }
    sums.old[k] = (sums.old[k] || 0) + (o[k] || 0); sums.new[k] = (sums.new[k] || 0) + (n[k] || 0);
    if ((o[k] || 0) !== (n[k] || 0)) for (const h of COLS[k]) changes.push([ri, col(h), d, h, o[k] || 0, n[k] || 0]);
  }
  const moved = Object.keys(COLS).reduce((s, k) => s + (n[k] || 0) - (o[k] || 0), 0); if (moved !== 0) fail(d + ' cups not conserved');
}
if (mism.length) { console.log(mism.join("\n")); fail(mism.length + " cells differ from the old mapping"); }
for (const c of changes) console.log(`${c[2]} ${c[3]}: ${c[4]} -> ${c[5]}`);
console.log('month old', JSON.stringify(sums.old), 'new', JSON.stringify(sums.new), '|', changes.length, 'cells');
if (!COMMIT) { console.log('Dry run only.'); process.exit(0); }
for (const [r, c, , , , v] of changes) sh[XLSX.utils.encode_cell({ r, c })] = { t: 'n', v };
XLSX.writeFile(wb, FILE, { cellStyles: true });
const rb = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets.Sep26, { header: 1, defval: null });
for (const [r, c, , , , v] of changes) if (rb[r][c] !== v) fail('readback');
console.log('written + readback verified');
