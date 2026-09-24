#!/usr/bin/env node
/*
 * safe_import_expenses.js — append approved expense rows to the branch Daily_Expenses sheets.
 *
 * Satisfies the write-path requirements in docs/OCR_RULES.md §7:
 *   preflight (fail closed) → backup + hash → dry run diff → write → readback → receipt,
 *   and idempotency: re-running an already-imported batch changes nothing.
 *
 * Usage:
 *   node safe_import_expenses.js <change_list.json>            # dry run (default, writes nothing)
 *   node safe_import_expenses.js <change_list.json> --commit   # perform the import
 *
 * Deliberately NOT a replacement for process_expenses.js — this writes only rows that are
 * already in an approved change list. It does no OCR, no categorisation, no inference.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DIR = __dirname;
const wbPath = b => path.join(DIR, `SomSaiJai_Dashboard_${b}_2026.xlsx`);
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const fail = msg => { console.error('\n  FAIL — ' + msg + '\n  Nothing was written.\n'); process.exit(1); };

// DD/MM/YYYY -> 'Aug26'
function monthTag(date) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date);
  if (!m) fail(`date "${date}" is not DD/MM/YYYY`);
  const mi = +m[2] - 1;
  if (mi < 0 || mi > 11) fail(`date "${date}" has an impossible month`);
  return MONTHS[mi] + m[3].slice(2);
}

// identity of a row, for idempotency. Deliberately includes the description, because the
// description carries the source slip and is what makes two same-day same-amount rows distinct.
const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const keyOf = r => [norm(r.date), norm(r.cat), Number(r.amt).toFixed(2), norm(r.desc)].join('|');

/* ---------- preflight: locate and validate each destination ------------------ */
function preflight(branch) {
  const file = wbPath(branch);
  if (!fs.existsSync(file)) fail(`workbook missing: ${file}`);

  const lock = path.join(DIR, '~$' + path.basename(file));
  if (fs.existsSync(lock)) {
    fail(`${path.basename(file)} appears open in Excel (lock file ${path.basename(lock)} exists).\n` +
         `  Close the workbook and retry. Do NOT delete the lock file to force a write.`);
  }

  const wb = XLSX.readFile(file, { cellStyles: true, cellDates: false });
  const sh = wb.Sheets['Daily_Expenses'];
  if (!sh) fail(`${branch}: no Daily_Expenses sheet`);

  const grid = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true });
  const hdrIdx = grid.findIndex(r => r && norm(r[0]) === 'Date' && norm(r[1]) === 'Month');
  if (hdrIdx === -1) fail(`${branch}: could not find the Date/Month header row in Daily_Expenses`);

  const hdr = grid[hdrIdx].map(norm);
  const want = ['Date', 'Month', 'Bucket', 'Category', 'Description'];
  want.forEach((w, i) => { if (hdr[i] !== w) fail(`${branch}: column ${i + 1} is "${hdr[i]}", expected "${w}"`); });
  if (!/^Amount/.test(hdr[5] || '')) fail(`${branch}: column 6 is "${hdr[5]}", expected to start with "Amount"`);

  const existing = new Set();
  for (let i = hdrIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every(c => c === undefined || c === '')) continue;
    existing.add(keyOf({ date: r[0], cat: r[3], amt: r[5] || 0, desc: r[4] }));
  }
  return { branch, file, wb, sh, grid, hdrIdx, existing, dataRows: grid.length - hdrIdx - 1 };
}

/* ---------- main ------------------------------------------------------------- */
const clPath = process.argv[2];
const COMMIT = process.argv.includes('--commit');
if (!clPath) fail('usage: node safe_import_expenses.js <change_list.json> [--commit]');
if (!fs.existsSync(clPath)) fail(`change list not found: ${clPath}`);

const cl = JSON.parse(fs.readFileSync(clPath, 'utf8'));
if (!Array.isArray(cl.rows) || !cl.rows.length) fail('change list has no rows');

// validate every row BEFORE touching any workbook — fail closed on the whole batch
cl.rows.forEach((r, i) => {
  const at = `row ${i + 1} (slip ${r.idx})`;
  if (!['B1', 'B2', 'B3'].includes(r.branch)) fail(`${at}: bad branch "${r.branch}"`);
  if (!['COGS', 'OPEX'].includes(r.bucket)) fail(`${at}: bad bucket "${r.bucket}"`);
  if (!norm(r.cat)) fail(`${at}: empty category`);
  if (!norm(r.desc)) fail(`${at}: empty description`);
  if (typeof r.amt !== 'number' || !isFinite(r.amt)) fail(`${at}: amount is not a number`);
  if (r.amt <= 0) fail(`${at}: amount ${r.amt} is not positive`);
  if (Math.round(r.amt * 100) !== r.amt * 100) fail(`${at}: amount ${r.amt} has sub-satang precision`);
  // Date is the payment date; Month is the ACCOUNTING month and may legitimately differ
  // (the existing book already does this). An explicit month must still be a real month tag.
  if (r.month != null) {
    if (!/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2}$/.test(r.month)) fail(`${at}: bad month "${r.month}"`);
    r._month = r.month;
  } else {
    r._month = monthTag(r.date);
  }
  monthTag(r.date);   // validate the payment date regardless
});

