const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { classifyItem } = require('../lib/forms');
const { buildReview } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { buildChangePlan } = require('../lib/adapter');
const { formatSummary } = require('../lib/summary');
const { FULL_PROMPT } = require('../lib/extractor');
const { parseGroupConfig } = require('../lib/config');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { shop, b1, b2 } = require('./fixtures/2026-10-16/readings');
const { normalizeDate, dateAgeIssue } = require('../lib/dates');

const FIXTURE_DIR = path.join(__dirname, 'fixtures', '2026-10-16');

function secondOf(extraction) {
  return {
    date_raw: extraction.header.date_raw,
    branch_raw: extraction.header.branch_raw,
    sales: extraction.sales,
    other: extraction.other,
  };
}

function reviewOf(page, hint) {
  const review = buildReview({
    batchId: 'oct16',
    now: new Date('2026-10-17T12:00:00+07:00'),
    images: [{
      sourceId: page.file,
      sha256: 'abc',
      contentType: 'image/png',
      extraction: page.extraction,
      second: secondOf(page.extraction),
      branch_hint: hint || null,
    }],
  });
  return applyChecks(review);
}

test('the 16 Oct photos are stored as fixtures', () => {
  for (const name of [
    'shop_report_tae_16oct.png',
    'sales_record_b1_16oct.png',
    'sales_record_b2_16oct.png',
    'line_group_album_tae.png',
    'line_group_album_b1_b2.png',
  ]) {
    const buf = fs.readFileSync(path.join(FIXTURE_DIR, name));
    assert.ok(buf.length > 10000, name);
    assert.equal(buf.subarray(0, 4).toString('hex'), '89504e47');
  }
});

test('single fruits map onto cup columns and mixed drinks do not', () => {
  assert.equal(classifyItem('Orange Cup (Regular)').code, 'or');
  assert.equal(classifyItem('Orange Premium Cup (100%)').code, 'or_100');
  assert.equal(classifyItem('Watermelon').code, 'wm');
  assert.equal(classifyItem('Guava').code, 'guava');
  assert.equal(classifyItem('Pineapple').code, 'pineapple');
  assert.equal(classifyItem('Apple').code, 'ap');
  assert.equal(classifyItem('Volcano Orange').code, null);
  assert.equal(classifyItem('Mango Sticky Rice').code, null);
  assert.equal(classifyItem('Mangosteen').code, 'mangosteen');
  assert.equal(classifyItem('Mangosteen Blended').code, 'mangosteen');
  assert.equal(classifyItem('Mangosteen & Lychee').code, 'mangosteen_lychee');
  assert.equal(classifyItem('Mangosteen Lychee Blended').code, 'mangosteen_lychee');
  assert.equal(classifyItem('Rambutan').code, 'rambutan');
  assert.equal(classifyItem('Rambutan Blended').code, 'rambutan');
  assert.equal(classifyItem('Pomegranate').code, null);
  assert.equal(classifyItem('Volcano Mangosteen').code, null);
});

test('the shop report keeps blank quantities and names every unmapped drink', () => {
  const review = reviewOf(shop, 'B3');
  assert.equal(review.review.import_allowed, false);
  const record = review.records[0];
  assert.equal(record.form_template, 'daily_shop_report');
  assert.equal(record.orientation, 'rotated');
  assert.equal(record.date.value, '16/10/2026');
  assert.equal(record.branch.state, 'missing');
  assert.equal(record.branch.value, null);
  const orange = record.sales_items.find(item => item.item_raw === 'Orange Cup (Regular)');
  assert.equal(orange.qty.value, null);
  assert.notEqual(orange.qty.state, 'observed');
  const summary = formatSummary(review, {}).text;
  assert.match(summary, /ชุด oct16/);
  assert.match(summary, /16\/10\/2026/);
  assert.match(summary, /เช็ค:/);
  assert.match(summary, /Volcano Orange/);
  assert.match(summary, /Mango Sticky Rice/);
  assert.match(summary, /ไม่มีช่องในตาราง/);
  assert.match(summary, /กลุ่มไลน์ตั้งไว้เป็น B3/);
  assert.match(summary, /ยังไม่เข้าระบบ/);
  const plan = buildChangePlan(review);
  assert.equal(plan.salesLists.length, 0);
  assert.equal(JSON.stringify(plan).includes('"or"'), false);
});

