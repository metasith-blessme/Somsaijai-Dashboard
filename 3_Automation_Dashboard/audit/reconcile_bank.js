// Match bank outflows against the expense ledger to find money that left the account with no
// ledger entry. Answers "what is the unexplained gap actually made of".
//
// Usage:
//   BANK_DIR=/path/to/extracted MONTH=05 node audit/reconcile_bank.js
//
// Only the bank's outflows are authoritative here. Unmatched LEDGER rows are expected and not
// errors — most fruit is bought with cash takings that never pass through the account.
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { parse } = require('./parse_bank');
const { parseDate } = require('./sheet_rows');

const BANK_DIR = process.env.BANK_DIR;
const MONTH = process.env.MONTH || '05';
const DASH = process.env.DASH_DIR || path.join(__dirname, '..');
const STATEMENTS = [
  ['STM_SA8285_01JAN26_30JUN26.txt', 'SA8285'],
  ['STM_SA5601_01MAR26_31JUL26.txt', 'SA5601'],
];
// Matching tolerance. Slips are often entered a day or two after the transfer clears.
const DAY_WINDOW = 3;
const SATANG = 1;

// Known non-expense outflows: owner distributions confirmed by the owner, not costs.
const DISTRIBUTIONS = [
  { amount: 45060, date: '10/05/2026', who: 'Ming (Apr profit share)' },
  { amount: 50345, date: '14/05/2026', who: 'Blessme (Apr profit share)' },
];

const f = (n) => Math.round(n).toLocaleString('en-US');
const dayOf = (d) => Number(d.slice(0, 2));

if (!BANK_DIR || !fs.existsSync(BANK_DIR)) {
  console.error('Set BANK_DIR to the directory holding the extracted statement .txt files.');
  process.exit(2);
}

// --- Bank side ---
const bank = STATEMENTS
  .filter(([file]) => fs.existsSync(path.join(BANK_DIR, file)))
  .flatMap(([file, label]) => parse(path.join(BANK_DIR, file), label).txns)
  .filter((t) => t.direction === 'out' && (MONTH === 'all' || t.date.slice(3, 5) === MONTH))
  .map((t) => ({ ...t, day: dayOf(t.date), month: t.date.slice(3, 5), matched: null }));

// --- Ledger side ---
const ledger = [];
for (const branch of ['B1', 'B2', 'B3']) {
  const file = path.join(DASH, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(file)) continue;
  const wb = XLSX.readFile(file);
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Daily_Expenses'], { header: 1 }).slice(3)) {
    const d = parseDate(r[0]);
    const amount = Number(r[5]) || 0;
    if (!d || !amount) continue;
    const mm = String(d.month).padStart(2, '0');
    if (MONTH !== 'all' && mm !== MONTH) continue;
    ledger.push({
      branch, day: d.day, month: mm, date: r[0], amount,
      bucket: r[2], category: r[3], desc: String(r[4] ?? ''), used: false,
    });
  }
}

// --- Match: exact amount, nearest date within the window. Greedy, largest first, so a big
// unambiguous transfer claims its slip before a small coincidental one can. ---
for (const t of [...bank].sort((a, b) => b.amount - a.amount)) {
  const candidates = ledger
    .filter((l) => !l.used && l.month === t.month && Math.abs(l.amount - t.amount) < SATANG && Math.abs(l.day - t.day) <= DAY_WINDOW)
    .sort((a, b) => Math.abs(a.day - t.day) - Math.abs(b.day - t.day));
  if (candidates.length) {
    candidates[0].used = true;
    t.matched = candidates[0];
  }
}

const matched = bank.filter((t) => t.matched);
const unmatched = bank.filter((t) => !t.matched);
const isDistribution = (t) => DISTRIBUTIONS.find((d) => Math.abs(d.amount - t.amount) < SATANG && d.date === t.date);

const dist = unmatched.filter(isDistribution);
const unexplained = unmatched.filter((t) => !isDistribution(t));

const sum = (a) => a.reduce((x, t) => x + t.amount, 0);

