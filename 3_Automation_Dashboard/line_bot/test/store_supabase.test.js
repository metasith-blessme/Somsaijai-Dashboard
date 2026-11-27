const test = require('node:test');
const assert = require('node:assert/strict');
const { createSupabaseStore, createStore, MemoryStore } = require('../lib/store');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { STORE_DOWN_TH } = require('../lib/staff_text');

/** A stand-in for the ssj_kv_* functions in supabase/001_ssj_kv.sql. */
function fakeSupabase(secret) {
  const rows = new Map();
  const calls = [];
  async function fetchImpl(url, init) {
    const name = url.split('/rpc/')[1];
    const args = JSON.parse(init.body);
    calls.push(name);
    const out = (status, value) => ({ ok: status < 300, status, text: async () => (value === undefined ? '' : JSON.stringify(value)) });
    if (args.p_secret !== secret) return out(400, { message: 'bad secret' });
    if (name === 'ssj_kv_put') { rows.set(args.p_key, args.p_body); return out(204); }
    if (name === 'ssj_kv_put_if_absent') {
      if (rows.has(args.p_key)) return out(200, false);
      rows.set(args.p_key, args.p_body); return out(200, true);
    }
    if (name === 'ssj_kv_get') return out(200, rows.has(args.p_key) ? rows.get(args.p_key) : null);
    if (name === 'ssj_kv_list') return out(200, [...rows.keys()].filter(k => k.startsWith(args.p_prefix)).sort());
    if (name === 'ssj_kv_delete') { rows.delete(args.p_key); return out(204); }
    return out(404, { message: 'no such function' });
  }
  return { fetchImpl, rows, calls };
}

test('the Supabase store keeps photo bytes and JSON, claims a key once, and lists by prefix', async () => {
  const fake = fakeSupabase('s3');
  const store = createSupabaseStore({ url: 'https://x.supabase.co/', key: 'sb_publishable_x', secret: 's3', fetchImpl: fake.fetchImpl });
  const photo = Buffer.from([0xff, 0xd8, 0x00, 0x10, 0xfe]);
  await store.put('bytes:1', photo, 'image/jpeg');
  assert.deepEqual(await store.get('bytes:1'), photo);
  await store.putJson('batch:1', { a: 'ส้ม' });
  assert.deepEqual(await store.getJson('batch:1'), { a: 'ส้ม' });
  assert.equal(await store.get('nope'), null);
  assert.equal((await store.putIfAbsent('set:1:done', Buffer.from('x'))).created, true);
  assert.equal((await store.putIfAbsent('set:1:done', Buffer.from('y'))).created, false);
  assert.deepEqual(await store.list('b'), ['batch:1', 'bytes:1']);
  await store.delete('batch:1');
  assert.equal(await store.getJson('batch:1'), null);
});

test('a wrong secret or an unreachable Supabase is a store error, not a silent null', async () => {
  const fake = fakeSupabase('right');
  const wrong = createSupabaseStore({ url: 'https://x.supabase.co', key: 'k', secret: 'wrong', fetchImpl: fake.fetchImpl });
  await assert.rejects(wrong.get('a'), err => err.storeError === true && /bad secret/.test(err.message));
  const down = createSupabaseStore({ url: 'https://x.supabase.co', key: 'k', secret: 'right', fetchImpl: async () => { throw new Error('fetch failed'); } });
  await assert.rejects(down.put('a', Buffer.from('1')), err => err.storeError === true && /unreachable/.test(err.message));
});

test('production uses Supabase when its three settings are present, even with the old Blob token', () => {
  const store = createStore({ SSJ_SUPABASE_URL: 'https://x.supabase.co', SSJ_SUPABASE_KEY: 'k', SSJ_STORE_SECRET: 's', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' });
  assert.equal(typeof store.putIfAbsent, 'function');
  assert.throws(() => createStore({}), /SSJ_SUPABASE_URL/);
});

function webhookCtx(store) {
  const replies = [];
  const pushes = [];
  return {
    replies, pushes,
    ctx: {
      config: { channelSecret: 's', groupId: 'C1', ownerUserId: 'U-owner' },
      store, now: 1000,
      line: {
        async reply(token, messages) { replies.push({ token, text: messages[0].text }); },
        async push(to, messages) { pushes.push({ to, text: messages[0].text }); },
        async getContent() { return { buf: Buffer.from('jpg'), contentType: 'image/jpeg' }; },
        async profile() { return { displayName: 'x' }; },
      },
    },
  };
}

async function post(ctx, events) {
  const raw = Buffer.from(JSON.stringify({ events }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx });
}

test('when the store is down, staff get one free Thai reply and no push', async () => {
  const broken = new MemoryStore();
  const fail = async () => { throw Object.assign(new Error('Vercel Blob: This store has been suspended.'), { storeError: true }); };
  broken.putIfAbsent = fail; broken.getJson = fail; broken.putJson = fail; broken.put = fail;
  const { ctx, replies, pushes } = webhookCtx(broken);
  const result = await post(ctx, [{
    type: 'message', webhookEventId: 'E1', timestamp: 1, replyToken: 'r1',
    source: { type: 'group', groupId: 'C1', userId: 'U-staff' },
    message: { type: 'image', id: 'm1', imageSet: { id: 'set', index: 1, total: 1 } },
  }]);
  assert.equal(result.status, 200);
  assert.equal(result.outcomes[0].store_down, true);
  assert.deepEqual(replies, [{ token: 'r1', text: STORE_DOWN_TH }]);
  assert.match(STORE_DOWN_TH, /[\u0E00-\u0E7F]/);
  assert.equal(pushes.length, 0);
});

test('an event is claimed with one write, a redelivery is a duplicate, and ignored types store nothing', async () => {
  const store = new MemoryStore();
  let writes = 0;
  for (const name of ['put', 'putIfAbsent', 'putJson']) {
    const original = store[name].bind(store);
    store[name] = async (...args) => {
      const result = await original(...args);
      // A putIfAbsent that finds the key already there writes nothing.
      if (String(args[0]).startsWith('event:') && !(result && result.created === false)) writes += 1;
      return result;
    };
  }
  const { ctx } = webhookCtx(store);
  const left = { type: 'memberLeft', webhookEventId: 'E-left', timestamp: 1, source: { type: 'group', groupId: 'C9' }, left: { members: [] } };
  const out = await post(ctx, [left]);
  assert.deepEqual(out.outcomes[0], { ignored: 'memberLeft' });
  assert.equal(writes, 0);
  assert.deepEqual(await store.list('event:'), []);

  const id = { type: 'message', webhookEventId: 'E-id', timestamp: 2, replyToken: 'r', source: { type: 'group', groupId: 'C1', userId: 'U-staff' }, message: { type: 'text', text: 'id' } };
  const first = await post(ctx, [id]);
  assert.equal(first.outcomes[0].error, undefined, JSON.stringify(first.outcomes[0]));
  assert.equal(writes, 1);
  const again = await post(ctx, [{ ...id, deliveryContext: { isRedelivery: true } }]);
  assert.equal(again.outcomes[0].duplicate, true);
  assert.equal(writes, 1);
});
