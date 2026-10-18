#!/usr/bin/env node
// Upgrades the B2 Oct26 sheet to the Sep26 column layout (adds Orange (100), Guava, Pineapple, Used*, Bottle cols)
// B2 Oct26 had NO data rows on 2026-10-18 (checked on origin/main 0594016). Dry run by default; --commit writes. Fails closed on anything unexpected.
const XLSX = require('xlsx'); const fs = require('fs'); const path = require('path');
const DIR = process.env.SOMSAIJAI_DASHBOARD_DIR || path.join(__dirname, '..', 'ssj-b2oct', '3_Automation_Dashboard');
const FILE = path.join(DIR, 'SomSaiJai_Dashboard_B2_2026.xlsx');
const COMMIT = process.argv.includes('--commit');
const fail = m => { console.error('FAIL - ' + m + '\nNothing was written.'); process.exit(1); };
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const wb = XLSX.readFile(FILE, { cellStyles: true });
const sep = XLSX.utils.sheet_to_json(wb.Sheets.Sep26, { header: 1, defval: null });
const sepHdr = sep[sep.findIndex(r => r && r.includes('Date'))].map(norm);
const sh = wb.Sheets.Oct26; if (!sh) fail('no Oct26 sheet');
const g = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
const h = g.findIndex(r => r && r.includes('Date')); if (h !== 2) fail('Oct26 header not on row 3');
const hdr = g[h].map(norm);
if (hdr.join('|') === sepHdr.join('|')) { console.log('Oct26 already on Sep26 layout'); }
const data = g.slice(h + 1).filter(r => r && r[0]);
const allowed = [];
const bad = data.filter(r => !allowed.includes(norm(r[0])));
if (bad.length) fail('B2 Oct26 already has rows: ' + bad.map(r => r[0]).join(', ') + ' (a newer bot publish landed; re-check before merging)');
console.log('old header:', hdr.filter(Boolean).length, 'cols -> new header:', sepHdr.length, 'cols (Sep26 layout)');
if (!COMMIT) { console.log('Dry run only.'); process.exit(0); }
const aoa = [[g[0][0]], [], sepHdr];
const ns = XLSX.utils.aoa_to_sheet(aoa);
if (sh['!cols']) ns['!cols'] = wb.Sheets.Sep26['!cols'];
wb.Sheets.Oct26 = ns;
XLSX.writeFile(wb, FILE, { cellStyles: true });
const rb = XLSX.utils.sheet_to_json(XLSX.readFile(FILE).Sheets.Oct26, { header: 1, defval: null });
if (rb[2].map(norm).join('|') !== sepHdr.join('|') || rb.slice(3).some(r => r && r[0])) fail('readback mismatch');
console.log('Oct26 rebuilt on Sep26 layout, readback verified');
