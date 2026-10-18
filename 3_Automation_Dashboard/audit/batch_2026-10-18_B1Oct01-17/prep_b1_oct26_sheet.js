#!/usr/bin/env node
// Upgrades the B1 Oct26 sheet to the Sep26 column layout (adds Orange (100), Guava, Pineapple, Used*, Bottle cols)
// and removes the bot's partial 01/10/2026 row (revenue/cash/scan only, no cups, no ice) so the full
// photo row can replace it. Dry run by default; --commit writes. Fails closed on anything unexpected.
const XLSX = require('xlsx'); const fs = require('fs'); const path = require('path');
const DIR = process.env.SOMSAIJAI_DASHBOARD_DIR || path.join(__dirname, '..', 'ssj-b1oct', '3_Automation_Dashboard');
const FILE = path.join(DIR, 'SomSaiJai_Dashboard_B1_2026.xlsx');
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
const allowed = ['01/10/2026'];
const bad = data.filter(r => !allowed.includes(norm(r[0])));
if (bad.length) fail('Oct26 has rows other than the bot 01/10 row: ' + bad.map(r => r[0]).join(', ') + ' (a newer bot publish landed; re-check before merging)');
const one = data.find(r => norm(r[0]) === '01/10/2026');
if (one) {
  const c = {}; hdr.forEach((x, i) => c[x] = i);
  if (one[c['Revenue (฿)']] !== 5635 || one[c['Cash (฿)']] !== 3435) fail('01/10 row is not the expected bot row (5635/3435)');
  console.log('will drop bot row 01/10/2026:', JSON.stringify(one));
}
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
