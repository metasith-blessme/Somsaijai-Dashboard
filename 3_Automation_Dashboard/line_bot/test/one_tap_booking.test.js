// 7 Nov 2026: Parn wants Approve to always book. Sheets were held after Approve on
// item-sum or Net cash + Scan mismatches, the same B4 photos made two cards, and
// month-end costs had no way in. These tests pin the new flow.
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

const n = v => ({ raw: String(v), value: v, state: 'observed' });

// Net cash + Scan is 100 short of the Total and the items are 50 short: both checks fail.
function mismatched(total = 3276) {
  return {
    document_type: 'sales_report',
    form_template: 'daily_shop_report',
    header: { date_raw: '05.11.2026', branch_raw: 'B4' },
    sales: { cash_sales: n(1798), scan_sales: n(total - 1898), total_sales: n(total) },
    menu_rows: [{ item_raw: 'Orange Cup', qty_raw: '10', qty_value: 10, qty_state: 'observed', amount_raw: String(total - 50), amount_value: total - 50, uncertain: false }],
  };
}

function harness({ reading = () => mismatched() } = {}) {
  const c = {
    replies: [], pushes: [], imported: [], expenses: [],
    config: {
      channelSecret: 's', ownerUserId: 'U-parn', approverUserIds: ['U-ming'],
      groupId: 'C-b4:B4', publicUrl: 'https://x.test', allowDeploy: true, githubToken: 't', githubRepo: 'o/r',
    },
    store: new MemoryStore(),
    now: Date.parse('2026-11-05T15:00:00Z'),
    photoBytes: id => Buffer.from(`photo ${id}`),
    deps: {
      async prepareWorkdir() { return '/tmp/unused'; },
      async importSales(dir, list) { c.imported.push(...list.rows); },
      async importExpenses(dir, list) { c.expenses.push(...list.rows); },
      async regenerate() {},
      async commit() { return { sha: 'abc' }; },
      async deploy() { return { triggered: false }; },
      async readback() { return { ok: true }; },
    },
  };
  c.extractImage = async () => ({ extraction: reading(), second: null, secondSkipped: true });
  c.line = {
    async getContent(id) { return { buf: c.photoBytes(id), contentType: 'image/jpeg' }; },
    async reply(token, messages) { c.replies.push(messages); },
    async push(to, messages) { c.pushes.push({ to, messages }); },
    async profile() { return { displayName: 'Ming' }; },
  };
  return c;
}

let seq = 0;
async function post(c, event) {
  seq += 1;
  const raw = Buffer.from(JSON.stringify({ events: [{ webhookEventId: `o${seq}`, timestamp: 1, replyToken: `r${seq}`, ...event }] }));
  return (await handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx: c })).outcomes[0];
}
const staffPhoto = id => ({ type: 'message', source: { type: 'group', groupId: 'C-b4', userId: 'U-staff' }, message: { type: 'image', id } });
const tap = (id, data) => ({ type: 'postback', source: { type: 'user', userId: id }, postback: { data } });
const say = (id, text) => ({ type: 'message', source: { type: 'user', userId: id }, message: { type: 'text', id: `t${seq + 1}`, text } });
const cards = c => c.pushes.filter(p => p.to === 'U-ming');
const approveData = card => card.messages[1].template.actions[0].data;
const lastReply = c => c.replies.at(-1)[0].text;

test('a sheet whose items and Net cash + Scan do not match books the written Total on the first Approve', async () => {
  const c = harness();
  await post(c, staffPhoto('p1'));
  const [card] = cards(c);
  assert.match(card.messages[0].text, /⚠ Items add to ฿3,226, ฿50 less than the Total/);
  assert.match(card.messages[1].template.text, /^Check the ⚠ lines\. Approve books the written Total B4 5 Nov ฿3,276\./);
  assert.equal((await post(c, tap('U-ming', approveData(card)))).status, 'published');
  assert.equal(c.imported.length, 1);
  assert.equal(c.imported[0].revenue, 3276);
  assert.equal(c.imported[0].replace, true);
  assert.match(lastReply(c), /^Booked to dashboard: B4 5 Nov ฿3,276\n/);
});

test('the same photos sent twice make one card, not two', async () => {
  const c = harness();
  c.photoBytes = () => Buffer.from('the same B4 sheet');
  await post(c, staffPhoto('p1'));
  assert.equal((await post(c, staffPhoto('p2'))).status, 'duplicate');
  assert.equal(cards(c).length, 1);
  assert.equal(c.pushes.length, 2, 'one card each for Parn and Ming, no extra push');
});

test('a re-sent sheet for the same day gets a new card, and the older card no longer books', async () => {
  let total = 3276;
  const c = harness({ reading: () => mismatched(total) });
  await post(c, staffPhoto('p1'));
  total = 3300;
  await post(c, staffPhoto('p2'));
  const [older, newer] = cards(c);
  assert.ok(newer, 'the corrected sheet is a new card');
  assert.equal((await post(c, tap('U-ming', approveData(older)))).status, 'superseded');
  assert.equal(c.imported.length, 0);
  assert.match(lastReply(c), /newer photo of B4 5 Nov/);
  await post(c, tap('U-ming', approveData(newer)));
  assert.deepEqual(c.imported.map(r => r.revenue), [3300]);
});

test('a card held on an earlier Approve can be approved again', async () => {
  const c = harness({ reading: () => ({ ...mismatched(), header: { date_raw: '', branch_raw: 'B4' } }) });
  await post(c, staffPhoto('p1'));
  const data = approveData(cards(c)[0]);
  assert.equal((await post(c, tap('U-ming', data))).status, 'held');
  assert.match(lastReply(c), /^Not booked: no date\. Tap Reject and ask staff/);
  assert.equal((await post(c, tap('U-ming', data))).status, 'held', 'not "already approved"');
});

test('only Parn can add a month-end cost, and it goes in as one expense row', async () => {
  const c = harness();
  await post(c, say('U-ming', 'cost B1 Nov 12000 rent'));
  assert.equal(c.expenses.length, 0);
  await post(c, say('U-parn', 'cost B4 Nov 12,000 rent'));
  assert.deepEqual(c.expenses, [{
    idx: 'cost-B4-Nov26-rent-12000', branch: 'B4', date: '30/11/2026', month: 'Nov26',
    bucket: 'OPEX', cat: 'Rental', desc: 'Monthly cost from Parn: rent', amt: 12000,
  }]);
  assert.equal(lastReply(c), 'Cost added: B4 Nov Rental ฿12,000. Profit on the dashboard now takes it off.');
  await post(c, say('U-parn', 'cost B4 rent'));
  assert.match(lastReply(c), /^Type: cost B1 Nov 12000 rent/);
  assert.equal(c.expenses.length, 1);
});
