const test = require('node:test');
const assert = require('node:assert/strict');
const { branchField, buildReview } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { buildChangePlan } = require('../lib/adapter');
const { handwritingFlags } = require('../lib/forms');
const { formatSummary } = require('../lib/summary');
const { extractImage, needsSecondReading, isRetryable, backoffMs, MAX_ATTEMPTS } = require('../lib/extractor');
const { loadConfig } = require('../lib/config');
const { handleWebhook, OCR_FAIL_TH } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { scheduleBackground } = require('../../api/webhook');

function money(value) {
  return { raw: String(value), value, state: 'observed' };
}

function clearExtraction(patch = {}) {
  return {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    image_quality: 'ok',
    header: { date_raw: '17/10/2026', branch_raw: 'B1', shift_raw: null },
    sales: {
      cash_sales: money(100),
      scan_sales: money(20),
      total_sales: money(120),
    },
    menu_rows: [{ item_raw: 'Orange', amount_raw: '120', amount_value: 120, qty_state: 'missing', uncertain: false }],
    uncertainties: [],
    ...patch,
  };
}

test('branch codes accept dots, hyphens, and spaces', () => {
  for (const raw of ['B.1', 'B.3', 'B-3', 'B 1', 'B - 3', 'b.2']) {
    const field = branchField(raw);
    assert.equal(field.state, 'observed', raw);
    assert.match(field.value, /^B[123]$/);
  }
  assert.equal(branchField('B.1').value, 'B1');
  assert.equal(branchField('B - 3').value, 'B3');
  assert.equal(branchField('B 1').value, 'B1');
});

test('a Daily Shop Report takes the branch from the Shift box', () => {
  const extraction = clearExtraction({
    form_template: 'daily_shop_report',
    header: { date_raw: '16/10/2026', branch_raw: null, shift_raw: 'B - 3' },
  });
  const review = applyChecks(buildReview({
    batchId: 'shift',
    images: [{
      sourceId: 'shop',
      sha256: 'h',
      extraction,
      second: { date_raw: '16/10/2026', branch_raw: null, shift_raw: 'B-3', sales: extraction.sales },
    }],
  }));
  assert.equal(review.records[0].branch.value, 'B3');
  assert.equal(review.records[0].branch.raw_text, 'B - 3');
  const clash = clearExtraction({
    form_template: 'daily_shop_report',
    header: { date_raw: '16/10/2026', branch_raw: 'B1', shift_raw: 'B-3' },
    sales: {
      cash_sales: money(10),
      scan_sales: money(0),
      total_sales: money(10),
    },
  });
  const disagreed = buildReview({
    batchId: 'clash',
    images: [{ sourceId: 'shop2', sha256: 'h', extraction: clash, second: { date_raw: '16/10/2026', branch_raw: 'B1', shift_raw: 'B-3', sales: clash.sales } }],
  });
  assert.equal(disagreed.records[0].branch.value, null);
  assert.deepEqual(disagreed.records[0].branch.alternatives, ['B1', 'B3']);
});

test('a skipped second reading keeps the first figures', () => {
  const extraction = clearExtraction({ header: { date_raw: '17/10/2026', branch_raw: 'B.1' } });
  const review = buildReview({
    batchId: 'once',
    images: [{ sourceId: 's', sha256: 'h', extraction, second: null, secondSkipped: true }],
  });
  const record = review.records[0];
  assert.equal(record.branch.value, 'B1');
  assert.equal(record.financials.cash_sales.value, 100);
  assert.equal(record.financials.total_sales.value, 120);
  assert.equal(record.issues.some(issue => /did not confirm/.test(issue.issue || '')), false);
});

