const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { loadCatalog, parseOrder, buildOrderMessages, packBubbles, normalizeUnit } = require('../lib/orders');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

const EXAMPLE = [
  'Orders for tomorrow, please @Parn',
  'Watermelon -40',
  'Pomegranate -3',
  'Apple-3',
  'Guava-50Kg',
].join('\n');

const catalog = loadCatalog(path.join(__dirname, '..', 'orders', 'suppliers.json'));

function draft(parsed, id) {
  return parsed.drafts.find(row => row.supplierId === id);
}

test('the supplier file loads the three shops and leaves guava with Ming', () => {
  assert.deepEqual([...catalog.suppliers.keys()], ['kob', 'phao', 'porn']);
  assert.equal(catalog.items.get('guava').handled_by, 'ming');
  assert.equal(catalog.items.get('guava').supplier, undefined);
  assert.equal(catalog.suppliers.get('porn').message, 'วันนี้ราคาเท่าไหร่ครับ');
});

test('Ming\'s example parses into supplier drafts and leaves guava out of them', () => {
  const parsed = parseOrder(EXAMPLE, catalog);
  assert.equal(parsed.isOrder, true);
  assert.deepEqual(parsed.items.map(item => [item.id, item.qty, item.display_unit]), [
    ['watermelon', 40, 'ลูก'],
    ['pomegranate', 3, 'กล่อง'],
    ['apple', 3, 'กล่อง'],
    ['guava', 50, 'กก'],
  ]);
  assert.deepEqual(parsed.unknown, []);
  assert.equal(parsed.items.find(item => item.id === 'guava').handled_by, 'ming');
  assert.equal(draft(parsed, 'kob').text, 'วันนี้ 40 ลูกครับผม');
  assert.equal(draft(parsed, 'phao').text, [
    'สวัสดีครับผม',
    'ทับทิม - 3',
    'แอปเปิ้ล - 3',
    'ส่งร้านแตงโมครับผม',
  ].join('\n'));
  assert.equal(draft(parsed, 'porn'), undefined);
  assert.equal(parsed.drafts.some(row => /ฝรั่ง|guava|Guava/i.test(row.text)), false);

  const packed = buildOrderMessages(parsed, catalog);
  assert.equal(packed.messages.length, 3);
  assert.match(packed.messages[0].text, /ฝรั่ง 50 กก → คุณเมนสั่งเอง/);
  assert.match(packed.messages[0].text, /บอทไม่ได้ส่งให้ร้าน/);
  assert.equal(packed.messages[1].text, 'วันนี้ 40 ลูกครับผม');
  assert.match(packed.messages[2].text, /ทับทิม - 3/);
  assert.doesNotMatch(packed.messages[1].text, /พี่กบ/);
});

test('spacing, dashes, Thai names, and kg versus boxes stay on the right supplier', () => {
  const parsed = parseOrder([
    'แตงโม: 40 ลูก',
    'แอปเปิล-3',
    'grape - 2 boxes',
    'สาลี่ 1 กล่อง',
    'มะม่วง - ๔ กก.',
    'Guava - 2.5 kg',
  ].join('\n'), catalog);
  assert.deepEqual(parsed.items.map(item => `${item.id}:${item.qty}:${item.display_unit}`), [
    'watermelon:40:ลูก',
    'apple:3:กล่อง',
    'grapes:2:กล่อง',
    'pear:1:กล่อง',
    'mango:4:กก',
    'guava:2.5:กก',
  ]);
  assert.equal(draft(parsed, 'kob').text, 'วันนี้ 40 ลูกครับผม');
  assert.match(draft(parsed, 'phao').text, /องุ่น - 2/);
  assert.match(draft(parsed, 'phao').text, /สาลี่ - 1/);
  assert.equal(draft(parsed, 'porn').text, 'วันนี้ราคาเท่าไหร่ครับ');
  assert.doesNotMatch(draft(parsed, 'porn').text, /4/);
  const packed = buildOrderMessages(parsed, catalog);
  assert.match(packed.messages[0].text, /มะม่วง 4 กก → เจ๊พร \(ถามราคาก่อน\)/);
});

test('unknown fruit is flagged and pineapple is not filed under apple', () => {
  const parsed = parseOrder([
    'Orders for tomorrow',
    'Pineapple - 4',
    'Orange-10',
    'Apple - 1',
  ].join('\n'), catalog);
  assert.deepEqual(parsed.unknown.map(row => row.name), ['Pineapple', 'Orange']);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].id, 'apple');
  assert.equal(parsed.drafts.length, 1);
  assert.doesNotMatch(parsed.drafts[0].text, /Pineapple|Orange|สับปะรด|ส้ม/);
  const packed = buildOrderMessages(parsed, catalog);
  assert.match(packed.messages[0].text, /Pineapple 4 ไม่บอกหน่วย → ไม่รู้จักสินค้านี้/);
  assert.match(packed.messages[0].text, /Orange 10 ไม่บอกหน่วย → ไม่รู้จักสินค้านี้/);
});

test('a chat line that is not an order is ignored', () => {
  assert.equal(parseOrder('ได้ 300 แล้ว', catalog).isOrder, false);
  assert.equal(parseOrder('hello', catalog).isOrder, false);
  assert.equal(parseOrder('Orange - 5', catalog).isOrder, false);
});

