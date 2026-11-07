// 31 Oct 2026: Parn's photo waited about 2.5 minutes with no answer and a question
// got "Could not answer" (MiniMax-M2 was retired). These tests pin the fixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { askMinimax } = require('../lib/qa');
const { extractImage } = require('../lib/extractor');

const money = v => ({ raw: String(v), value: v, state: 'observed' });

function mismatchExtraction() {
  return {
    document_type: 'sales_report',
    form_template: 'daily_shop_report',
    image_quality: 'ok',
    header: { date_raw: '30.10.2026', branch_raw: 'B-1', shift_raw: 'B-1' },
    sales: { cash_sales: money(100), scan_sales: money(30), total_sales: money(120) },
    menu_rows: [{ item_raw: 'Orange Cup', amount_raw: '120', amount_value: 120, qty_state: 'missing', uncertain: false }],
    uncertainties: [],
  };
}

function ctx() {
  const replies = [];
  const pushes = [];
  return {
    replies,
    pushes,
    config: { channelSecret: 's', ownerUserId: 'U-parn', groupId: 'C-staff', publicUrl: 'https://x.test' },
    store: new MemoryStore(),
    now: Date.parse('2026-10-31T15:37:00Z'),
    line: {
      async getContent() { return { buf: Buffer.from('photo'), contentType: 'image/jpeg' }; },
      async reply(token, messages) {
        if (token === 'used') throw new Error('Invalid reply token');
        replies.push(messages);
      },
      async push(to, messages) { pushes.push({ to, messages }); },
    },
    extractImage: async () => ({ extraction: mismatchExtraction(), second: null, secondSkipped: true }),
  };
}

async function post(c, event) {
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, 's'), ctx: c });
}

const parnPhoto = {
  webhookEventId: 'e-photo', type: 'message', timestamp: 1, replyToken: 'r1',
  source: { type: 'user', userId: 'U-parn' }, message: { type: 'image', id: 'm1' },
};

test('Parn\'s photo is answered at once in English and the card is pushed', async () => {
  const c = ctx();
  await post(c, parnPhoto);
  assert.equal(c.replies.length, 1);
  assert.equal(c.replies[0][0].text, 'Got the photo. Reading it now. Summary in 1–3 min.');
  assert.equal(c.pushes.length, 1);
  assert.equal(c.pushes[0].to, 'U-parn');
  assert.equal(c.pushes[0].messages[1].type, 'template');
});

test('an OCR failure in Parn\'s chat is pushed after the ack, never silent', async () => {
  const c = ctx();
  c.extractImage = async () => { throw new Error('Gemini call timed out after 90 s'); };
  await post(c, parnPhoto);
  assert.match(c.replies[0][0].text, /^Got the photo/);
  assert.equal(c.pushes.length, 1);
  assert.match(c.pushes[0].messages[0].text, /Could not read this photo/);
});

test('a retired MiniMax model falls through to the next model', async () => {
  const models = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    models.push(body.model);
    const payload = body.model === 'MiniMax-M2'
      ? { choices: null, base_resp: { status_code: 2069, status_msg: 'The model "MiniMax-M2" is no longer available.' } }
      : { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], base_resp: { status_code: 0 } };
    return { ok: true, json: async () => payload };
  };
  const out = await askMinimax({ apiKey: 'k', model: 'MiniMax-M2', messages: [{ role: 'user', content: 'hi' }], fetchImpl });
  assert.equal(out, 'ok');
  assert.deepEqual(models, ['MiniMax-M2', 'MiniMax-M3']);
});

test('a hanging Gemini read stops inside its budget', async () => {
  let t = 0;
  const clock = () => t;
  const generate = async ({ timeoutMs }) => { t += timeoutMs; const e = new Error('timed out'); e.timeout = true; throw e; };
  await assert.rejects(
    extractImage({ buf: Buffer.from('x'), apiKey: 'k', model: 'a', fallbackModel: 'b', generate, sleep: async ms => { t += ms; }, random: () => 0, clock, budgetMs: 200000 }),
    /timed out/,
  );
  assert.ok(t <= 200000, `spent ${t} ms`);
});
