const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { emptySet, addPart, isComplete, orderedParts, summarizeParts, partKey, doneKey } = require('../lib/image_set');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore, FileStore, createBlobStoreFromClient } = require('../lib/store');

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

test('ten imageSet parts delivered together are read once', async () => {
  const c = ctx();
  const secret = c.config.channelSecret;
  const events = [];
  for (let index = 1; index <= 10; index++) {
    events.push(imageEvent('m' + index, index, 10, 'SET10', 'wh-' + index));
  }
  const results = await Promise.all(events.map(event => {
    const raw = Buffer.from(JSON.stringify({ events: [event] }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, secret), ctx: c });
  }));
  assert.equal(results.every(result => result.status === 200), true);
  assert.equal(c.extracts.length, 10);
  assert.equal(new Set(c.extracts).size, 10);
  assert.equal(c.downloads.length, 10);
  assert.equal(c.pushes.length, 1);
  assert.equal(c.pushes[0].to, 'U-owner');
  assert.match(c.pushes[0].messages[0].text, /ยังไม่เข้าระบบ/);
  const parts = await c.store.list('set:SET10:part:');
  assert.equal(parts.length, 10);
  assert.equal(parts.includes(doneKey('SET10')), false);
  assert.equal(parts.includes(partKey('SET10', 1)), true);
  const done = await c.store.getJson(doneKey('SET10'));
  assert.equal(done.reason, 'complete');
});

test('an incomplete imageSet is still summarized once the wait expires', async () => {
  const c = ctx();
  const tails = [];
  const waits = [];
  const replies = [];
  c.scheduleBackground = (job) => { tails.push(job); };
  c.imageSetTimeoutMs = 5;
  c.sleep = () => new Promise(resolve => { waits.push(resolve); });
  c.line.reply = async (_token, messages) => { replies.push(messages[0].text); };
  const secret = c.config.channelSecret;
  async function post(event) {
    const raw = Buffer.from(JSON.stringify({ events: [event] }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, secret), ctx: c });
  }
  await post(imageEvent('a1', 1, 3, 'SETWAIT', 'wh-a'));
  await post(imageEvent('a3', 3, 3, 'SETWAIT', 'wh-c'));
  assert.equal(c.extracts.length, 0);
  assert.equal(tails.length, 2);
  assert.match(replies[0], /ภายใน 2 นาที/);
  waits.forEach(release => release());
  await Promise.all(tails);
  assert.equal(c.extracts.length, 2);
  assert.equal(c.pushes.length, 1);
  assert.match(c.pushes[0].messages[0].text, /ขาดลำดับ 2/);
  const late = await post(imageEvent('a2', 2, 3, 'SETWAIT', 'wh-b'));
  assert.equal(late.outcomes[0].late, true);
  assert.equal(c.extracts.length, 2);
  assert.equal(c.pushes.length, 1);
  assert.match(replies.join('\n'), /หลังสรุป/);
});

test('two messages for one index are not read', async () => {
  const c = ctx();
  const replies = [];
  c.line.reply = async (_token, messages) => { replies.push(messages[0].text); };
  const secret = c.config.channelSecret;
  async function post(event) {
    const raw = Buffer.from(JSON.stringify({ events: [event] }));
    return handleWebhook({ rawBody: raw, signature: signBody(raw, secret), ctx: c });
  }
  await post(imageEvent('c1', 1, 2, 'SETC', 'wh-c1'));
  const clash = await post(imageEvent('c1b', 1, 2, 'SETC', 'wh-c1b'));
  assert.equal(clash.outcomes[0].conflict, true);
  assert.equal(c.extracts.length, 0);
  assert.match(replies.join('\n'), /ซ้ำซ้อน/);
});

test('summarizeParts names the holes in a set', () => {
  const summary = summarizeParts([
    { messageId: 'm2', index: 2, total: 6 },
    { messageId: 'm4', index: 4, total: 6 },
    { messageId: 'm1', index: 1, total: 6 },
    { messageId: 'm6', index: 6, total: 6 },
  ]);
  assert.deepEqual(summary.missing, [3, 5]);
  assert.equal(summary.complete, false);
  assert.deepEqual(summary.ordered.map(part => part.index), [1, 2, 4, 6]);
});

test('only one putIfAbsent creates a key, and list follows a blob cursor', async () => {
  const memory = new MemoryStore();
  const winners = await Promise.all([1, 2, 3, 4].map(n => memory.putIfAbsent('set:1:done', Buffer.from(String(n)))));
  assert.equal(winners.filter(result => result.created).length, 1);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-set-'));
  const files = new FileStore(dir);
  assert.equal((await files.putIfAbsent('set:9:part:1', Buffer.from('a'))).created, true);
  assert.equal((await files.putIfAbsent('set:9:part:1', Buffer.from('b'))).created, false);
  assert.deepEqual(await files.list('set:9:part:'), ['set:9:part:1']);

  const objects = new Map();
  let storedThenFailed = false;
  const client = {
    async put(key, body, options) {
      assert.equal(options.addRandomSuffix, false);
      if (options.allowOverwrite === false && objects.has(key)) {
        throw new Error('Vercel Blob: Unknown error, please visit https://vercel.com/help.');
      }
      objects.set(key, Buffer.from(body));
      if (key === 'set:7:done' && !storedThenFailed) {
        storedThenFailed = true;
        throw new Error('Vercel Blob: Unknown error, please visit https://vercel.com/help.');
      }
    },
    async get(key) {
      const hit = objects.get(key);
      return hit ? { stream: [hit] } : null;
    },
    async list({ prefix, cursor }) {
      const keys = [...objects.keys()].filter(key => key.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const slice = keys.slice(start, start + 1);
      return {
        blobs: slice.map(pathname => ({ pathname })),
        hasMore: start + 1 < keys.length,
        cursor: String(start + 1),
      };
    },
  };
  const blobs = createBlobStoreFromClient(client);
  const claimed = await blobs.putIfAbsent('set:7:done', Buffer.from('mine'), 'application/json');
  assert.equal(claimed.created, true);
  await blobs.putIfAbsent('set:7:part:1', Buffer.from('p1'));
  await blobs.putIfAbsent('set:7:part:2', Buffer.from('p2'));
  const second = await blobs.putIfAbsent('set:7:done', Buffer.from('other'));
  assert.equal(second.created, false);
  assert.equal((await blobs.get('set:7:done')).toString(), 'mine');
  const listed = await blobs.list('set:7:part:');
  assert.deepEqual(listed.sort(), ['set:7:part:1', 'set:7:part:2']);
  const exists = await blobs.putIfAbsent('set:7:part:1', Buffer.from('nope'));
  assert.equal(exists.created, false);
  client.put = async () => { throw new Error('This blob already exists'); };
  assert.equal((await blobs.putIfAbsent('set:7:part:9', Buffer.from('x'))).created, false);
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