test('B1 keeps the conflicting grand total, the guava price change, and ice', () => {
  const review = reviewOf(b1);
  const record = review.records[0];
  assert.equal(record.form_template, 'daily_sales_record');
  assert.equal(record.branch.value, 'B1');
  assert.equal(record.date.raw_text, '16/10/26');
  assert.equal(record.date.value, '16/10/2026');
  assert.equal(record.date.state, 'observed');
  assert.equal(record.financials.scan_sales.value, 1125);
  assert.equal(record.financials.total_sales.value, null);
  assert.deepEqual(record.financials.total_sales.alternatives, [3089, 3090]);
  assert.equal(record.financials.cash_sales.value, null);
  const guava = record.sales_items.find(item => item.item_raw === 'Guava');
  assert.equal(guava.price_overridden_from, 65);
  assert.equal(guava.price_overridden_to, 80);
  assert.equal(guava.qty.value, 15);
  const pineapple = record.sales_items.find(item => item.item_raw === 'Pineapple');
  assert.equal(pineapple.qty.value, null);
  assert.equal(record.other.ice.value, 120);
  const summary = formatSummary(review, {}).text;
  assert.match(summary, /ชุด oct16/);
  assert.match(summary, /B1 16\/10\/2026/);
  assert.match(summary, /เช็ค:/);
  assert.match(summary, /น้ำแข็ง 120/);
  assert.match(summary, /Pomegranate/);
  assert.match(summary, /ขีดฆ่า/);
  assert.match(summary, /3089/);
  const plan = buildChangePlan(review);
  assert.equal(plan.salesLists.length, 0);
  assert.equal(review.review.import_allowed, false);
});

test('B2 uses the bracket counts, does not treat the unread column as cups, and the payment box is 2743 / 1315 / 4058', () => {
  const review = reviewOf(b2);
  const record = review.records[0];
  assert.equal(record.branch.value, 'B2');
  assert.equal(record.date.raw_text, '16/10/26');
  assert.equal(record.date.value, '16/10/2026');
  assert.equal(record.date.state, 'observed');
  assert.equal(record.issues.some(issue => issue.field === 'date_age'), false);
  assert.equal(record.financials.cash_sales.value, 2743);
  assert.equal(record.financials.scan_sales.value, 1315);
  assert.equal(record.financials.total_sales.value, 4058);
  const channels = review.checks.find(check => check.rule === 'channels');
  assert.equal(channels.status, 'pass');
  const orange = record.sales_items.find(item => item.item_raw === 'Orange');
  assert.equal(orange.cash_qty.value, 6);
  assert.equal(orange.scan_qty.value, 2);
  assert.equal(orange.qty.value, null);
  assert.equal(orange.amount.value, null);
  const mango = record.sales_items.find(item => item.item_raw === 'Mangosteen & Lychee');
  assert.equal(mango.cash_qty.value, 2);
  assert.equal(mango.scan_qty.value, 1);
  assert.equal(record.other.ice.value, 60);
  const note = review.checks.find(check => check.rule === 'note_equation');
  assert.equal(note.status, 'pass');
  const against = review.checks.find(check => check.rule === 'note_vs_payment');
  assert.equal(against, undefined);
  const packed = formatSummary(review, { publicUrl: 'https://somsaijailive.vercel.app', channelSecret: 's' });
  const summary = packed.text;
  assert.match(summary, /ชุด oct16/);
  assert.match(summary, /B2 16\/10\/2026/);
  assert.match(summary, /4,058/);
  assert.match(summary, /สด\+สแกน ผ่าน/);
  assert.match(summary, /2743 - 60 = 2683/);
  assert.match(summary, /น้ำแข็ง 60/);
  assert.match(summary, /ยังไม่เข้าระบบ/);
  assert.equal(packed.messages[1].template.actions[0].data, 'action=approve&batch=oct16');
  assert.equal(packed.messages[1].template.actions[1].data, 'action=reject&batch=oct16');
  assert.equal(packed.messages[1].template.actions[0].label, 'อนุมัติ');
  assert.equal(packed.messages[1].template.actions[1].label, 'ไม่รับ');
  const plan = buildChangePlan(review);
  assert.equal(plan.held.length, 0);
  assert.equal(plan.salesLists.length, 1);
  const row = plan.salesLists[0].rows[0];
  assert.equal(row.date, '16/10/2026');
  assert.equal(row.revenue, 4058);
  assert.equal(row.cash, 2743);
  assert.equal(row.scan, 1315);
  assert.equal(row.mangosteen, undefined);
  assert.equal(row.or, undefined);
  const imported = JSON.stringify(plan.salesLists);
  assert.equal(imported.includes('640'), false);
});

