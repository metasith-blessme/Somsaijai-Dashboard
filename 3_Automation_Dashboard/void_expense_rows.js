#!/usr/bin/env node
/*
 * void_expense_rows.js — reverse an expense row that should never have been booked.
 *
 *   node void_expense_rows.js <voids.json>            # dry run
 *   node void_expense_rows.js <voids.json> --commit
 *
 * The row is NOT deleted. Its amount is set to 0 and its description is rewritten to say
 * why, so the correction stays visible in the ledger instead of silently vanishing —
 * and so the sheet's other rows, styles and row numbers are left untouched.
 *
 * voids.json: { batch_id, voids: [ { branch, date, month, cat, amt, desc_contains, reason } ] }
 * Every entry must match exactly one row, or nothing is written.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const COMMIT = process.argv.includes('--commit');
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fail = m => { console.error('\n  FAIL — ' + m + '\n  Nothing was written.\n'); process.exit(1); };

const spec = process.argv[2];
if (!spec || !fs.existsSync(spec)) fail('usage: node void_expense_rows.js <voids.json> [--commit]');
const cfg = JSON.parse(fs.readFileSync(spec, 'utf8'));
if (!Array.isArray(cfg.voids) || !cfg.voids.length) fail('no voids listed');

const work = [];
for (const v of cfg.voids) {
  ['branch', 'date', 'month', 'cat', 'desc_contains', 'reason'].forEach(k => { if (!v[k]) fail(`entry missing "${k}"`); });
  if (typeof v.amt !== 'number') fail(`entry for ${v.date} missing numeric amt`);

  const file = path.join(DIR, `SomSaiJai_Dashboard_${v.branch}_2026.xlsx`);
  if (!fs.existsSync(file)) fail(`workbook missing: ${file}`);
  if (fs.existsSync(path.join(DIR, '~$' + path.basename(file)))) fail(`${v.branch} workbook is open in Excel`);

  const wb = XLSX.readFile(file, { cellStyles: true });
  const sh = wb.Sheets['Daily_Expenses'];
  const g = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
  const h = g.findIndex(r => r && String(r[0]).trim() === 'Date');
  if (h === -1) fail(`${v.branch}: no header row`);

  const hits = [];
  for (let i = h + 1; i < g.length; i++) {
    const r = g[i];
    if (!r) continue;
    if (String(r[0]) === v.date && String(r[1]) === v.month && String(r[3]) === v.cat &&
        Number(r[5]) === v.amt && String(r[4] || '').includes(v.desc_contains)) hits.push(i);
  }
  if (hits.length !== 1) fail(`${v.branch} ${v.date} ${v.cat} ฿${v.amt}: matched ${hits.length} rows, expected exactly 1`);
  work.push({ v, file, wb, sh, row: hits[0], before: g[hits[0]] });
}

console.log(`\nVoid expense rows — ${cfg.batch_id || '(unnamed)'}`);
console.log(`mode: ${COMMIT ? 'COMMIT' : 'DRY RUN (nothing will be written)'}\n`);
work.forEach(({ v, before, row }) => {
  console.log(`  ${v.branch} sheet row ${row + 1}:  ${before[0]}  ${before[3]}  ฿${before[5]}`);
  console.log(`    - ${before[4]}`);
  console.log(`    + [VOID ฿${v.amt}] ${v.reason}`);
  console.log(`      amount ฿${before[5]} -> ฿0`);
});
const total = work.reduce((a, w) => a + w.v.amt, 0);
console.log(`\n  removes ฿${total.toFixed(2)} of cost from the books`);

if (!COMMIT) { console.log('\nDry run only. Re-run with --commit.\n'); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bdir = path.join(DIR, 'audit', 'backups', stamp + '-void');
fs.mkdirSync(bdir, { recursive: true });
const receipt = { batch_id: cfg.batch_id, at: new Date().toISOString(), voids: [] };

const byFile = {};
work.forEach(w => (byFile[w.file] = byFile[w.file] || []).push(w));
Object.entries(byFile).forEach(([file, ws]) => {
  const before_hash = sha256(file);
  fs.copyFileSync(file, path.join(bdir, path.basename(file)));
  const { wb, sh } = ws[0];
  ws.forEach(({ v, row, before }) => {
    XLSX.utils.sheet_add_aoa(sh, [[`[VOID ฿${v.amt}] ${v.reason}`]], { origin: { r: row, c: 4 } });
    XLSX.utils.sheet_add_aoa(sh, [[0]], { origin: { r: row, c: 5 } });
    receipt.voids.push({ branch: v.branch, sheet_row: row + 1, date: v.date, cat: v.cat,
                         amount_before: before[5], amount_after: 0, desc_before: before[4], reason: v.reason });
  });
  XLSX.writeFile(wb, file, { cellStyles: true });

  const rb = XLSX.readFile(file);
  const g2 = XLSX.utils.sheet_to_json(rb.Sheets['Daily_Expenses'], { header: 1, blankrows: true, defval: null });
  ws.forEach(({ v, row }) => {
    const r = g2[row];
    if (Number(r[5]) !== 0) fail(`readback: ${v.branch} row ${row + 1} amount is ${r[5]}, expected 0`);
    if (!String(r[4]).startsWith('[VOID')) fail(`readback: ${v.branch} row ${row + 1} description not marked VOID`);
  });
  receipt[path.basename(file)] = { hash_before: before_hash, hash_after: sha256(file),
                                   backup: path.relative(DIR, path.join(bdir, path.basename(file))) };
  console.log(`\n  ${path.basename(file)}: ${ws.length} row(s) voided, readback verified`);
});

fs.writeFileSync(path.join(bdir, 'void_receipt.json'), JSON.stringify(receipt, null, 2));
console.log(`\nDone. backup + receipt: ${path.relative(DIR, bdir)}\n`);
