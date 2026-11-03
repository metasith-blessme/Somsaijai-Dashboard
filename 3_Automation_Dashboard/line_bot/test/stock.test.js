const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const stock = require('../lib/stock');
const { authorized } = require('../../api/stock-digest');

const NOW = Date.parse('2026-10-31T15:00:00Z');

function ctx(over = {}) {
  const replies = [];
  const pushes = [];
  const commits = [];
  return {
    replies,
    pushes,
    commits,
    config: { channelSecret: 's', ownerUserId: 'U-parn', groupId: 'C-b1:B1', publicUrl: 'https://x.test', allowDeploy: true, githubToken: 't', githubRepo: 'o/r', ...over },
    store: new MemoryStore(),
    now: NOW,
    deps: { async commitStock(rows, id) { commits.push({ rows, id }); return { sha: `sha${commits.length}` }; } },
    line: {
      async getContent() { return { buf: Buffer.from('photo'), contentType: 'image/jpeg' }; },
      async reply(token, messages) { replies.push(messages); },
      async push(to, messages) { pushes.push({ to, messages }); },
    },
    extractImage: async () => ({ extraction: stockPhoto(), second: null, secondSkipped: true }),
  };
}

function stockPhoto() {
  const n = v => ({ raw: String(v), value: v, state: 'observed' });
  return {
    document_type: 'stock_report',
    image_quality: 'ok',
    header: { date_raw: '31.10.2026', branch_raw: 'B2' },
    sales: {},
    stock_rows: [
      { item_raw: 'Orange', qty: n(27), unit_raw: 'basket', delivered: n(20) },
      { item_raw: 'Lid', qty: n(125), unit_raw: 'row', delivered: { raw: null, value: null, state: 'missing' } },
    ],
  };
}

let seq = 0;
async function post(c, event) {
  seq += 1;
  const raw = Buffer.from(JSON.stringify({ events: [{ webhookEventId: `e${seq}`, timestamp: 1, replyToken: `r${seq}`, ...event }] }));
  return (await handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx: c })).outcomes[0];
}

const text = (userId, body, source) => ({
  type: 'message', source: source || { type: 'user', userId }, message: { type: 'text', id: `t${seq + 1}`, text: body },
});
const tap = data => ({ type: 'postback', source: { type: 'user', userId: 'U-parn' }, postback: { data } });

test('a staff stock text gets the free English reply, no push, and keeps the raw text', async () => {
  const c = ctx();
  const body = 'stock B1 31/10/2026\norange 27 basket +20\ncoconut 15 pcs';
  const out = await post(c, text('U-staff', body, { type: 'group', groupId: 'C-b1', userId: 'U-staff' }));
  assert.equal(c.replies[0][0].text, 'Got the stock list. Thank you.');
  assert.equal(c.pushes.length, 0);
  const [list] = await stock.loadLists(c.store);
  assert.equal(list.id, out.stock);
  assert.equal(list.raw_text, body);
  assert.equal(list.branch.value, 'B1');
  assert.equal(list.date.value, '31/10/2026');
  assert.deepEqual(list.rows.map(r => [r.item_raw, r.qty, r.unit, r.delivered]), [['orange', 27, 'basket', 20], ['coconut', 15, 'pcs', null]]);
});

test('a stock photo sends no review card; it waits for the digest', async () => {
  const c = ctx();
  await post(c, { type: 'message', source: { type: 'user', userId: 'U-staff' }, message: { type: 'image', id: 'p1' } });
  assert.equal(c.pushes.length, 0);
  assert.doesNotMatch(c.replies[0][0].text, /[ก-๙]/);
  const [list] = await stock.loadLists(c.store);
  assert.equal(list.kind, 'photo');
  assert.equal(list.branch.value, 'B2');
  assert.deepEqual(list.rows.map(r => [r.item_raw, r.qty, r.delivered]), [['Orange', 27, 20], ['Lid', 125, null]]);
});

test('the daily digest pushes Parn once a day and only when something is new', async () => {
  const c = ctx();
  const run = now => stock.runDailyDigest({ store: c.store, line: c.line, approverUserIds: ['U-parn'], now });
  assert.equal((await run(NOW)).skipped, 'nothing_new');
  await post(c, text('U-staff', 'stock B1 31/10/2026\norange 27'));
  assert.equal((await run(NOW)).pushed, true);
  assert.equal(c.pushes.length, 1);
  assert.equal(c.pushes[0].to, 'U-parn');
  assert.match(c.pushes[0].messages[0].text, /^B1 · 31 Oct 2026 · 1 item \(text\)$/m);
  assert.match(c.pushes[0].messages[0].text, /^orange 27$/m);
  assert.match(c.pushes[0].messages[1].template.actions[0].data, /^action=stock_approve&batch=stock-2026-10-31$/);
  await post(c, text('U-staff', 'stock B2 31/10/2026\nmango 1 box'));
  assert.equal((await run(NOW + 60000)).skipped, 'already_sent_today');
  assert.equal((await run(NOW + 86400000)).pushed, true);
  assert.equal((await run(NOW + 2 * 86400000)).skipped, 'nothing_new');
  assert.equal(c.pushes.length, 2);
});