test('a two-digit year is 20xx, and a future or stale date stays expanded but is flagged', () => {
  assert.equal(normalizeDate('1/10/26').value, '01/10/2026');
  assert.equal(normalizeDate('1/10/26').state, 'observed');
  assert.equal(normalizeDate('16/10/26').value, '16/10/2026');
  assert.equal(normalizeDate('25/08/2569').value, '25/08/2026');
  assert.equal(normalizeDate('32/10/26').value, null);
  const now = new Date('2026-10-17T12:00:00+07:00');
  assert.equal(dateAgeIssue('16/10/2026', now), null);
  assert.equal(dateAgeIssue('18/08/2026', now), null);
  assert.match(dateAgeIssue('17/08/2026', now), /more than 60 days old/);
  assert.match(dateAgeIssue('18/10/2026', now), /future/);

  const extraction = {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    header: { date_raw: '1/10/26', branch_raw: 'B1' },
    sales: {
      cash_sales: { raw: '258', value: 258, state: 'observed' },
      scan_sales: { raw: '129', value: 129, state: 'observed' },
      total_sales: { raw: '387', value: 387, state: 'observed' },
    },
    menu_rows: [
      { item_raw: 'Mangosteen', price_raw: 129, qty_raw: '1', qty_value: 1, qty_state: 'observed' },
      { item_raw: 'Mangosteen & Lychee', price_raw: 129, qty_raw: '1', qty_value: 1, qty_state: 'observed' },
      { item_raw: 'Rambutan', price_raw: 129, qty_raw: '1', qty_value: 1, qty_state: 'observed' },
    ],
  };
  const review = applyChecks(buildReview({
    batchId: 'flavors',
    now,
    images: [{ sourceId: 'b1-oct', sha256: 'h', extraction, second: secondOf(extraction) }],
  }));
  const record = review.records[0];
  assert.equal(record.date.value, '01/10/2026');
  assert.equal(record.issues.some(issue => issue.field === 'date_age'), false);
  const plan = buildChangePlan(review);
  const row = plan.salesLists[0].rows[0];
  assert.equal(row.mangosteen, 1);
  assert.equal(row.mangosteen_lychee, 1);
  assert.equal(row.rambutan, 1);
  assert.equal(row.or, undefined);

  const stale = applyChecks(buildReview({
    batchId: 'old',
    now,
    images: [{
      sourceId: 'old',
      sha256: 'h',
      extraction: { ...extraction, header: { date_raw: '1/8/26', branch_raw: 'B1' } },
      second: { date_raw: '1/8/26', branch_raw: 'B1', sales: extraction.sales },
    }],
  }));
  assert.equal(stale.records[0].date.value, '01/08/2026');
  assert.equal(stale.records[0].status, 'needs_review');
  assert.match(stale.issues.find(issue => issue.field === 'date_age').issue, /60 days/);
  assert.equal(buildChangePlan(stale).salesLists.length, 1);
});

