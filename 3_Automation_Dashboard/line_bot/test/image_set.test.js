const test = require('node:test');
const assert = require('node:assert/strict');
const { emptySet, addPart, isComplete, orderedParts } = require('../lib/image_set');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

test('photos in one imageSet complete only when every index has arrived', () => {
  const state = emptySet('setA', 3);
  addPart(state, { messageId: 'm2', index: 2, total: 3, sha256: 'b' });
  assert.equal(isComplete(state), false);
  addPart(state, { messageId: 'm2', index: 2, total: 3, sha256: 'b' });
  assert.equal(isComplete(state), false);
  addPart(state, { messageId: 'm1', index: 1, total: 3, sha256: 'a' });
  addPart(state, { messageId: 'm3', index: 3, total: 3, sha256: 'c' });
  assert.equal(isComplete(state), true);
  assert.deepEqual(orderedParts(state).map(part => part.messageId), ['m1', 'm2', 'm3']);
});

test('a second message for the same index blocks the set', () => {
  const state = emptySet('setB', 2);
  addPart(state, { messageId: 'm1', index: 1, total: 2, sha256: 'a' });
  const again = addPart(state, { messageId: 'other', index: 1, total: 2, sha256: 'z' });
  assert.equal(again.complete, false);
  assert.equal(state.conflicts[0].type, 'index_conflict');
  assert.equal(isComplete(state), false);
});

test('a single photo with no imageSet is its own batch', () => {
  const state = emptySet('single:m9', 1);
  addPart(state, { messageId: 'm9', index: 1, total: 1, sha256: 'a' });
  assert.equal(isComplete(state), true);
});

function ctx() {
  const downloads = [];
  const pushes = [];
  const extracts = [];
  return {
    downloads, pushes, extracts,
    config: { channelSecret: 's', channelAccessToken: 't', groupId: 'C-good', ownerUserId: 'U-owner', geminiKey: 'k', geminiModel: 'm', publicUrl: 'https://somsaijailive.vercel.app' },
    store: new MemoryStore(),
    now: 1_700_000_000_000,
    line: {
      async getContent(id) {
        downloads.push(id);
        return { buf: Buffer.from('photo-' + id), contentType: 'image/jpeg' };
      },
      async reply() {},
      async push(to, messages) { pushes.push({ to, messages }); },
    },
    extractImage: async ({ buf }) => {
      extracts.push(buf.toString());
      return {
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
          date_raw: '17/10/2026', branch_raw: 'B2',
          sales: {
            cash_sales: { raw: '100', value: 100, state: 'observed' },
            scan_sales: { raw: '20', value: 20, state: 'observed' },
            total_sales: { raw: '120', value: 120, state: 'observed' },
          },
        },
      };
    },
  };
}

function imageEvent(id, index, total, setId, webhookEventId) {
  return {
    webhookEventId,
    type: 'message',
    timestamp: 1,
    replyToken: 'reply-' + id,
    source: { type: 'group', groupId: 'C-good', userId: 'U-staff' },
    message: { type: 'image', id, imageSet: { id: setId, index, total } },
  };
}

test('the webhook waits for the whole imageSet, then reads each photo once', async () => {
  const c = ctx();
  const secret = c.config.channelSecret;
  async function post(events) {
    const raw = Buffer.from(JSON.stringify({ events }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, secret), ctx: c });
  }
  const first = await post([imageEvent('m2', 2, 2, 'SET1', 'wh-2')]);
  assert.equal(first.status, 200);
  assert.equal(c.extracts.length, 0);
  assert.deepEqual(c.downloads, ['m2']);

  const second = await post([imageEvent('m1', 1, 2, 'SET1', 'wh-1')]);
  assert.equal(second.status, 200);
  assert.equal(c.extracts.length, 2);
  assert.equal(c.pushes.length, 1);
  assert.equal(c.pushes[0].to, 'U-owner');
  assert.match(c.pushes[0].messages[0].text, /ยังไม่เข้าระบบ/);

  const again = await post([imageEvent('m1', 1, 2, 'SET1', 'wh-1')]);
  assert.equal(again.outcomes[0].duplicate, true);
  assert.equal(c.extracts.length, 2);
  assert.deepEqual(c.downloads, ['m2', 'm1']);
  assert.equal(c.pushes.length, 1);
});

test('a photo from any other group is ignored', async () => {
  const c = ctx();
  const raw = Buffer.from(JSON.stringify({
    events: [{
      webhookEventId: 'wh-foreign',
      type: 'message',
      timestamp: 1,
      replyToken: 'r',
      source: { type: 'group', groupId: 'C-other', userId: 'U-x' },
      message: { type: 'image', id: 'mx' },
    }],
  }));
  const result = await handleWebhook({ rawBody: raw, signature: signBody(raw, c.config.channelSecret), ctx: c });
  assert.equal(result.status, 200);
  assert.equal(c.downloads.length, 0);
  assert.equal(c.extracts.length, 0);
  assert.equal(c.pushes.length, 0);
});