test('a unit Ming wrote is kept when it is not the usual one', () => {
  const parsed = parseOrder('Watermelon - 40 kg', catalog);
  assert.equal(parsed.items[0].display_unit, 'กก');
  assert.equal(draft(parsed, 'kob').text, 'วันนี้ครับผม\nแตงโม 40 กก');
  assert.equal(normalizeUnit('Kg'), 'กก');
});

test('two lines of the same fruit are added and the summary says so', () => {
  const parsed = parseOrder('Watermelon - 10\nWatermelon - 30', catalog);
  assert.equal(draft(parsed, 'kob').text, 'วันนี้ 40 ลูกครับผม');
  const packed = buildOrderMessages(parsed, catalog);
  assert.match(packed.messages[0].text, /แตงโม 40 ลูก → พี่กบ รวมจากหลายบรรทัด/);
});

test('more than four supplier drafts still fit in one five-bubble push', () => {
  const summary = { type: 'text', text: 'สรุป' };
  const bubbles = [1, 2, 3, 4, 5, 6].map(n => ({ type: 'text', text: `ร้าน ${n}` }));
  const packed = packBubbles(summary, bubbles);
  assert.equal(packed.length, 5);
  assert.match(packed[4].text, /ร้าน 5/);
  assert.match(packed[4].text, /ร้าน 6/);
});

function orderEvent(text, userId, extra) {
  return {
    webhookEventId: extra && extra.webhookEventId || 'order-1',
    type: 'message',
    timestamp: 5,
    replyToken: 'reply-1',
    source: { type: 'user', userId },
    message: { type: 'text', id: 'm1', text },
    ...extra,
  };
}

function harness(overrides) {
  const pushes = [];
  const replies = [];
  const store = new MemoryStore();
  const config = Object.assign({
    channelSecret: 's',
    ownerUserId: 'U-parn',
    groupId: 'C-staff',
    orderSenderUserIds: ['U-ming'],
    suppliersPath: path.join(__dirname, '..', 'orders', 'suppliers.json'),
  }, overrides && overrides.config);
  const ctx = {
    config,
    store,
    now: 10,
    line: {
      async push(to, messages) {
        pushes.push({ to, messages });
        if (overrides && overrides.pushFails) throw new Error('quota');
      },
      async reply(token, messages) { replies.push({ token, messages }); },
    },
  };
  return { pushes, replies, store, ctx };
}

async function post(ctx, event) {
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, ctx.config.channelSecret), ctx });
}

test('Ming\'s 1:1 order replies to her and pushes Parn exactly once', async () => {
  const { pushes, replies, ctx } = harness();
  const result = await post(ctx, orderEvent(EXAMPLE, 'U-ming'));
  assert.equal(result.status, 200);
  assert.equal(result.outcomes[0].pushed, true);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].to, 'U-parn');
  assert.equal(pushes[0].messages.length, 3);
  assert.equal(pushes[0].messages[1].text, 'วันนี้ 40 ลูกครับผม');
  assert.equal(replies.length, 1);
  assert.match(replies[0].messages[0].text, /Watermelon 40 ลูก → พี่กบ/);
  assert.match(replies[0].messages[0].text, /Guava 50 กก คุณเมนสั่งเอง/);
  assert.match(replies[0].messages[0].text, /ส่งร่างให้คุณปานแล้ว/);
});

test('the same webhook event does not push a second time', async () => {
  const { pushes, ctx } = harness();
  const event = orderEvent(EXAMPLE, 'U-ming');
  await post(ctx, event);
  await post(ctx, event);
  assert.equal(pushes.length, 1);
});

test('Parn sending the order gets the drafts as a reply and spends no push', async () => {
  const { pushes, replies, ctx } = harness();
  const result = await post(ctx, orderEvent(EXAMPLE, 'U-parn', { webhookEventId: 'from-parn' }));
  assert.equal(result.outcomes[0].pushed, false);
  assert.equal(pushes.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].messages[1].text, 'วันนี้ 40 ลูกครับผม');
});

test('a stranger and a staff-group message are not drafted', async () => {
  const { pushes, replies, ctx } = harness();
  await post(ctx, orderEvent(EXAMPLE, 'U-stranger', { webhookEventId: 'stranger' }));
  await post(ctx, orderEvent(EXAMPLE, 'U-ming', {
    webhookEventId: 'in-group',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-ming' },
  }));
  assert.equal(pushes.length, 0);
  assert.equal(replies.length, 0);
});

test('ออเดอร์ repeats the last drafts as a reply', async () => {
  const { pushes, replies, ctx } = harness();
  await post(ctx, orderEvent(EXAMPLE, 'U-ming'));
  replies.length = 0;
  const again = await post(ctx, orderEvent('ออเดอร์', 'U-parn', { webhookEventId: 'replay' }));
  assert.equal(again.outcomes[0].order_replay, true);
  assert.equal(pushes.length, 1);
  assert.equal(replies[0].messages[1].text, 'วันนี้ 40 ลูกครับผม');
});

test('id still answers in the 1:1 chat', async () => {
  const { replies, ctx } = harness();
  await post(ctx, orderEvent('id', 'U-ming', { webhookEventId: 'id-1' }));
  assert.match(replies[0].messages[0].text, /U-ming/);
});