test('a baht figure in the total column is not stored as a cup count', () => {
  const extraction = {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    header: { date_raw: '16/10/2026', branch_raw: 'B2' },
    sales: {
      cash_sales: { raw: '160', value: 160, state: 'observed' },
      scan_sales: { raw: '0', value: 0, state: 'observed' },
      total_sales: { raw: '160', value: 160, state: 'observed' },
    },
    menu_rows: [{
      item_raw: 'Orange',
      price_raw: 80,
      cash_qty: { raw: '(2)', value: 2, state: 'observed' },
      scan_qty: { raw: '(0)', value: 0, state: 'observed' },
      qty_state: 'missing',
      amount_raw: '160',
      amount_value: 160,
    }],
    other: { ice: { raw: '20', value: 20, state: 'observed' } },
  };
  const review = applyChecks(buildReview({
    batchId: 'column',
    images: [{ sourceId: 's', sha256: 'h', extraction, second: secondOf(extraction) }],
  }));
  const orange = review.records[0].sales_items[0];
  assert.equal(orange.qty.value, null);
  assert.equal(orange.amount.value, 160);
  const plan = buildChangePlan(review);
  const row = plan.salesLists[0].rows[0];
  assert.equal(row.revenue, 160);
  assert.equal(row.or, undefined);
  assert.equal(row.exp, undefined);
  assert.match(formatSummary(review, {}).text, /น้ำแข็ง 20/);
});

test('a group list maps each id to a branch and a foreign group is ignored', async () => {
  const table = parseGroupConfig('Cplatinum:B3, Cbangkok, Cother:b1');
  assert.equal(table.get('Cplatinum'), 'B3');
  assert.equal(table.get('Cbangkok'), null);
  assert.equal(table.get('Cother'), 'B1');
  const replies = [];
  const store = new MemoryStore();
  const ctx = {
    config: { channelSecret: 's', groupId: 'Cplatinum:B3,Cbangkok', ownerUserId: 'U-parn' },
    store,
    now: 10,
    line: {
      async getContent() { return { buf: Buffer.from('x'), contentType: 'image/png' }; },
      async reply(_token, messages) { replies.push(messages); },
      async push() {},
    },
    extractImage: async () => ({ extraction: shop.extraction, second: secondOf(shop.extraction) }),
  };
  const event = {
    webhookEventId: 'g1',
    type: 'message',
    timestamp: 1,
    replyToken: 'r',
    source: { type: 'group', groupId: 'Cplatinum', userId: 'U-tae' },
    message: { type: 'text', id: 't1', text: 'ช่วย' },
  };
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  const help = await handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx });
  assert.equal(help.outcomes[0].help, true);
  assert.match(replies[0][0].text, /not as an album/i);
  assert.doesNotMatch(replies[0][0].text, /[\u0E00-\u0E7F]/);
  const photo = {
    ...event,
    webhookEventId: 'g2',
    message: { type: 'image', id: 'p1' },
  };
  const rawPhoto = Buffer.from(JSON.stringify({ events: [photo] }));
  await handleWebhook({ rawBody: rawPhoto, signature: signBody(rawPhoto, 's'), ctx });
  assert.match(replies.at(-1)[0].text, /Summary sent to Parn/);
  assert.match(replies.at(-1)[0].text, /Not saved/);
  assert.doesNotMatch(replies.at(-1)[0].text, /[\u0E00-\u0E7F]/);
  const saved = await store.getJson('review:set_singlep1');
  assert.ok(saved);
  assert.equal(saved.records[0].branch_hint, 'B3');
  assert.equal(saved.records[0].branch.value, null);
  const foreign = {
    ...photo,
    webhookEventId: 'g3',
    source: { type: 'group', groupId: 'C-nope', userId: 'U-x' },
  };
  const rawForeign = Buffer.from(JSON.stringify({ events: [foreign] }));
  const ignored = await handleWebhook({ rawBody: rawForeign, signature: signBody(rawForeign, 's'), ctx });
  assert.equal(ignored.outcomes[0].ignored, 'foreign_group');
});

test('the prompt knows both paper forms and does not invent scan', () => {
  assert.match(FULL_PROMPT, /DAILY SHOP REPORT/);
  assert.match(FULL_PROMPT, /Daily Sales Record/);
  assert.match(FULL_PROMPT, /Never set scan = total - cash/);
  assert.match(FULL_PROMPT, /Total Qty sometimes contains baht/);
  assert.match(FULL_PROMPT, /Shift box/);
});
