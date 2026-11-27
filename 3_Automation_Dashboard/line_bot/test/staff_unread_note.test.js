const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

const money = value => ({ raw: String(value), value, state: 'observed' });

function sheet(patch = {}) {
  return {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    image_quality: 'ok',
    header: { date_raw: '17/10/2026', branch_raw: 'B1', shift_raw: null },
    sales: { cash_sales: money(100), scan_sales: money(20), total_sales: money(120) },
    menu_rows: [{ item_raw: 'Orange', amount_raw: '120', amount_value: 120, qty_state: 'missing', uncertain: false }],
    uncertainties: [],
    ...patch,
  };
}

function setup(readings, options = {}) {
  const replies = [];
  const pushes = [];
  let n = 0;
  const ctx = {
    config: { channelSecret: 's', groupId: 'C1', ownerUserId: 'U-parn', publicUrl: 'https://x' },
    store: new MemoryStore(),
    now: Date.parse('2026-10-18T03:00:00Z'),
    replyHoldMs: options.holdMs,
    line: {
      async getContent(id) { return { buf: Buffer.from(`photo-${id}`), contentType: 'image/jpeg' }; },
      async reply(token, messages) { replies.push({ token, text: messages[0].text }); },
      async push(to, messages) { pushes.push({ to, text: messages[0].text }); },
    },
    extractImage: async () => {
      const reading = readings[Math.min(n, readings.length - 1)];
      n += 1;
      if (options.delayMs) await new Promise(r => setTimeout(r, options.delayMs));
      return { extraction: reading.first, second: reading.second || null, secondSkipped: !reading.second };
    },
  };
  return { ctx, replies, pushes };
}

function photo(id, extra = {}) {
  return {
    webhookEventId: `e-${id}`, type: 'message', timestamp: 1, replyToken: `r-${id}`,
    source: { type: 'group', groupId: 'C1', userId: 'U-staff' },
    message: { type: 'image', id, ...extra },
  };
}

async function send(ctx, event) {
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx });
}

test('a clean sheet gets the usual English reply and no Thai note', async () => {
  const { ctx, replies, pushes } = setup([{ first: sheet() }]);
  await send(ctx, photo('p1'));
  assert.deepEqual(replies.map(r => r.text), ['Summary sent to Parn. Not saved yet.']);
  assert.equal(pushes.filter(p => p.to === 'U-parn').length, 1);
});

test('missing branch, date and Scan are named in Thai on the same reply token, and the card still goes to Parn', async () => {
  const blank = { raw: null, value: null, state: 'missing' };
  const { ctx, replies, pushes } = setup([{
    first: sheet({ header: { date_raw: null, branch_raw: null }, sales: { cash_sales: money(100), scan_sales: blank, total_sales: money(120) } }),
  }]);
  ctx.config.groupId = 'C1';
  await send(ctx, photo('p2'));
  assert.equal(replies.length, 1);
  assert.equal(replies[0].token, 'r-p2');
  assert.equal(replies[0].text, [
    'ใบยอด รูปที่ 1 อ่านไม่ชัด สาขา, วันที่, สแกน (Scan)',
    'รบกวนถ่ายรูปใหม่ให้ชัดและเห็นครบทั้งแผ่น แล้วส่งอีกครั้ง หรือพิมพ์ตัวเลขช่องนั้นส่งมาในแชทนี้ได้เลย',
  ].join('\n'));
  assert.equal(pushes.filter(p => p.to === 'U-parn').length, 1);
  assert.equal(pushes.filter(p => p.to === 'C1').length, 0);
});

test('two readings of the Total that disagree are both shown to staff', async () => {
  const first = sheet({ sales: { cash_sales: money(5140), scan_sales: money(2960), total_sales: { raw: '8103', value: 8103, state: 'observed' } } });
  const second = { date_raw: '17/10/2026', branch_raw: 'B1', sales: { cash_sales: money(5140), scan_sales: money(2960), total_sales: { raw: '8100', value: 8100, state: 'observed' } } };
  const { ctx, replies } = setup([{ first, second }]);
  await send(ctx, photo('p3'));
  assert.equal(replies.length, 1);
  assert.match(replies[0].text, /^ใบยอด B1 17\/10 อ่านไม่ชัด ยอดรวม \(Total\) อ่านได้ 8,103 หรือ 8,100/);
});

test('a photo set gets one Thai note for the whole set', async () => {
  const blank = { raw: null, value: null, state: 'illegible' };
  const { ctx, replies } = setup([
    { first: sheet({ sales: { cash_sales: blank, scan_sales: money(20), total_sales: money(120) } }) },
    { first: sheet({ header: { date_raw: '18/10/2026', branch_raw: 'B1' } }) },
  ]);
  await send(ctx, photo('s1', { imageSet: { id: 'set9', index: 1, total: 2 } }));
  await send(ctx, photo('s2', { imageSet: { id: 'set9', index: 2, total: 2 } }));
  const thai = replies.filter(r => /[\u0E00-\u0E7F]/.test(r.text));
  assert.equal(thai.length, 1);
  assert.match(thai[0].text, /เงินสด \(Cash\)/);
  assert.equal(thai[0].token, 'r-s2');
});

test('a read slower than the hold sends "reading it now" and spends no push on staff', async () => {
  const blank = { raw: null, value: null, state: 'illegible' };
  const { ctx, replies, pushes } = setup([{ first: sheet({ sales: { cash_sales: blank, scan_sales: money(20), total_sales: money(120) } }) }], { holdMs: 5, delayMs: 30 });
  await send(ctx, photo('p4'));
  assert.equal(replies.length, 1);
  assert.match(replies[0].text, /Reading it now/);
  assert.equal(pushes.filter(p => p.to === 'C1').length, 0);
});