test('handwritten price changes and extra flavors are flagged for review', () => {
  const items = [
    { item_raw: 'Guava', price_overridden_from: 65, price_overridden_to: 80 },
    { item_raw: 'Pineapple Cup Pome' },
    { item_raw: 'Mango Sticky Rice grape' },
    { item_raw: 'Volcano Pineapple Roseapple' },
    { item_raw: 'Mangosteen Grape (80)' },
    { item_raw: 'Mangosteen & Lychee Pomegra (150)' },
    { item_raw: 'Volcano Orange' },
    { item_raw: 'Mangosteen & Lychee' },
    { item_raw: 'Grape', struck: true },
  ];
  assert.equal(handwritingFlags(items[0])[0].kind, 'price_change');
  assert.ok(handwritingFlags(items[1]).some(flag => flag.kind === 'flavor_shift'));
  assert.ok(handwritingFlags(items[2]).some(flag => /grape/.test(flag.text)));
  assert.ok(handwritingFlags(items[3]).some(flag => /roseapple/.test(flag.text)));
  assert.ok(handwritingFlags(items[4]).some(flag => flag.kind === 'flavor_shift'));
  assert.ok(handwritingFlags(items[5]).some(flag => /pomegranate/.test(flag.text)));
  assert.equal(handwritingFlags(items[6]).length, 0);
  assert.equal(handwritingFlags(items[7]).length, 0);
  assert.ok(handwritingFlags(items[8]).some(flag => flag.kind === 'row_shift'));

  const extraction = clearExtraction({
    menu_rows: [{
      item_raw: 'Guava',
      price_overridden_from: 65,
      price_overridden_to: 80,
      qty_raw: '2',
      qty_value: 2,
      qty_state: 'observed',
      amount_raw: '160',
      amount_value: 160,
    }],
    sales: { cash_sales: money(160), scan_sales: money(0), total_sales: money(160) },
  });
  const review = applyChecks(buildReview({
    batchId: 'price',
    images: [{
      sourceId: 'p',
      sha256: 'h',
      extraction,
      second: { date_raw: '17/10/2026', branch_raw: 'B1', sales: extraction.sales },
    }],
  }));
  assert.equal(review.records[0].status, 'needs_review');
  assert.ok(review.issues.some(issue => issue.field === 'price_change'));
  assert.match(formatSummary(review, {}).text, /มีราคาหรือเมนูที่เขียนทับ/);
  const plan = buildChangePlan(review);
  assert.equal(plan.salesLists.length, 1);
});

test('arithmetic mismatches are marked and block the row', () => {
  const extraction = clearExtraction({
    sales: { cash_sales: money(100), scan_sales: money(20), total_sales: money(130), total_expense: money(10), net_sales: money(100) },
    menu_rows: [
      { item_raw: 'Orange', amount_raw: '80', amount_value: 80, qty_state: 'missing' },
      { item_raw: 'Apple', amount_raw: '40', amount_value: 40, qty_state: 'missing' },
    ],
  });
  const review = applyChecks(buildReview({
    batchId: 'math',
    images: [{
      sourceId: 'm',
      sha256: 'h',
      extraction,
      second: { date_raw: '17/10/2026', branch_raw: 'B1', sales: extraction.sales },
    }],
  }));
  assert.equal(review.checks.find(check => check.rule === 'channels').status, 'fail');
  assert.equal(review.checks.find(check => check.rule === 'line_sum').status, 'fail');
  assert.equal(review.checks.find(check => check.rule === 'net').status, 'fail');
  const plan = buildChangePlan(review);
  assert.equal(plan.salesLists.length, 0);
  assert.ok(plan.held[0].reasons.some(reason => /total/.test(reason)));
});

test('a consistent first reading does not spend a second Gemini call', async () => {
  const prompts = [];
  const reading = await extractImage({
    buf: Buffer.from('img'),
    model: 'gemini-3.5-flash',
    fallbackModel: 'gemini-3.8-flash',
    sleep: async () => {},
    generate: async ({ prompt }) => {
      prompts.push(prompt.slice(0, 12));
      return clearExtraction();
    },
  });
  assert.equal(prompts.length, 1);
  assert.equal(reading.secondSkipped, true);
  assert.equal(needsSecondReading(clearExtraction()).needed, false);
});

test('a low-confidence or unbalanced first reading gets one second call, not in parallel', async () => {
  let startedSecond = false;
  let firstFinished = false;
  const calls = [];
  const unbalanced = clearExtraction({
    sales: { cash_sales: money(100), scan_sales: money(20), total_sales: money(150) },
    menu_rows: [],
  });
  const reading = await extractImage({
    buf: Buffer.from('img'),
    model: 'gemini-3.5-flash',
    sleep: async () => {},
    generate: async ({ prompt }) => {
      const full = /Use this shape/.test(prompt);
      if (full) {
        calls.push('first');
        await new Promise(resolve => setTimeout(resolve, 20));
        assert.equal(startedSecond, false);
        firstFinished = true;
        return unbalanced;
      }
      startedSecond = true;
      assert.equal(firstFinished, true);
      calls.push('second');
      return { date_raw: '17/10/2026', branch_raw: 'B1', sales: unbalanced.sales };
    },
  });
  assert.deepEqual(calls, ['first', 'second']);
  assert.equal(reading.secondSkipped, false);
  assert.ok(reading.secondReasons.some(reason => /cash \+ QR/.test(reason)));
  const short = clearExtraction({ menu_rows: [{ item_raw: 'Orange', amount_value: 50, amount_state: 'observed' }] });
  assert.equal(needsSecondReading(short).needed, true);
});

