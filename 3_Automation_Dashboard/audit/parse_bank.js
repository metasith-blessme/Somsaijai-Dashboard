// Parse KBank statement text (pdftotext -layout output) into transactions.
//
// Direction is derived from the running balance, not from column position: a row whose balance
// fell is a withdrawal, one whose balance rose is a deposit. Column x-offsets shift between
// pages and wrapped rows, the balance never lies.
//
// Statements contain personal financial data. This module only reads a path handed to it;
// nothing is written to the repo and no extracted text is committed.
const fs = require('fs');

const MONEY = /\d{1,3}(?:,\d{3})*\.\d{2}/g;
const ROW_START = /^\s*(\d{2})-(\d{2})-(\d{2})\s/;
const OPENING = /ยอดยกมา/;

const toNumber = (s) => Number(s.replace(/,/g, ''));
// Balances are in satang; float subtraction drifts, so every derived amount is re-rounded.
const satang = (n) => Math.round(n * 100) / 100;

// Classify by the statement's own wording so downstream code never string-matches Thai inline.
function classify(text) {
  if (/รับเงินจากการขายด้วย Thai|QR Payment/.test(text)) return 'SALE_QR';
  if (/รับเงินจากการขายด้วย Alipay|WeChat/.test(text)) return 'SALE_ALIPAY';
  if (/รับเงินจากการขาย/.test(text)) return 'SALE_CARD';
  if (/^โอนเงิน|โอนไป/.test(text)) return 'TRANSFER_OUT';
  if (/รับโอนเงิน|โอนจาก/.test(text)) return 'TRANSFER_IN';
  if (/ชำระเงิน|เพื่อชำระ/.test(text)) return 'PAYMENT';
  if (/ฝากเงิน|เงินฝาก/.test(text)) return 'DEPOSIT';
  if (/ถอนเงิน/.test(text)) return 'WITHDRAWAL';
  if (/ดอกเบี้ย/.test(text)) return 'INTEREST';
  if (/ค่าธรรมเนียม/.test(text)) return 'FEE';
  return 'OTHER';
}

// Page furniture that must never be read as a transaction or appended to a description.
const NOISE = /หน้าที่|PAGE\/OF|ยอดยกไป|รวมถอนเงิน|รวมฝากเงิน|เลขที่อ้างอิง|เลขที่บัญชีเงินฝาก|รอบระหว่างวันที่|สาขาเจ้าของบัญชี|ชื่อบัญชี|วันที่มีผล|ยอดคงเหลือ/;

function parse(file, accountLabel) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const txns = [];
  let prevBalance = null;
  let opening = null;
  let current = null;
  // Some rows put the date and time on their own line, with the body on the next.
  let pendingDate = null;

  const flush = () => {
    if (!current) return;
    const text = current.parts.join(' ').replace(/\s+/g, ' ').trim();
    const { parts, ...rest } = current;
    txns.push({ ...rest, text, type: classify(text), account: accountLabel });
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(ROW_START);
    const money = line.match(MONEY);
    const date = m ? `${m[1]}/${m[2]}/20${m[3]}` : null;

    // Carry-forward line: repeated at the top of every page. The first one is the true
    // opening balance; the rest just re-anchor the running balance and are not transactions.
    if (OPENING.test(line) && money) {
      flush();
      const bal = toNumber(money[money.length - 1]);
      if (opening === null) opening = bal;
      prevBalance = bal;
      pendingDate = null;
      continue;
    }
    const isTxnRow = (date || pendingDate) && money && money.length >= 2;

    // NOISE is checked only for non-transaction lines. Header words such as ชื่อบัญชี also
    // appear inside genuine Shopee payment descriptions, so a blanket filter silently drops
    // real rows and corrupts the running balance.
    if (!isTxnRow) {
      if (date) { flush(); pendingDate = date; continue; } // date/time only; body is on the next line
      if (NOISE.test(line)) { flush(); continue; }
      if (current) current.parts.push(line.trim()); // wrapped continuation
      continue;
    }

    const rowDate = date || pendingDate;
    flush();
    pendingDate = null;

    const stated = toNumber(money[0]);
    const balance = toNumber(money[1]);
    const delta = prevBalance === null ? null : satang(balance - prevBalance);
    // Trust the balance delta for direction and magnitude; fall back to the stated figure.
    const amount = delta === null ? stated : Math.abs(delta);  // already satang-rounded
    const direction = delta === null ? 'in' : delta >= 0 ? 'in' : 'out';

    current = {
      date: rowDate, balance, amount, direction, stated,
      // A mismatch means a row was mis-split by the layout extractor — worth surfacing.
      suspect: delta !== null && Math.abs(Math.abs(delta) - stated) > 0.01,
      parts: [line.replace(ROW_START, '').replace(MONEY, '').trim()],
    };
    prevBalance = balance;
  }
  flush();
  return { opening, txns, closing: prevBalance };
}

module.exports = { parse, classify };

if (require.main === module) {
  const assert = require('assert');
  const os = require('os');
  const path = require('path');
  const tmp = path.join(os.tmpdir(), `bank-selfcheck-${process.pid}.txt`);
  fs.writeFileSync(tmp, [
    '   01-01-26       ยอดยกมา                        125,655.69',
    '   01-01-26 13:25 โอนเงิน          9,568.00      116,087.69 K PLUS  โอนไป พร้อมเพย์ X5654',
    '   01-01-26 23:16 รับเงินจากการขายด้วย Thai   4,190.00   120,277.69 EDC/K SHOP/MYQR',
    '                  QR Payment',
    '   02-01-26    15:28',
    '                  โอนเงิน                      277.69     120,000.00 K PLUS  โอนไป X8850',
    '                                                                    หน้าที่ (PAGE/OF) 2/16',
    '   02-01-26       ยอดยกมา                                 120,000.00',
  ].join('\n'));
  const { opening, txns, closing } = parse(tmp, 'TEST');
  fs.unlinkSync(tmp);

  assert.strictEqual(opening, 125655.69, 'opening balance must be read from ยอดยกมา');
  assert.strictEqual(txns.length, 3, 'wrapped continuation must not become its own transaction');
  assert.strictEqual(txns[2].date, '02/01/2026', 'a date-only line must carry its date to the next row');
  assert.strictEqual(txns[2].amount, 277.69, 'split-line row must still be measured by balance delta');
  assert.strictEqual(txns[0].direction, 'out', 'falling balance is a withdrawal');
  assert.strictEqual(txns[0].amount, 9568, 'amount from balance delta');
  assert.strictEqual(txns[1].direction, 'in', 'rising balance is a deposit');
  assert.strictEqual(txns[1].type, 'SALE_QR', 'QR sale must classify even when wrapped');
  assert.strictEqual(closing, 120000, 'per-page carry-forward must re-anchor, not emit a transaction');
  assert.ok(!txns.some((t) => t.suspect), 'clean rows must not be flagged suspect');
  console.log('parse_bank self-check passed');
}
