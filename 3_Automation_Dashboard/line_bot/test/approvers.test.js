const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { loadConfig, approversOf } = require('../lib/config');
const { isOwnerDirect } = require('../lib/qa');
const stock = require('../lib/stock');

const n = v => ({ raw: String(v), value: v, state: 'observed' });
const NAMES = { 'U-parn': 'Parn', 'U-ming': 'Ming', 'U-new': 'Manager Candidate' };

function sale() {
  return {
    document_type: 'sales_report',
    header: { date_raw: '01.11.2026', branch_raw: 'B2', staff_raw: ['staff'] },
    sales: { cash_sales: n(100), scan_sales: n(20), total_sales: n(120) },
    menu_rows: [{ item_raw: 'ส้ม', qty_raw: '3', qty_value: 3, qty_state: 'observed', uncertain: false }],
  };
}

function harness() {
  const replies = [];
  const pushes = [];
  const profiles = [];
  const calls = [];
  const c = {
    replies, pushes, profiles, calls,
    config: {
      channelSecret: 's', ownerUserId: 'U-parn', approverUserIds: ['U-ming'], orderSenderUserIds: ['U-ming'],
      groupId: 'C-b2:B2', publicUrl: 'https://x.test', allowDeploy: true, githubToken: 't', githubRepo: 'o/r',
      suppliersPath: path.join(__dirname, '..', 'orders', 'suppliers.json'),
    },
    store: new MemoryStore(),
    now: Date.parse('2026-11-02T09:00:00Z'),
    extractImage: async () => ({ extraction: sale(), second: null, secondSkipped: true }),
    deps: {
      async prepareWorkdir() { calls.push('prepare'); return '/tmp/unused'; },
      async importSales() { calls.push('sales'); },
      async importExpenses() {},
      async regenerate() {},
      async commit() { calls.push('commit'); return { sha: 'abc' }; },
      async deploy() { return { triggered: false }; },
      async readback() { return { ok: true }; },
      async commitStock() { calls.push('stock'); return { sha: 'def' }; },
    },
    line: {
      async getContent() { return { buf: Buffer.from('photo'), contentType: 'image/jpeg' }; },
      async reply(token, messages) { replies.push(messages); },
      async push(to, messages) { pushes.push({ to, messages }); },
      async profile(userId) { profiles.push(userId); return { displayName: NAMES[userId] || 'Staff' }; },
    },
  };
  return c;
}

let seq = 0;
async function post(c, event) {
  seq += 1;
  const raw = Buffer.from(JSON.stringify({ events: [{ webhookEventId: `a${seq}`, timestamp: 1, replyToken: `r${seq}`, ...event }] }));
  return (await handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx: c })).outcomes[0];
}
const user = id => ({ type: 'user', userId: id });
const text = (id, body) => ({ type: 'message', source: user(id), message: { type: 'text', id: `m${seq + 1}`, text: body } });
const tap = (id, data) => ({ type: 'postback', source: user(id), postback: { data } });
const photo = id => ({ type: 'message', source: user(id), message: { type: 'image', id: `p${seq + 1}` } });

test('LINE_APPROVER_USER_IDS adds approvers after Parn, without repeats', () => {
  const config = loadConfig({ LINE_OWNER_USER_ID: 'U-parn', LINE_APPROVER_USER_IDS: ' U-ming , U-parn,' });
  assert.deepEqual(approversOf(config), ['U-parn', 'U-ming']);
  assert.deepEqual(approversOf(loadConfig({ LINE_OWNER_USER_ID: 'U-parn' })), ['U-parn']);
});

test('a sales card is pushed once to each approver, and the first tap wins', async () => {
  const c = harness();
  await post(c, photo('U-staff'));
  assert.deepEqual(c.pushes.map(p => p.to), ['U-parn', 'U-ming']);
  const data = c.pushes[0].messages[1].template.actions[0].data;
  const first = await post(c, tap('U-ming', data));
  assert.equal(first.status, 'published');
  const batchId = new URLSearchParams(data).get('batch');
  const record = await c.store.getJson(`batch:${batchId}`);
  assert.equal(record.approval.approver_user_id, 'U-ming');
  assert.equal(record.approval.approver_name, 'Ming');
  const second = await post(c, tap('U-parn', data));
  assert.equal(second.status, 'already');
  assert.match(c.replies.at(-1)[0].text, /^Already approved by Ming/);
  assert.equal(c.calls.filter(x => x === 'commit').length, 1);
  assert.equal(c.pushes.length, 2);
});