test('503 and 429 back off, then the fallback model is used, and other errors do not retry', async () => {
  assert.equal(MAX_ATTEMPTS, 4);
  assert.equal(isRetryable(Object.assign(new Error('no'), { status: 503 })), true);
  assert.equal(isRetryable(Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 })), true);
  assert.equal(isRetryable(Object.assign(new Error('bad'), { status: 400 })), false);
  const waits = [backoffMs(1, () => 0), backoffMs(2, () => 0), backoffMs(3, () => 0)];
  assert.deepEqual(waits, [500, 1000, 2000]);
  assert.ok(backoffMs(1, () => 0.5) > 500 && backoffMs(1, () => 0.5) < 800);

  const models = [];
  const sleeps = [];
  let n = 0;
  const reading = await extractImage({
    buf: Buffer.from('img'),
    model: 'gemini-3.5-flash',
    fallbackModel: 'gemini-3.8-flash',
    random: () => 0,
    sleep: async (ms) => { sleeps.push(ms); },
    generate: async ({ model }) => {
      models.push(model);
      n += 1;
      if (n < 4) {
        const err = new Error(n === 3 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE');
        err.status = n === 3 ? 429 : 503;
        throw err;
      }
      return clearExtraction();
    },
  });
  assert.deepEqual(models, ['gemini-3.5-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.8-flash']);
  assert.deepEqual(sleeps, [500, 1000, 2000]);
  assert.equal(reading.secondSkipped, true);

  const once = [];
  await assert.rejects(() => extractImage({
    buf: Buffer.from('img'),
    model: 'gemini-3.5-flash',
    sleep: async () => { once.push('slept'); },
    generate: async () => {
      const err = new Error('invalid');
      err.status = 400;
      throw err;
    },
  }));
  assert.deepEqual(once, []);
});

test('a final OCR failure is replied in Thai and the event can be retried', async () => {
  const replies = [];
  const store = new MemoryStore();
  let calls = 0;
  const ctx = {
    config: { channelSecret: 's', groupId: 'C1', ownerUserId: 'U1', geminiModel: 'gemini-3.5-flash', geminiFallbackModel: 'gemini-3.8-flash' },
    store,
    now: 50,
    line: {
      async getContent() { return { buf: Buffer.from('photo'), contentType: 'image/jpeg' }; },
      async reply(_token, messages) { replies.push(messages[0].text); },
      async push() {},
    },
    extractImage: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('UNAVAILABLE'), { status: 503 });
      return { extraction: clearExtraction(), second: null, secondSkipped: true };
    },
  };
  const event = {
    webhookEventId: 'ocr-1',
    type: 'message',
    timestamp: 1,
    replyToken: 'r',
    source: { type: 'group', groupId: 'C1', userId: 'U-staff' },
    message: { type: 'image', id: 'mid' },
  };
  async function post() {
    const raw = Buffer.from(JSON.stringify({ events: [event] }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx });
  }
  const failed = await post();
  assert.equal(failed.outcomes[0].error != null, true);
  assert.equal(replies.length, 1);
  assert.match(replies[0], /ลองอ่านใหม่อีกครั้ง/);
  assert.match(replies[0], /ส่งรูปนี้อีกครั้ง/);
  assert.equal(replies[0], OCR_FAIL_TH);
  const claim = await store.getJson('event:ocr-1');
  assert.equal(claim.status, 'error');
  ctx.now = 80;
  const again = await post();
  assert.equal(again.outcomes[0].duplicate, undefined);
  assert.equal(again.outcomes[0].batch_id != null, true);
  assert.equal(calls, 2);
});

test('the webhook returns before OCR when Vercel can keep the function alive', async () => {
  let finished = false;
  const job = new Promise(resolve => {
    setTimeout(() => {
      finished = true;
      resolve({ status: 200, body: 'ok' });
    }, 30);
  });
  const pending = [];
  const scheduled = scheduleBackground(job, {
    vercel: true,
    hooks: { waitUntil(promise) { pending.push(promise); } },
  });
  assert.equal(scheduled.deferred, true);
  assert.equal(finished, false);
  const viaAfter = scheduleBackground(Promise.resolve({ status: 200 }), {
    vercel: true,
    hooks: { after(promise) { pending.push(promise); } },
  });
  assert.equal(viaAfter.deferred, true);
  await Promise.all(pending);
  const vercel = require('../../vercel.json');
  const webhook = require('../../api/webhook');
  assert.ok(webhook.config.maxDuration >= 120);
  assert.ok(vercel.functions['api/webhook.js'].maxDuration >= 120);
});

test('GEMINI_MODEL selects the reader and the fallback defaults to gemini-3.8-flash', () => {
  const configured = loadConfig({ GEMINI_MODEL: 'gemini-3.5-flash', GEMINI_OCR_MODEL: 'other', GEMINI_MODEL_FALLBACK: 'gemini-3.8-flash' });
  assert.equal(configured.geminiModel, 'gemini-3.5-flash');
  assert.equal(configured.geminiFallbackModel, 'gemini-3.8-flash');
  const legacy = loadConfig({ GEMINI_OCR_MODEL: 'custom-model' });
  assert.equal(legacy.geminiModel, 'custom-model');
  assert.equal(loadConfig({}).geminiFallbackModel, 'gemini-3.8-flash');
});
