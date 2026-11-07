const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReview } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { buildChangePlan } = require('../lib/adapter');
const { formatSummary } = require('../lib/summary');
const { resultMessage } = require('../lib/publish');
const { helpText, readingPhoto } = require('../lib/staff_text');
const { b1, pome } = require('./fixtures/2026-11-02/readings');

// Thai letters and digits; the baht sign ฿ (U+0E3F) is fine in English text.
const THAI = /[\u0E00-\u0E3E\u0E40-\u0E7F]/;

function reviewOf(extraction) {
  return applyChecks(buildReview({
    batchId: 'set_single1',
    now: new Date('2026-11-03T10:00:00+07:00'),
    images: [{
      sourceId: 'm1', sha256: 'h', contentType: 'image/jpeg', extraction,
      second: { date_raw: extraction.header.date_raw, branch_raw: extraction.header.branch_raw, sales: extraction.sales, other: extraction.other },
    }],
  }));
}

test('the 2 Nov B1 card: result first, cups per item, closing box, and Parn\'s total check', () => {
  const review = reviewOf(b1.extraction);
  const card = formatSummary(review, { publicUrl: 'https://somsaijailive.vercel.app', channelSecret: 's' });
  const lines = card.text.split('\n');
  assert.equal(lines[0], 'B1 · 2 Nov 2026 · Total ฿4,516');
  for (const line of [
    'Orange Cup (Regular) · 16 · ฿960',
    'Orange Premium Cup 100% · 1 · ฿100 (price 120→100)',
    'Pomegranate Cup · 4 · ฿600',
    'Volcano Watermelon · 4 · ฿436 (price 129→109)',
    'Pome (75) (written in) · 1 · ฿75',
    'Items: 66 cups · ฿4,516 ✓ matches Total',
    'Net cash 2,806 · Scan 1,650 · Ice 60 · Change 1,500',
    'Total check: Net cash + Scan - Ice = 4,396',
    '⚠ Written total 4,516 should be 4,396 (Net cash + Scan - Ice)',
  ]) assert.ok(lines.includes(line), `missing line: ${line}\n${card.text}`);
  // Blank printed rows are not listed.
  assert.doesNotMatch(card.text, /Pear Cup|Grape Cup|Mango Sticky Rice/);
  assert.doesNotMatch(card.text.replace(/^Details: .*$/m, ''), /\[|set_single|batch|OCR/);
  assert.doesNotMatch(card.text, THAI);
  assert.deepEqual(card.messages[1].template.actions.map(a => a.label), ['Approve', 'Reject']);
  assert.doesNotMatch(JSON.stringify(card.messages), THAI);
});

test('the 2 Nov B1 sheet with a total mismatch books the written Total as gross in one tap', () => {
  const review = reviewOf(b1.extraction);
  assert.equal(review.checks.find(c => c.rule === 'channels').status, 'fail');
  const card = formatSummary(review, {});
  assert.doesNotMatch(card.text, /✗/);
  assert.equal(card.messages[1].template.text, 'Check the ⚠ lines. Approve books the written Total B1 2 Nov ฿4,516. Reject asks staff to resend.');
  const [row] = buildChangePlan(review).salesLists[0].rows;
  assert.match(row.note, /approved with flags: channels/);
  assert.equal(row.revenue, 4516);
  assert.equal(row.cash, 2806);
  assert.equal(row.scan, 1650);
  assert.equal(row.exp, undefined);
});

test('a written-in row copied into the menu rows too is one sale, not two', () => {
  const doubled = { ...b1.extraction, menu_rows: [...b1.extraction.menu_rows, { ...pome }] };
  const review = reviewOf(doubled);
  const items = review.records[0].sales_items.filter(i => /^Pome \(75\)/.test(i.item_raw));
  assert.equal(items.length, 1);
  assert.equal(review.checks.find(c => c.rule === 'line_sum').status, 'pass');
});

test('a misread year is named in plain words, not as a closed quarter', () => {
  const review = reviewOf({ ...b1.extraction, header: { ...b1.extraction.header, date_raw: '2.11.2024' } });
  const text = formatSummary(review, {}).text;
  assert.match(text, /^B1 · 2 Nov 2024 · Total ฿4,516/);
  assert.match(text, /⚠ Date reads 2 Nov 2024\. Check the year/);
  assert.doesNotMatch(text, /Jan to Mar|not open yet/);
  assert.match(text, /✗ Cannot book: the date looks wrong/);
});

test('approver-only texts are English; supplier drafts are not touched here', () => {
  assert.equal(readingPhoto(true), 'Got the photo. Reading it now. Summary in 1–3 min.');
  const help = helpText(true);
  for (const cmd of ['summary', 'stock', 'senders', 'id', 'cost B1 Nov 12000 rent']) assert.match(help, new RegExp(`^${cmd} · `, 'm'));
  assert.doesNotMatch(help, /trust written/);
  assert.doesNotMatch(help, THAI);
  for (const result of [
    { status: 'published', readback: { ok: true }, url: 'https://x' },
    { status: 'published', readback: { ok: false } },
    { status: 'held', plan: { held: [{ reasons: ['branch was not read'] }] } },
    { status: 'approved_not_deployed', reason: 'no token' },
    { status: 'deployed_readback_failed' },
    { status: 'error', step: 'commit', reason: 'boom' },
  ]) assert.doesNotMatch(resultMessage(result), THAI, result.status);
});
