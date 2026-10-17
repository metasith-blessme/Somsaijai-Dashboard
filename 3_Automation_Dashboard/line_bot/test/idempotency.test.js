const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

test('a redelivered webhook event downloads the photo once', async () => {
  const downloads = [];
  const store = new MemoryStore();
  const config = { channelSecret: 's', groupId: 'C1', ownerUserId: 'U1', publicUrl: 'https://somsaijailive.vercel.app' };
  const event = {
    webhookEventId: '01SAME',
    deliveryContext: { isRedelivery: false },
    type: 'message',
    timestamp: 5,
    replyToken: 'r',
    source: { type: 'group', groupId: 'C1', userId: 'U-staff' },
    message: { type: 'image', id: 'mid-1' },
  };
  const ctx = {
    config, store, now: 10,
    line: {
      async getContent(id) { downloads.push(id); return { buf: Buffer.from('x'), contentType: 'image/jpeg' }; },
      async reply() {},
      async push() {},
    },
    extractImage: async () => ({
      extraction: {
        document_type: 'unreadable',
        header: {},
        sales: {},
      },
      second: null,
      secondError: 'stopped',
    }),
  };
  async function post(redelivery) {
    const raw = Buffer.from(JSON.stringify({ events: [{ ...event, deliveryContext: { isRedelivery: redelivery } }] }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx });
  }
  const first = await post(false);
  const second = await post(true);
  assert.equal(first.status, 200);
  assert.equal(second.outcomes[0].duplicate, true);
  assert.deepEqual(downloads, ['mid-1']);
});