console.log(`=== BANK vs LEDGER — month ${MONTH}/2026 ===\n`);
console.log(`Bank outflows          : ${String(bank.length).padStart(4)} txns  ${f(sum(bank)).padStart(10)}`);
console.log(`  matched to a slip    : ${String(matched.length).padStart(4)} txns  ${f(sum(matched)).padStart(10)}`);
console.log(`  owner distributions  : ${String(dist.length).padStart(4)} txns  ${f(sum(dist)).padStart(10)}`);
console.log(`  NO LEDGER ENTRY      : ${String(unexplained.length).padStart(4)} txns  ${f(sum(unexplained)).padStart(10)}`);
console.log(`\nLedger rows this month : ${String(ledger.length).padStart(4)} rows  ${f(sum(ledger)).padStart(10)}`);
console.log(`  matched to the bank  : ${String(ledger.filter((l) => l.used).length).padStart(4)} rows  ${f(sum(ledger.filter((l) => l.used))).padStart(10)}`);
console.log(`  no bank match (cash) : ${String(ledger.filter((l) => !l.used).length).padStart(4)} rows  ${f(sum(ledger.filter((l) => !l.used))).padStart(10)}`);

console.log(`\n\n=== Money out of the bank with NO ledger entry ===\n`);
console.log('Date       Acct     Amount  Paid to');
console.log('---------- ------ --------- ---------------------------------------------------');
for (const t of unexplained.sort((a, b) => b.amount - a.amount)) {
  const who = t.text.replace(/^[0-9:]+\s*/, '').replace(/^(โอนเงิน|ชำระเงิน)\s*/, '')
    .replace(/K PLUS|EDC\/K SHOP\/MYQR|โอนไป|เพื่อชำระ/g, '').replace(/\s+/g, ' ').trim();
  console.log(`${t.date} ${t.account} ${f(t.amount).padStart(9)}  ${who.slice(0, 51)}`);
}
console.log(`\nTOTAL UNEXPLAINED OUTFLOW: ${f(sum(unexplained))}`);

if (dist.length) {
  console.log(`\n\n=== Confirmed owner distributions (correctly excluded from cost) ===\n`);
  for (const t of dist) console.log(`${t.date} ${f(t.amount).padStart(9)}  ${isDistribution(t).who}`);
}

// --- Consolidated view: who received money that never reached the ledger ---
if (process.env.BY_PAYEE) {
  const groups = {};
  for (const t of unexplained) {
    const acct = (t.text.match(/X[0-9A-Za-z]{4}/) || ['?'])[0];
    const name = (t.text.match(/(?:นาย|นาง|น\.ส\.|บจก\.|หจก\.|MR\.|MRS\.)\s*[^+(]*/) || [''])[0].trim();
    const key = `${acct} ${name}`.trim();
    (groups[key] = groups[key] || { n: 0, v: 0, months: new Set() });
    groups[key].n++; groups[key].v += t.amount; groups[key].months.add(t.month);
  }
  console.log(`\n\n=== Unbooked outflows grouped by payee ===\n`);
  console.log('Payee'.padEnd(44) + 'txns'.padStart(5) + 'total'.padStart(12) + '  months');
  console.log('-'.repeat(44) + ' ---- ' + '-'.repeat(11) + '  ------');
  for (const [k, v] of Object.entries(groups).sort((a, b) => b[1].v - a[1].v)) {
    console.log(k.slice(0, 43).padEnd(44) + String(v.n).padStart(5) + f(v.v).padStart(12) + '  ' + [...v.months].sort().join(','));
  }
}

(function selfCheck() {
  const assert = require('assert');
  assert.ok(bank.length > 0, 'must find bank outflows for the month');
  // Every bank txn is in exactly one bucket.
  assert.strictEqual(matched.length + dist.length + unexplained.length, bank.length,
    'every outflow must be classified exactly once');
  // No ledger row may be claimed twice.
  const claimed = bank.filter((t) => t.matched).map((t) => t.matched);
  assert.strictEqual(new Set(claimed).size, claimed.length, 'a ledger row cannot match two transfers');
  assert.ok(Math.abs(sum(bank) - (sum(matched) + sum(dist) + sum(unexplained))) < 0.01, 'amounts must add up');
})();