test('a rejection blocks a later approve from the other approver', async () => {
  const c = harness();
  await post(c, photo('U-staff'));
  const [approve, reject] = c.pushes[0].messages[1].template.actions.map(a => a.data);
  await post(c, tap('U-parn', reject));
  await post(c, tap('U-ming', approve));
  assert.match(c.replies.at(-1)[0].text, /^Already rejected by Parn/);
  assert.equal(c.calls.length, 0);
});

test('staff cannot approve', async () => {
  const c = harness();
  await post(c, photo('U-staff'));
  await post(c, tap('U-staff', c.pushes[0].messages[1].template.actions[0].data));
  assert.equal(c.replies.at(-1)[0].text, 'Only Parn can approve this.');
  assert.equal(c.calls.length, 0);
});

test('the stock digest goes to each approver; the second tap shows who handled it', async () => {
  const c = harness();
  await post(c, text('U-staff', 'stock B1 01/11/2026\norange 27'));
  const out = await stock.runDailyDigest({ store: c.store, line: c.line, approverUserIds: approversOf(c.config), now: c.now });
  assert.deepEqual(out.pushed_to, ['U-parn', 'U-ming']);
  const data = c.pushes[0].messages[1].template.actions[0].data;
  await post(c, tap('U-parn', data));
  await post(c, tap('U-ming', data));
  assert.match(c.replies.at(-1)[0].text, /^Already approved by Parn/);
  assert.equal(c.calls.filter(x => x === 'stock').length, 1);
});

test('the manager gets Parn\'s owner replies: Thai ack, สต็อก, sales Q&A context', async () => {
  const c = harness();
  await post(c, photo('U-ming'));
  assert.match(c.replies[0][0].text, /ได้รับรูปแล้ว/);
  await post(c, text('U-staff', 'stock B1 01/11/2026\norange 27'));
  await post(c, text('U-ming', 'สต็อก'));
  assert.match(c.replies.at(-1)[0].text, /สต็อกรอตรวจ 1 ใบ/);
  assert.equal(isOwnerDirect(user('U-ming'), c.config), true);
  assert.equal(isOwnerDirect(user('U-staff'), c.config), false);
});

test('Ming\'s order still pushes Parn once, and she gets the drafts free', async () => {
  const c = harness();
  const out = await post(c, text('U-ming', 'Orders for tomorrow, please @Parn\nWatermelon -40\nGuava-50Kg'));
  assert.equal(out.pushed, true);
  assert.deepEqual(c.pushes.map(p => p.to), ['U-parn']);
  const replied = c.replies.at(-1);
  assert.match(replied[0].text, /Order received/);
  assert.ok(replied.slice(1).some(m => m.text === 'วันนี้ 40 ลูกครับผม'));
});

test('a new 1:1 sender is logged once with the LINE name; approvers are not', async () => {
  const c = harness();
  await post(c, text('U-new', 'hi'));
  await post(c, text('U-new', 'hello again'));
  await post(c, text('U-parn', 'id'));
  const entry = await c.store.getJson('sender:U-new');
  assert.equal(entry.display_name, 'Manager Candidate');
  assert.equal(entry.first_text, 'hi');
  assert.equal(await c.store.getJson('sender:U-parn'), null);
  assert.deepEqual(c.profiles, ['U-new']);
  await post(c, text('U-parn', 'ผู้ส่ง'));
  assert.match(c.replies.at(-1)[0].text, /Manager Candidate\nU-new/);
  const before = c.replies.length;
  const out = await post(c, text('U-new', 'ผู้ส่ง'));
  assert.notEqual(out.senders, true);
  assert.ok(c.replies.slice(before).every(m => !/U-new\n/.test(m[0].text)));
});