test('Parn types สต็อก, taps อนุมัติ, and the rows are committed once', async () => {
  const c = ctx();
  await post(c, text('U-staff', 'stock B1 31/10/2026\norange 27 basket +20'));
  await post(c, text('U-staff', 'stock\norange 5'));
  await post(c, text('U-parn', 'สต็อก'));
  assert.equal(c.pushes.length, 0);
  const view = c.replies.at(-1);
  assert.match(view[0].text, /^Stock · 2 lists to check/);
  assert.match(view[0].text, /✗ Not added: no branch/);
  assert.equal(view[1].template.text, 'Approve adds 1 list to the dashboard. Reject drops all 2.');
  assert.deepEqual(view[1].template.actions.map(a => a.label), ['Approve', 'Reject']);
  const data = view[1].template.actions[0].data;
  await post(c, tap(data));
  assert.equal(c.commits.length, 1);
  assert.deepEqual(c.commits[0].rows, [{ branch: 'B1', date: '2026-10-31', item: 'orange', qty: 27, unit: 'basket', delivered: 20, source: c.commits[0].rows[0].source }]);
  assert.match(c.replies.at(-1)[0].text, /^Added 1 stock list \(1 items\)/);
  assert.match(c.replies.at(-1)[0].text, /1 list still waiting/);
  await post(c, tap(data));
  assert.equal(c.commits.length, 1);
  const open = await stock.loadLists(c.store);
  assert.deepEqual(open.map(l => l.branch.value), [null]);
});

test('ไม่รับ drops every list the digest showed', async () => {
  const c = ctx();
  await post(c, text('U-staff', 'stock B1 31/10/2026\norange 27'));
  await post(c, text('U-parn', 'สต็อก'));
  await post(c, tap(c.replies.at(-1)[1].template.actions[1].data));
  assert.equal((await stock.loadLists(c.store)).length, 0);
  assert.equal(c.commits.length, 0);
});

test('only Parn can approve stock, and approval without deploy rights writes nothing', async () => {
  const c = ctx({ allowDeploy: false });
  await post(c, text('U-staff', 'stock B1 31/10/2026\norange 27'));
  await post(c, text('U-parn', 'สต็อก'));
  const data = c.replies.at(-1)[1].template.actions[0].data;
  await post(c, { type: 'postback', source: { type: 'user', userId: 'U-staff' }, postback: { data } });
  assert.equal(c.replies.at(-1)[0].text, 'Only Parn can approve this.');
  await post(c, tap(data));
  assert.match(c.replies.at(-1)[0].text, /LINE_BOT_ALLOW_DEPLOY/);
  assert.equal(c.commits.length, 0);
  assert.equal((await stock.loadLists(c.store))[0].status, 'approved');
});

test('staff sending only "stock" get the format; it is not a stock list', async () => {
  const c = ctx();
  await post(c, text('U-staff', 'stock'));
  assert.match(c.replies[0][0].text, /^Send stock like this/);
  assert.equal((await stock.loadLists(c.store)).length, 0);
});

test('merging the same approved rows twice gives the same ledger', () => {
  const rows = [{ branch: 'B1', date: '2026-10-31', item: 'Orange', qty: 27, unit: 'basket', delivered: 20, source: 's' }];
  const base = { purchases: [{ date: '2026-04-12', item: 'orange', qty: 100 }] };
  const once = stock.mergeLedger(base, rows);
  assert.deepEqual(stock.mergeLedger(once, rows), once);
  assert.deepEqual(once.purchases, base.purchases);
  const fixed = stock.mergeLedger(once, [{ ...rows[0], qty: 26 }]);
  assert.equal(fixed.stock_counts.length, 1);
  assert.equal(fixed.stock_counts[0].qty, 26);
});

test('dashboard usage is previous + delivered - today, blank when delivered is unknown', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const src = html.match(/function stockUsageRows[\s\S]*?\n}\n/)[0];
  const box = {};
  vm.runInNewContext(`${src}; out = stockUsageRows`, box);
  const rows = box.out([
    { branch: 'B1', date: '2026-10-30', item: 'orange', unit: 'basket', qty: 30, delivered: null },
    { branch: 'B1', date: '2026-10-31', item: 'Orange', unit: 'basket', qty: 27, delivered: 20 },
    { branch: 'B1', date: '2026-11-01', item: 'orange', unit: 'basket', qty: 20, delivered: null },
    { branch: 'B2', date: '2026-10-31', item: 'orange', unit: 'basket', qty: 9, delivered: 5 },
  ]);
  assert.deepEqual(rows.map(r => r.usage), [null, 23, null, null]);
});

test('the cron route takes Vercel cron, or the CRON_SECRET bearer when one is set', () => {
  assert.equal(authorized({ headers: { 'user-agent': 'vercel-cron/1.0' } }, {}), true);
  assert.equal(authorized({ headers: {} }, {}), false);
  assert.equal(authorized({ headers: { 'user-agent': 'vercel-cron/1.0' } }, { CRON_SECRET: 'k' }), false);
  assert.equal(authorized({ headers: { authorization: 'Bearer k' } }, { CRON_SECRET: 'k' }), true);
});

test('a stock line with no counted rows is not saved', async () => {
  const c = ctx();
  await post(c, text('U-staff', 'stock is low today'));
  assert.match(c.replies[0][0].text, /^Send stock like this/);
  assert.equal((await stock.loadLists(c.store)).length, 0);
});

test('Parn types สต็อก with nothing open and is told so', async () => {
  const c = ctx();
  await post(c, text('U-parn', 'สต็อก'));
  assert.equal(c.replies[0][0].text, 'No stock lists waiting.');
});
