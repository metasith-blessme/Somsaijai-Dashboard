#!/usr/bin/env node
/*
 * correct_sales_cells.js — apply approved corrections to individual cells in a month Sale sheet.
 *
 *   node correct_sales_cells.js <corrections.json>            # dry run
 *   node correct_sales_cells.js <corrections.json> --commit
 *
 * Each entry must name the branch, month sheet, date, column header, the value expected to be
 * there now, and the new value. If the current value does not match `from`, nothing is written —
 * that guard stops a correction being applied twice or to a row that has since changed.
 *
 * corrections.json:
 *   { batch_id, reason, corrections: [ {branch, month, date, column, from, to} ] }
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const COMMIT = process.argv.includes('--commit');
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fail = m => { console.error('\n  FAIL — ' + m + '\n  Nothing was written.\n'); process.exit(1); };
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const spec = process.argv[2];
if (!spec || !fs.existsSync(spec)) fail('usage: node correct_sales_cells.js <corrections.json> [--commit]');
const cfg = JSON.parse(fs.readFileSync(spec, 'utf8'));
if (!Array.isArray(cfg.corrections) || !cfg.corrections.length) fail('no corrections listed');

const BOOKS = {};
const work = [];
for (const c of cfg.corrections) {
  ['branch', 'month', 'date', 'column'].forEach(k => { if (!c[k]) fail(`entry missing "${k}"`); });
  if (typeof c.to !== 'number') fail(`${c.date} ${c.column}: "to" must be a number`);

  const file = path.join(DIR, `SomSaiJai_Dashboard_${c.branch}_2026.xlsx`);
  if (!fs.existsSync(file)) fail(`workbook missing: ${file}`);
  if (fs.existsSync(path.join(DIR, '~$' + path.basename(file)))) fail(`${c.branch} workbook is open in Excel`);

  BOOKS[file] = BOOKS[file] || XLSX.readFile(file, { cellStyles: true });
  const wb = BOOKS[file];
  const sh = wb.Sheets[c.month];
  if (!sh) fail(`${c.branch}: no ${c.month} sheet`);
  const g = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
  const h = g.findIndex(r => r && r.includes('Date'));
  if (h === -1) fail(`${c.branch}/${c.month}: no header row`);

  const col = g[h].findIndex(x => norm(x) === norm(c.column));
  if (col === -1) fail(`${c.branch}/${c.month}: no column "${c.column}"`);

  const rows = [];
  for (let i = h + 1; i < g.length; i++) if (g[i] && norm(g[i][0]) === norm(c.date)) rows.push(i);
  if (rows.length !== 1) fail(`${c.branch}/${c.month} ${c.date}: matched ${rows.length} rows, expected exactly 1`);

  const cur = g[rows[0]][col];
  if (c.from != null && Number(cur) !== Number(c.from)) {
    fail(`${c.branch}/${c.month} ${c.date} "${c.column}": current value is ${cur}, expected ${c.from}.\n` +
         `  The sheet is not in the state this correction was written for — review before retrying.`);
  }
  work.push({ c, file, wb, sh, row: rows[0], col, cur });
}

console.log(`\nSales cell corrections — ${cfg.batch_id || '(unnamed)'}`);
if (cfg.reason) console.log(`reason: ${cfg.reason}`);
console.log(`mode  : ${COMMIT ? 'COMMIT' : 'DRY RUN (nothing will be written)'}\n`);
work.forEach(({ c, row, cur }) => {
  console.log(`  ${c.branch}/${c.month} ${c.date}  ${c.column}`);
  console.log(`    ${cur}  ->  ${c.to}   (sheet row ${row + 1})`);
});

if (!COMMIT) { console.log('\nDry run only. Re-run with --commit.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bdir = path.join(DIR, 'audit', 'backups', stamp + '-sales-correction');
fs.mkdirSync(bdir, { recursive: true });
const receipt = { batch_id: cfg.batch_id, reason: cfg.reason, at: new Date().toISOString(), corrections: [] };

const byFile = {};
work.forEach(w => (byFile[w.file] = byFile[w.file] || []).push(w));
Object.entries(byFile).forEach(([file, ws]) => {
  const before = sha256(file);
  fs.copyFileSync(file, path.join(bdir, path.basename(file)));
  const { wb } = ws[0];
  ws.forEach(({ c, sh, row, col, cur }) => {
    XLSX.utils.sheet_add_aoa(sh, [[c.to]], { origin: { r: row, c: col } });
    receipt.corrections.push({ branch: c.branch, month: c.month, date: c.date, column: c.column,
                               sheet_row: row + 1, before: cur, after: c.to });
  });
  XLSX.writeFile(wb, file, { cellStyles: true });

  const rb = XLSX.readFile(file);
  ws.forEach(({ c, row, col }) => {
    const g2 = XLSX.utils.sheet_to_json(rb.Sheets[c.month], { header: 1, blankrows: true, defval: null });
    if (Number(g2[row][col]) !== Number(c.to)) {
      fs.copyFileSync(path.join(bdir, path.basename(file)), file);
      fail(`readback: ${c.branch} ${c.date} ${c.column} is ${g2[row][col]}, expected ${c.to} — workbook restored from backup`);
    }
  });
  receipt[path.basename(file)] = { hash_before: before, hash_after: sha256(file),
                                   backup: path.relative(DIR, path.join(bdir, path.basename(file))) };
  console.log(`\n  ${path.basename(file)}: ${ws.length} cell(s) corrected, readback verified`);
});

fs.writeFileSync(path.join(bdir, 'correction_receipt.json'), JSON.stringify(receipt, null, 2));
console.log(`\nDone. backup + receipt: ${path.relative(DIR, bdir)}\n`);
