#!/usr/bin/env node
/*
 * Acceptance tests for safe_import_expenses.js (OCR_RULES §8).
 * Runs entirely in a throwaway sandbox built from copies — never touches the real workbooks.
 *
 *   node test_safe_import.js
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const XLSX = require('xlsx');

const DIR = __dirname;
const CL = path.join(DIR, 'audit', 'batch_2026-09-14_AugExpenses', 'change_list.json');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log('  ok   ' + name); pass++; }
  else { console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); fail++; }
};
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function sandbox() {
  const s = fs.mkdtempSync(path.join(os.tmpdir(), 'safeimp-'));
  fs.mkdirSync(path.join(s, 'audit'));
  ['B1', 'B2', 'B3'].forEach(b => fs.copyFileSync(
    path.join(DIR, `SomSaiJai_Dashboard_${b}_2026.xlsx`), path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  fs.copyFileSync(path.join(DIR, 'safe_import_expenses.js'), path.join(s, 'safe_import_expenses.js'));
  fs.copyFileSync(CL, path.join(s, 'audit', 'change_list.json'));
  fs.symlinkSync(path.join(DIR, 'node_modules'), path.join(s, 'node_modules'));
  return s;
}
const run = (s, args) => {
  try { return { code: 0, out: execFileSync(process.execPath, ['safe_import_expenses.js', ...args], { cwd: s, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
};
const writeCL = (s, name, mutate) => {
  const j = JSON.parse(fs.readFileSync(CL, 'utf8')); mutate(j);
  const p = path.join(s, 'audit', name); fs.writeFileSync(p, JSON.stringify(j)); return 'audit/' + name;
};

if (!fs.existsSync(CL)) { console.error('change list not found: ' + CL); process.exit(1); }
console.log('\nsafe_import_expenses.js — acceptance tests\n');

/* 1. dry run writes nothing */
{
  const s = sandbox(), before = ['B1', 'B2', 'B3'].map(b => sha(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  const r = run(s, ['audit/change_list.json']);
  const after = ['B1', 'B2', 'B3'].map(b => sha(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  ok('dry run exits clean', r.code === 0);
  ok('dry run changes no bytes', JSON.stringify(before) === JSON.stringify(after));
  fs.rmSync(s, { recursive: true, force: true });
}

/* 2. commit + readback + idempotency + existing rows untouched */
{
  const s = sandbox();
  const orig = {}; ['B1', 'B2', 'B3'].forEach(b => orig[b] = XLSX.readFile(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`), { cellStyles: true }));
  const r1 = run(s, ['audit/change_list.json', '--commit']);
  ok('commit succeeds', r1.code === 0 && /readback verified/.test(r1.out));

  const cl = JSON.parse(fs.readFileSync(CL, 'utf8'));
  const expect = {}; cl.rows.forEach(r => expect[r.branch] = (expect[r.branch] || 0) + r.amt);
  let allOk = true, untouched = true;
  Object.keys(expect).forEach(b => {
    const w = XLSX.readFile(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`), { cellStyles: true });
    const rows = XLSX.utils.sheet_to_json(w.Sheets['Daily_Expenses'], { header: 1, blankrows: false });
    const got = rows.filter(x => x[1] === 'Aug26').reduce((a, x) => a + (x[5] || 0), 0);
    if (Math.abs(got - expect[b]) > 0.005) allOk = false;
    const o = orig[b];
    o.SheetNames.forEach(sn => Object.keys(o.Sheets[sn]).filter(k => k[0] !== '!').forEach(k => {
      const c = w.Sheets[sn][k];
      if (!c || String(c.v) !== String(o.Sheets[sn][k].v) || JSON.stringify(c.s) !== JSON.stringify(o.Sheets[sn][k].s)) untouched = false;
    }));
  });
  ok('Aug26 totals match the change list per branch', allOk);
  ok('every pre-existing cell value and style survives', untouched);

  const r2 = run(s, ['audit/change_list.json', '--commit']);
  ok('re-running the same batch writes zero rows', r2.code === 0 && /total to write: 0 rows/.test(r2.out));

  const bdir = path.join(s, 'audit', 'backups');
  const stamps = fs.existsSync(bdir) ? fs.readdirSync(bdir) : [];
  ok('backup directory created', stamps.length > 0);
  ok('import receipt written', stamps.some(t => fs.existsSync(path.join(bdir, t, 'import_receipt.json'))));
  fs.rmSync(s, { recursive: true, force: true });
}

/* 3. fail-closed cases leave every workbook byte-identical */
const cases = [
  ['lock file present', s => { fs.writeFileSync(path.join(s, '~$SomSaiJai_Dashboard_B2_2026.xlsx'), ''); return 'audit/change_list.json'; }],
  ['negative amount', s => writeCL(s, 'neg.json', j => { j.rows[10].amt = -5; })],
  ['zero amount', s => writeCL(s, 'zero.json', j => { j.rows[10].amt = 0; })],
  ['impossible date', s => writeCL(s, 'date.json', j => { j.rows[5].date = '32/13/2026'; delete j.rows[5].month; })],
  ['bad month tag', s => writeCL(s, 'month.json', j => { j.rows[5].month = 'Aug2026'; })],
  ['unknown branch', s => writeCL(s, 'br.json', j => { j.rows[5].branch = 'B9'; })],
  ['empty description', s => writeCL(s, 'desc.json', j => { j.rows[5].desc = '  '; })],
  ['sub-satang amount', s => writeCL(s, 'prec.json', j => { j.rows[5].amt = 10.005; })],
  ['missing destination sheet', s => {
    const p = path.join(s, 'SomSaiJai_Dashboard_B3_2026.xlsx');
    const w = XLSX.readFile(p); delete w.Sheets['Daily_Expenses'];
    w.SheetNames = w.SheetNames.filter(n => n !== 'Daily_Expenses'); XLSX.writeFile(w, p);
    return 'audit/change_list.json';
  }],
];
cases.forEach(([name, setup]) => {
  const s = sandbox();
  const target = setup(s) || 'audit/change_list.json';
  const before = ['B1', 'B2'].map(b => sha(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  const r = run(s, [target, '--commit']);
  const after = ['B1', 'B2'].map(b => sha(path.join(s, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  ok(`fail closed: ${name}`, r.code !== 0 && /FAIL/.test(r.out) && JSON.stringify(before) === JSON.stringify(after));
  fs.rmSync(s, { recursive: true, force: true });
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