const branches = [...new Set(cl.rows.map(r => r.branch))].sort();
const books = {};
branches.forEach(b => { books[b] = preflight(b); });

// classify
let nNew = 0, nSkip = 0;
const plan = {};
branches.forEach(b => (plan[b] = []));
cl.rows.forEach(r => {
  const bk = books[r.branch];
  if (bk.existing.has(keyOf(r))) { r._skip = true; nSkip++; }
  else { plan[r.branch].push(r); nNew++; }
});

console.log(`\nSafe import — ${path.basename(clPath)}`);
console.log(`batch: ${cl.batch_id || '(unnamed)'}`);
console.log(`mode : ${COMMIT ? 'COMMIT' : 'DRY RUN (nothing will be written)'}\n`);
console.log('preflight: all destinations valid, no lock files\n');

branches.forEach(b => {
  const bk = books[b], add = plan[b];
  const sum = add.reduce((a, r) => a + r.amt, 0);
  console.log(`  ${b}: ${bk.dataRows} existing rows -> +${add.length} new  (฿${sum.toFixed(2)})`);
});
if (nSkip) console.log(`\n  ${nSkip} row(s) already present — skipped (idempotent).`);
const total = cl.rows.filter(r => !r._skip).reduce((a, r) => a + r.amt, 0);
console.log(`\n  total to write: ${nNew} rows, ฿${total.toFixed(2)}`);

if (!COMMIT) {
  console.log('\nDry run only. Re-run with --commit to write.\n');
  process.exit(0);
}
if (!nNew) { console.log('\nNothing to do — every row is already present. Zero changes.\n'); process.exit(0); }

/* ---------- commit ----------------------------------------------------------- */
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(DIR, 'audit', 'backups', stamp);
fs.mkdirSync(backupDir, { recursive: true });

const receipt = { batch_id: cl.batch_id, change_list: path.resolve(clPath), imported_at: new Date().toISOString(),
                  rows_written: 0, rows_skipped: nSkip, branches: {} };

branches.forEach(b => {
  const bk = books[b], add = plan[b];
  const before_hash = sha256(bk.file);
  const bak = path.join(backupDir, path.basename(bk.file));
  fs.copyFileSync(bk.file, bak);

  if (add.length) {
    const start = bk.grid.length;                       // append after the last row
    const aoa = add.map(r => [r.date, r._month, r.bucket, r.cat, r.desc, r.amt]);
    XLSX.utils.sheet_add_aoa(bk.sh, aoa, { origin: start });
    XLSX.writeFile(bk.wb, bk.file, { cellStyles: true });
  }

  // readback from disk and verify every written row
  const rb = XLSX.readFile(bk.file);
  const rbSet = new Set(XLSX.utils.sheet_to_json(rb.Sheets['Daily_Expenses'], { header: 1, blankrows: false })
    .map(r => keyOf({ date: r[0], cat: r[3], amt: r[5] || 0, desc: r[4] })));
  const bad = add.filter(r => !rbSet.has(keyOf(r)));
  if (bad.length) {
    fs.copyFileSync(bak, bk.file);                      // restore
    fail(`${b}: readback failed for ${bad.length} row(s) — workbook restored from backup.\n` +
         `  first: ${bad[0].date} ${bad[0].cat} ${bad[0].amt}`);
  }

  receipt.rows_written += add.length;
  receipt.branches[b] = { file: path.basename(bk.file), rows_added: add.length,
                          amount: +add.reduce((a, r) => a + r.amt, 0).toFixed(2),
                          backup: path.relative(DIR, bak), hash_before: before_hash, hash_after: sha256(bk.file),
                          readback: 'verified' };
  console.log(`  ${b}: wrote ${add.length} rows, readback verified`);
});

const rcPath = path.join(backupDir, 'import_receipt.json');
fs.writeFileSync(rcPath, JSON.stringify(receipt, null, 2));
console.log(`\nDone. ${receipt.rows_written} rows written.`);
console.log(`backups + receipt: ${path.relative(DIR, backupDir)}`);
console.log(`\nRe-run WITHOUT --commit to confirm idempotency (should report 0 new).\n`);
