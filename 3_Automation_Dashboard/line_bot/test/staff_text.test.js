const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const {
  isIdCommand,
  isReviewCommand,
  isHelpCommand,
  isOrderCommand,
  ALBUM_HELP,
  OCR_FAIL,
} = require('../lib/staff_text');

const THAI = /[\u0E00-\u0E7F]/;

test('English aliases and Thai commands match, with any case and surrounding spaces', () => {
  for (const text of ['id', 'ID', '  /id  ', 'ไอดี']) assert.equal(isIdCommand(text), true);
  for (const text of ['summary', 'Summary', '  /summary  ', 'review', 'สรุป', '  สรุป  ']) {
    assert.equal(isReviewCommand(text), true);
  }
  for (const text of ['help', 'HELP', '  /help ', 'ช่วย', 'วิธีส่งรูป']) assert.equal(isHelpCommand(text), true);
  for (const text of ['order', 'ORDER', '  /order  ', 'ออเดอร์', '  ออเดอร์ ']) assert.equal(isOrderCommand(text), true);
  assert.equal(isReviewCommand('summary please'), false);
  assert.equal(isOrderCommand('order watermelon'), false);
  assert.match(ALBUM_HELP, /one by one/i);
  assert.match(ALBUM_HELP, /not as an album/i);
  assert.doesNotMatch(ALBUM_HELP, THAI);
  assert.doesNotMatch(OCR_FAIL, THAI);
});

function ctx(overrides) {
  const replies = [];
  return {
    replies,
    config: Object.assign({
      channelSecret: 's',
      ownerUserId: 'U-parn',
      groupId: 'C-staff',
      orderSenderUserIds: ['U-ming'],
      publicUrl: 'https://somsaijailive.vercel.app',
    }, overrides),
    store: new MemoryStore(),
    now: 20,
    line: {
      async getContent() { return { buf: Buffer.from('photo'), contentType: 'image/jpeg' }; },
      async reply(_token, messages) { replies.push(messages.map(message => message.text).join('\n')); },
      async push() { throw new Error('quota'); },
    },
    extractImage: async () => ({
      extraction: {
        document_type: 'sales_report',
        header: { date_raw: '17/10/2026', branch_raw: 'B2' },
        sales: {
          cash_sales: { raw: '100', value: 100, state: 'observed' },
          scan_sales: { raw: '20', value: 20, state: 'observed' },
          total_sales: { raw: '120', value: 120, state: 'observed' },
        },
        menu_rows: [],
      },
      second: {
        date_raw: '17/10/2026',
        branch_raw: 'B2',
        sales: {
          cash_sales: { raw: '100', value: 100, state: 'observed' },
          scan_sales: { raw: '20', value: 20, state: 'observed' },
          total_sales: { raw: '120', value: 120, state: 'observed' },
        },
      },
    }),
  };
}

async function post(ctx, event) {
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, ctx.config.channelSecret), ctx });
}

test('group id, help, and a denied summary are simple English', async () => {
  const c = ctx();
  await post(c, {
    webhookEventId: 'id-group',
    type: 'message',
    timestamp: 1,
    replyToken: 'r1',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
    message: { type: 'text', id: 'm', text: 'id' },
  });
  assert.match(c.replies[0], /Your id: U-staff/);
  assert.match(c.replies[0], /Group id: C-staff/);
  assert.match(c.replies[0], /one by one/);
  assert.doesNotMatch(c.replies[0], THAI);

  await post(c, {
    webhookEventId: 'help-group',
    type: 'message',
    timestamp: 1,
    replyToken: 'r2',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
    message: { type: 'text', id: 'm2', text: '  ช่วย  ' },
  });
  assert.match(c.replies[1], /not as an album/i);
  assert.doesNotMatch(c.replies[1], THAI);

  await post(c, {
    webhookEventId: 'sum-group',
    type: 'message',
    timestamp: 1,
    replyToken: 'r3',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-parn' },
    message: { type: 'text', id: 'm3', text: 'summary' },
  });
  assert.match(c.replies[2], /private chat/i);
  assert.doesNotMatch(c.replies[2], THAI);
});

test('a photo ack stays English when the private summary cannot be pushed', async () => {
  const c = ctx();
  const result = await post(c, {
    webhookEventId: 'photo-1',
    type: 'message',
    timestamp: 1,
    replyToken: 'r',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
    message: { type: 'image', id: 'pic' },
  });
  assert.equal(result.outcomes[0].batch_id != null, true);
  assert.match(c.replies[0], /private summary could not be sent/);
  assert.match(c.replies[0], /send summary/);
  assert.doesNotMatch(c.replies[0], THAI);
});

test('a staff member who taps approve is told in English', async () => {
  const c = ctx();
  await post(c, {
    webhookEventId: 'tap',
    type: 'postback',
    timestamp: 1,
    replyToken: 'r',
    source: { type: 'user', userId: 'U-staff' },
    postback: { data: 'action=approve&batch=set_x' },
  });
  assert.equal(c.replies[0], 'Only Parn can approve this.');
});

test('a processing error in the group is English', async () => {
  const c = ctx();
  c.line.getContent = async () => { throw new Error('download failed'); };
  await post(c, {
    webhookEventId: 'boom',
    type: 'message',
    timestamp: 1,
    replyToken: 'r',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
    message: { type: 'image', id: 'pic' },
  });
  assert.match(c.replies[0], /^Something went wrong: download failed/);
  assert.doesNotMatch(c.replies[0], THAI);
});
