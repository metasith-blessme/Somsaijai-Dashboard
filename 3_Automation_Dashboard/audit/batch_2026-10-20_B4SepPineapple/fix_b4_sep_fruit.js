#!/usr/bin/env node
// Fix B4 Sep26 fruit columns from the original Sep photos (B4/sale/Sep26). Parn approved 20/10/2026.
// Only cup/"Used" fruit cells change; revenue, cash, scan, expenses, Total Cups and mangosteen stay. Fails closed.
const XLSX = require('xlsx'); const path = require('path');
const DIR = process.argv[2]; const COMMIT = process.argv.includes('--commit');
const FILE = path.join(DIR, 'SomSaiJai_Dashboard_B4_2026.xlsx');
const fail = m => { console.error('FAIL - ' + m + '\nNothing was written.'); process.exit(1); };
// [date, header, from, to, photo, reason]
const P = n => `LINE_ALBUM_Sales for September (B-4)_261002_${n}.jpg`;
const ALL = [
  ['20/09/2026', 'Used Mango', 1, 0, P(10), 'mangosteen had been counted as mango usage (no mango sold)'],
  ['21/09/2026', 'Used Mango', 2, 0, P(11), 'same'],
  ['22/09/2026', 'Used Mango', 2, 0, P(8), 'same'],
  ['23/09/2026', 'Used Mango', 4, 0, P(7), 'same'],
  ['25/09/2026', 'Apple', 2, 0, P(5), 'sheet: Pineapple 1 cash + 1 scan, no apple'],
  ['25/09/2026', 'Pineapple', 0, 2, P(5), ''],
  ['25/09/2026', 'Used Apple', 2, 0, P(5), ''], ['25/09/2026', 'Used Pineapple', 0, 2, P(5), ''], ['25/09/2026', 'Used Mango', 1, 0, P(5), 'mangosteen, not mango'],
  ['27/09/2026', 'Apple', 4, 0, P(4), 'sheet: Pineapple 2 cash + 2 scan, no apple'],
  ['27/09/2026', 'Pineapple', 0, 4, P(4), ''],
  ['27/09/2026', 'Used Apple', 4, 0, P(4), ''], ['27/09/2026', 'Used Pineapple', 0, 4, P(4), ''], ['27/09/2026', 'Used Mango', 4, 0, P(4), 'mangosteen, not mango'],
  ['28/09/2026', 'Apple', 1, 0, P(3), 'sheet: Pineapple 1 scan, no apple'],
  ['28/09/2026', 'Pineapple', 0, 1, P(3), ''],
  ['28/09/2026', 'Used Apple', 1, 0, P(3), ''], ['28/09/2026', 'Used Pineapple', 0, 1, P(3), ''], ['28/09/2026', 'Used Mango', 11, 4, P(3), 'mango 4; the 7 mangosteen are in Mangosteen'],
  ['29/09/2026', 'Apple', 4, 0, P(2), 'sheet: Pineapple 2 cash + 1 scan; the "apple 1" tally is in the Mango row (QR 797 needs 90)'],
  ['29/09/2026', 'Pineapple', 0, 3, P(2), ''],
  ['29/09/2026', 'Mango', 0, 1, P(2), 'Mango 1 scan'],
  ['29/09/2026', 'Used Apple', 4, 0, P(2), ''], ['29/09/2026', 'Used Pineapple', 0, 3, P(2), ''], ['29/09/2026', 'Used Mango', 8, 1, P(2), ''],
  ['30/09/2026', 'Coconut', 5, 0, P(1), 'row 5 "Coconut" crossed out, written "Volcano Water(melon)" 109: 3 cash + 2 scan'],
  ['30/09/2026', 'Watermelon', 9, 14, P(1), '9 watermelon + 5 volcano watermelon (109)'],
  ['30/09/2026', 'Used Coco (Raw)', 5, 0, P(1), ''], ['30/09/2026', 'Used Watermelon (pcs)', 9, 14, P(1), ''], ['30/09/2026', 'Used Mango', 7, 2, P(1), 'mango 2; the 5 mangosteen are in Mangosteen'],
];
// Cups only: the Used-* cells drive the shared COGS split across branches, so they are left for Parn to decide.
const CH = ALL.filter(c => !c[1].startsWith('Used '));
const FRUIT = ['Orange', 'Orange (100)', 'Watermelon', 'Mango', 'Coconut', 'Apple', 'Young Coco', 'Guava', 'Pineapple', 'Mangosteen'];
const wb = XLSX.readFile(FILE, { cellStyles: true }); const sh = wb.Sheets.Sep26;
const g = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null }); const hdr = g[2];
const col = h => { const i = hdr.indexOf(h); if (i < 0) fail('no column ' + h); return i; };
const rowOf = d => { const r = g.findIndex((x, i) => i > 2 && x && x[0] === d); if (r < 0) fail('no row ' + d); return r; };
for (const [d, h, from, to] of CH) { const v = Number(g[rowOf(d)][col(h)]) || 0; if (v !== from) fail(`${d} ${h} is ${v}, expected ${from}`); g[rowOf(d)][col(h)] = to; }
// fruit cups must still add up to Total Cups on every changed day
for (const d of [...new Set(CH.map(c => c[0]))]) { const r = g[rowOf(d)]; const s = FRUIT.filter(f => f !== 'Orange (100)').reduce((t, f) => t + (Number(r[col(f)]) || 0), 0); if (s !== r[col('Total Cups')]) fail(`${d}: fruit ${s} != Total Cups ${r[col('Total Cups')]}`); }
for (const c of CH) console.log(`${c[0]} ${c[1]}: ${c[2]} -> ${c[3]}${c[5] ? '  (' + c[5] + ')' : ''}`);
console.log(CH.length, 'cells; every changed day: fruit cups = Total Cups');
if (!COMMIT) { console.log('Dry run only.'); process.exit(0); }
for (const [d, h, , to] of CH) sh[XLSX.utils.encode_cell({ r: rowOf(d), c: col(h) })] = { t: 'n', v: to };
XLSX.writeFile(wb, FILE, { cellStyles: true });
const rb = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets.Sep26, { header: 1, defval: null });
for (const [d, h, , to] of CH) if (rb[rowOf(d)][col(h)] !== to) fail('readback ' + d + ' ' + h);
console.log('written + readback verified');
