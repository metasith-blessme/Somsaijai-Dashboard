#!/usr/bin/env node
/*
 * safe_import_sales.js — write approved daily sales rows into a branch month sheet.
 *
 * Same safety contract as safe_import_expenses.js (OCR_RULES §7):
 *   preflight fail-closed → backup + hash → dry run → write → readback → receipt → idempotent.
 *
 *   node safe_import_sales.js <sales_change_list.json>            # dry run
 *   node safe_import_sales.js <sales_change_list.json> --commit
 *
 * Unknown is not zero. Cash and Scan are written as EMPTY cells when the source does not
 * record them, never as 0 — update_dashboard.js only derives scan from revenue when cash
 * was actually recorded, so an empty pair stays unknown instead of becoming "100% scan".
 *
 * Estimated rows are written with their revenue AND a Source Note marking them estimated,
 * so they can be found and replaced when real data arrives.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const NOTE_COL = 'Source Note';
const wbPath = b => path.join(DIR, `SomSaiJai_Dashboard_${b}_2026.xlsx`);
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fail = m => { console.error('\n  FAIL — ' + m + '\n  Nothing was written.\n'); process.exit(1); };
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const clPath = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!clPath || !fs.existsSync(clPath)) fail('usage: node safe_import_sales.js <sales_change_list.json> [--commit]');
const cl = JSON.parse(fs.readFileSync(clPath, 'utf8'));
if (!cl.month || !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}$/.test(cl.month)) fail(`bad month "${cl.month}"`);
if (!Array.isArray(cl.rows) || !cl.rows.length) fail('no rows');

// validate everything before opening a workbook
const seen = new Set();
cl.rows.forEach((r, i) => {
  const at = `row ${i + 1} (${r.branch} ${r.date})`;
  if (!['B1', 'B2', 'B3'].includes(r.branch)) fail(`${at}: bad branch`);
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(r.date)) fail(`${at}: date must be DD/MM/YYYY`);
  const [d, m, y] = r.date.split('/').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== d || dt.getUTCMonth() !== m - 1) fail(`${at}: impossible calendar date`);
  if (typeof r.revenue !== 'number' || !isFinite(r.revenue) || r.revenue < 0) fail(`${at}: bad revenue`);
  if (!norm(r.note)) fail(`${at}: every row needs a source note`);
  if (r.estimated && !/ESTIMATED/i.test(r.note)) fail(`${at}: estimated row must say so in its note`);
  const k = r.branch + '|' + r.date;
  if (seen.has(k)) fail(`${at}: duplicate date for this branch in the change list`);
  seen.add(k);
});

function preflight(branch) {
  const file = wbPath(branch);
  if (!fs.existsSync(file)) fail(`workbook missing: ${file}`);
  const lock = path.join(DIR, '~$' + path.basename(file));
  if (fs.existsSync(lock)) fail(`${path.basename(file)} looks open in Excel (${path.basename(lock)}). Close it; do not delete the lock file.`);

  const wb = XLSX.readFile(file, { cellStyles: true });
  const sh = wb.Sheets[cl.month];
  if (!sh) fail(`${branch}: no ${cl.month} sheet`);
  const grid = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
  const hdrIdx = grid.findIndex(r => r && r.includes('Date'));
  if (hdrIdx === -1) fail(`${branch}/${cl.month}: no header row containing "Date"`);

  const hdr = grid[hdrIdx].map(norm);
  ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)'].forEach(h => { if (!hdr.includes(h)) fail(`${branch}/${cl.month}: missing column "${h}"`); });
  const col = {}; hdr.forEach((h, i) => { if (h) col[h] = i; });

  let noteCol = col[NOTE_COL];
  if (noteCol === undefined) noteCol = hdr.length;          // append a new trailing column

  const existing = new Set();
  for (let i = hdrIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r[0] || ['TOTAL', 'AVG/DAY', 'AVG'].includes(String(r[0]))) continue;
    existing.add(norm(r[0]));
  }
  return { branch, file, wb, sh, grid, hdrIdx, hdr, col, noteCol, existing };
}

const branches = [...new Set(cl.rows.map(r => r.branch))].sort();
const books = {}; branches.forEach(b => books[b] = preflight(b));

const plan = {}; branches.forEach(b => plan[b] = []);
let nSkip = 0;
cl.rows.forEach(r => {
  if (books[r.branch].existing.has(norm(r.date))) { nSkip++; r._skip = true; }
  else plan[r.branch].push(r);
});
const nNew = cl.rows.length - nSkip;

console.log(`\nSafe sales import — ${path.basename(clPath)}`);
console.log(`batch: ${cl.batch_id}   month: ${cl.month}`);
console.log(`mode : ${COMMIT ? 'COMMIT' : 'DRY RUN (nothing will be written)'}\n`);
console.log('preflight: all destinations valid, no lock files\n');
branches.forEach(b => {
  const add = plan[b];
  const est = add.filter(r => r.estimated);
  const rev = add.reduce((a, r) => a + r.revenue, 0);
  console.log(`  ${b}/${cl.month}: +${add.length} days  ฿${rev.toFixed(2)}` +
              (est.length ? `   (of which ${est.length} ESTIMATED, ฿${est.reduce((a, r) => a + r.revenue, 0).toFixed(2)})` : ''));
});
if (nSkip) console.log(`\n  ${nSkip} day(s) already present — skipped (idempotent).`);
console.log(`\n  total to write: ${nNew} rows`);

if (!COMMIT) { console.log('\nDry run only. Re-run with --commit to write.\n'); process.exit(0); }
if (!nNew) { console.log('\nNothing to do — zero changes.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bdir = path.join(DIR, 'audit', 'backups', stamp);
fs.mkdirSync(bdir, { recursive: true });
const receipt = { batch_id: cl.batch_id, month: cl.month, change_list: path.resolve(clPath),
                  imported_at: new Date().toISOString(), rows_written: 0, rows_skipped: nSkip,
                  estimated_rows: [], branches: {} };

branches.forEach(b => {
  const bk = books[b], add = plan[b];
  if (!add.length) return;
  const before = sha256(bk.file);
  const bak = path.join(bdir, path.basename(bk.file));
  fs.copyFileSync(bk.file, bak);

  if (bk.hdr[bk.noteCol] !== NOTE_COL) {
    XLSX.utils.sheet_add_aoa(bk.sh, [[NOTE_COL]], { origin: { r: bk.hdrIdx, c: bk.noteCol } });
  }
  add.sort((x, y) => Number(x.date.slice(0, 2)) - Number(y.date.slice(0, 2)));
  const width = Math.max(bk.hdr.length, bk.noteCol + 1);
  const aoa = add.map(r => {
    const row = new Array(width).fill(null);
    row[bk.col['Date']] = r.date;
    row[bk.col['Day']] = r.day || '';
    row[bk.col['Revenue (฿)']] = r.revenue;
    // Cash / Scan stay EMPTY when unknown — never 0
    if (r.cash != null) row[bk.col['Cash (฿)']] = r.cash;
    if (r.scan != null && bk.col['Scan/Transfer (฿)'] !== undefined) row[bk.col['Scan/Transfer (฿)']] = r.scan;
    row[bk.noteCol] = (r.estimated ? '[ESTIMATED] ' : '') + r.note;
    return row;
  });
  XLSX.utils.sheet_add_aoa(bk.sh, aoa, { origin: bk.grid.length });
  XLSX.writeFile(bk.wb, bk.file, { cellStyles: true });

  // readback
  const rb = XLSX.readFile(bk.file);
  const g2 = XLSX.utils.sheet_to_json(rb.Sheets[cl.month], { header: 1, defval: null });
  const h2 = g2.findIndex(r => r && r.includes('Date'));
  const c2 = {}; g2[h2].forEach((h, i) => { if (h) c2[norm(h)] = i; });
  const got = {};
  for (let i = h2 + 1; i < g2.length; i++) { const r = g2[i]; if (r && r[0]) got[norm(r[0])] = r; }
  const bad = add.filter(r => {
    const g = got[norm(r.date)];
    return !g || Number(g[c2['Revenue (฿)']]) !== r.revenue;
  });
  if (bad.length) {
    fs.copyFileSync(bak, bk.file);
    fail(`${b}: readback failed for ${bad.length} row(s) — workbook restored. first: ${bad[0].date}`);
  }

  receipt.rows_written += add.length;
  add.filter(r => r.estimated).forEach(r => receipt.estimated_rows.push({ branch: b, date: r.date, revenue: r.revenue }));
  receipt.branches[b] = { file: path.basename(bk.file), rows_added: add.length,
                          revenue: +add.reduce((a, r) => a + r.revenue, 0).toFixed(2),
                          estimated_count: add.filter(r => r.estimated).length,
                          backup: path.relative(DIR, bak), hash_before: before, hash_after: sha256(bk.file),
                          readback: 'verified' };
  console.log(`  ${b}: wrote ${add.length} rows, readback verified`);
});

fs.writeFileSync(path.join(bdir, 'sales_import_receipt.json'), JSON.stringify(receipt, null, 2));
console.log(`\nDone. ${receipt.rows_written} rows written, ${receipt.estimated_rows.length} of them ESTIMATED.`);
console.log(`backups + receipt: ${path.relative(DIR, bdir)}`);
if (receipt.estimated_rows.length) {
  console.log(`\nESTIMATED rows are flagged in the "${NOTE_COL}" column. Replace them when real data arrives.`);
}
console.log('');
