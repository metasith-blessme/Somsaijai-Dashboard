// Regression test for the fix_q1.js idempotency bug (see FINDINGS.md "Bug found and fixed"):
// it computed "already booked" as a hardcoded 0, so a second --apply silently double-booked
// ฿100,000. This runs every audit/fix_*.js twice against a scratch copy of the real ledgers
// and asserts the second --apply leaves the workbooks byte-identical to the first.
//
// Usage: node audit/test_idempotent.js
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DASH = path.join(__dirname, '..');
const FIX_SCRIPTS = ['fix_categories', 'fix_guava', 'fix_payroll', 'fix_q1', 'fix_stock_rent'];
const BRANCHES = ['B1', 'B2', 'B3'];

const hashFile = (f) => fs.existsSync(f)
  ? crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  : null;

let failures = 0;

for (const script of FIX_SCRIPTS) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), `idempotent-${script}-`));
  for (const branch of BRANCHES) {
    const src = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(scratch, path.basename(src)));
  }

  // Exit code is each script's own "N of M corrections matched" guard rail, not necessarily a
  // failure here — a fix already applied by an earlier pass legitimately matches 0. The workbook
  // hash below is the real idempotency signal.
  const run = () => spawnSync('node', [path.join(__dirname, `${script}.js`), '--apply'], {
    env: { ...process.env, DASH_DIR: scratch },
  });

  run();
  const afterFirst = BRANCHES.map((b) => hashFile(path.join(scratch, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));
  run();
  const afterSecond = BRANCHES.map((b) => hashFile(path.join(scratch, `SomSaiJai_Dashboard_${b}_2026.xlsx`)));

  const ok = afterFirst.every((h, i) => h === afterSecond[i]);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${script} — second --apply ${ok ? 'was a no-op' : 'changed the workbook again'}`);
  if (!ok) failures++;

  fs.rmSync(scratch, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} script(s) are not idempotent.`);
  process.exit(1);
}
console.log('\nAll fix_*.js scripts are idempotent.');
