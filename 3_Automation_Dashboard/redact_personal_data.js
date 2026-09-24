#!/usr/bin/env node
/*
 * redact_personal_data.js — remove supplier names and account digits from expense
 * descriptions that are published to the public dashboard.
 *
 *   node redact_personal_data.js            # dry run
 *   node redact_personal_data.js --commit
 *
 * Amounts, dates, categories and buckets are never touched — only the Description text.
 * Product, quantity and reconciliation detail are kept; only the identifying parts go.
 * Full unredacted identity stays in the slips and the batch review artifacts, which are
 * not published (OCR_RULES §2.6).
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = __dirname;
const COMMIT = process.argv.includes('--commit');
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

// exact, ordered replacements — no regex guessing
const RULES = [
  ['(แยกจากสลิปรวม 7,700 - นาง ศิริพร)', '(แยกจากสลิปรวม 7,700)'],
  ['(แยกจากสลิปรวม 5,890 - นาง ศิริพร 22/3)', '(แยกจากสลิปรวม 5,890, 22/3)'],
  ['ฝรั่ง ตะกร้าแรก (นาง ประนอม, BBL X8148)', 'ฝรั่ง ตะกร้าแรก'],
  ['(จ่ายแทน 1,932 แล้ว ฐนกร โอนคืน 29/06 13:56)', '(จ่ายแทน 1,932 แล้ว ได้รับโอนคืน 29/06 13:56)'],
  ['(รับเงินสด 28,000 แล้วโอนต่อ ฐนกร 23/05 17:23)', '(รับเงินสด 28,000 แล้วโอนต่อ 23/05 17:23)'],
  ['น.ส. สุพิชญา [bank]', 'สับปะรด [bank]'],
  [' (นาง ประนอม)', ''],
];

// nothing matching these may remain in a published description
const FORBIDDEN = /นาย |นาง |น\.ส\.|MR\. AUNG|เมธาสิทธิ์|ฐิติภูมิ|ฐนกร|ประนอม|กสิณา|สุพิชญา|ศิริพร|เพ็ญวิไล|เยาวเรศ|รวันดา|ชัยวัฒน์|วิชาญ|สาวิตตรี|BBL X|KBANK|SCB /;

let changed = 0, files = [];
for (const b of ['B1', 'B2', 'B3']) {
  const file = path.join(DIR, `SomSaiJai_Dashboard_${b}_2026.xlsx`);
  const lock = path.join(DIR, '~$' + path.basename(file));
  if (fs.existsSync(lock)) { console.error(`FAIL — ${b} workbook is open in Excel. Close it first.`); process.exit(1); }

  const wb = XLSX.readFile(file, { cellStyles: true });
  const sh = wb.Sheets['Daily_Expenses'];
  if (!sh) continue;
  const grid = XLSX.utils.sheet_to_json(sh, { header: 1, blankrows: true, defval: null });
  const hdr = grid.findIndex(r => r && String(r[0]).trim() === 'Date');
  if (hdr === -1) { console.error(`FAIL — ${b}: no header row`); process.exit(1); }

  const edits = [];
  for (let i = hdr + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || !r[4]) continue;
    const before = String(r[4]);
    let after = before;
    let hit = false;
    RULES.forEach(([from, to]) => { if (after.includes(from)) { hit = true; after = after.split(from).join(to); } });
    // only tidy whitespace on rows a rule actually touched — never edit unrelated rows
    if (hit) after = after.replace(/\s{2,}/g, ' ').trim();
    if (hit && after !== before) edits.push({ row: i, before, after, amt: r[5], date: r[0] });
  }

  if (edits.length) {
    console.log(`\n${b} — ${edits.length} description(s):`);
    edits.forEach(e => {
      console.log(`  ${e.date}  ฿${e.amt}`);
      console.log(`    - ${e.before}`);
      console.log(`    + ${e.after}`);
      if (FORBIDDEN.test(e.after)) { console.error(`\nFAIL — redacted text still matches forbidden pattern:\n  ${e.after}`); process.exit(1); }
    });
    changed += edits.length;
    files.push({ b, file, wb, sh, edits, hdr });
  }
}

if (!changed) { console.log('\nNothing to redact.\n'); process.exit(0); }
if (!COMMIT) { console.log(`\nDry run — ${changed} description(s) would change. Re-run with --commit.\n`); process.exit(0); }

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const bdir = path.join(DIR, 'audit', 'backups', stamp + '-redaction');
fs.mkdirSync(bdir, { recursive: true });
const receipt = { action: 'redact_personal_data', at: new Date().toISOString(), edits: [] };

files.forEach(({ b, file, wb, sh, edits }) => {
  const before_hash = sha256(file);
  fs.copyFileSync(file, path.join(bdir, path.basename(file)));
  edits.forEach(e => {
    XLSX.utils.sheet_add_aoa(sh, [[e.after]], { origin: { r: e.row, c: 4 } });
    receipt.edits.push({ branch: b, date: e.date, amount: e.amt, before: e.before, after: e.after });
  });
  XLSX.writeFile(wb, file, { cellStyles: true });

  // readback: text replaced, amounts untouched
  const rb = XLSX.readFile(file);
  const g2 = XLSX.utils.sheet_to_json(rb.Sheets['Daily_Expenses'], { header: 1, blankrows: true, defval: null });
  edits.forEach(e => {
    const r = g2[e.row];
    if (String(r[4]) !== e.after) { console.error(`FAIL — readback mismatch on ${b} row ${e.row + 1}`); process.exit(1); }
    if (Number(r[5]) !== Number(e.amt)) { console.error(`FAIL — amount changed on ${b} row ${e.row + 1}`); process.exit(1); }
  });
  receipt[b] = { backup: path.relative(DIR, path.join(bdir, path.basename(file))), hash_before: before_hash, hash_after: sha256(file) };
  console.log(`\n${b}: ${edits.length} redacted, readback verified (amounts unchanged)`);
});

fs.writeFileSync(path.join(bdir, 'redaction_receipt.json'), JSON.stringify(receipt, null, 2));
console.log(`\nDone. ${changed} description(s) redacted.`);
console.log(`backup + receipt: ${path.relative(DIR, bdir)}\n`);
