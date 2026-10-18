const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { loadConfig } = require('../lib/config');
const {
  MINIMAX_URL,
  DEFAULT_MODEL,
  QA_ERROR,
  QA_LIMIT,
  QA_EMPTY,
  QA_MAX_TOKENS,
  QA_RETRY_TOKENS,
  STAFF_RULES,
  OWNER_RULES,
  askMinimax,
  stripThinking,
  extractAnswer,
  compactSales,
  buildChatMessages,
  groupQuestion,
} = require('../lib/qa');

const NOW = Date.parse('2026-10-17T10:00:00+07:00');
const SUPPLIERS = path.join(__dirname, '..', 'orders', 'suppliers.json');
const ORDER = [
  'Orders for tomorrow, please @Parn',
  'Watermelon -40',
  'Apple-3',
].join('\n');

const SALES = {
  branches: {
    B1: {
      sales: {
        Oct26: [
          { d: '03/10/2026', rev: 111, cash: 11, scan: 1 },
          { d: '04/10/2026', rev: 5789, cash: 4000, scan: 1789 },
          { d: '17/10/2026', rev: 2200, cash: 1200, scan: 1000 },
          { d: '18/10/2026', rev: 99999, cash: 1, scan: 1 },
        ],
      },
    },
    B2: { sales: { Oct26: [{ d: '16/10/2026', rev: 800, cash: 500, scan: 300 }] } },
    B3: { sales: {} },
    B4: { sales: { Oct26: [{ d: '16/10/2026', rev: 4242, cash: 1, scan: 1 }] } },
  },
  expenses: [{ desc: 'SUPPLIER-SECRET-PRICE', amt: 7777, branch: 'B1' }],
};

test('thinking tags and a bare MiniMax end tag are removed', () => {
  assert.equal(stripThinking('<think>secret plan</think>\nSend photos one by one.'), 'Send photos one by one.');
  assert.equal(stripThinking('pondering the shop</think>\nShort answer.'), 'Short answer.');
  assert.equal(stripThinking('<thinking>hide this</thinking>Keep this.'), 'Keep this.');
  assert.equal(stripThinking('only reasoning</think>'), '');
  const answer = extractAnswer({
    base_resp: { status_code: 0 },
    choices: [{
      message: {
        content: 'draft the reply</think>\nSend them one by one.',
        reasoning_content: 'HIDDEN-REASONING',
      },
    }],
  });
  assert.equal(answer, 'Send them one by one.');
  assert.equal(answer.includes('HIDDEN-REASONING'), false);
});

test('a failed or sensitive MiniMax payload is not an answer', () => {
  assert.throws(() => extractAnswer({ base_resp: { status_code: 1004 } }));
  assert.throws(() => extractAnswer({
    base_resp: { status_code: 0 },
    output_sensitive: true,
    choices: [{ message: { content: 'secret' } }],
  }));
  assert.throws(() => extractAnswer({
    choices: [{ message: { content: '<think>only this</think>', reasoning_content: 'also hidden' } }],
  }));
});

test('sales context is the last 14 days of date, revenue, cash, and scan', () => {
  const note = compactSales(SALES, { now: NOW, days: 14 });
  assert.match(note, /B1 04\/10\/2026 revenue 5789 cash 4000 scan 1789/);
  assert.match(note, /B1 17\/10\/2026 revenue 2200 cash 1200 scan 1000/);
  assert.match(note, /B2 16\/10\/2026 revenue 800 cash 500 scan 300/);
  assert.match(note, /B3: no sales in this window/);
  assert.equal(note.includes('111'), false);
  assert.equal(note.includes('99999'), false);
  assert.equal(note.includes('4242'), false);
  assert.equal(note.includes('SUPPLIER-SECRET-PRICE'), false);
  assert.equal(note.includes('7777'), false);
});

test('staff messages drop sales context even if a caller passes it', () => {
  const staff = buildChatMessages({
    owner: false,
    question: 'what was revenue?',
    salesContext: 'B1 04/10/2026 revenue 5789 cash 4000 scan 1789',
  });
  assert.equal(staff[0].role, 'system');
  assert.match(staff[0].content, /never state sales numbers/i);
  assert.match(staff[0].content, /one by one/i);
  assert.equal(JSON.stringify(staff).includes('5789'), false);
  assert.equal(staff[1].content, 'what was revenue?');
  const owner = buildChatMessages({
    owner: true,
    question: 'ยอด B1',
    salesContext: 'B1 04/10/2026 revenue 5789 cash 4000 scan 1789',
  });
  assert.match(owner[1].content, /5789/);
  assert.match(owner[1].content, /ยอด B1/);
  const missing = buildChatMessages({ owner: true, question: 'ยอด', salesContext: null });
  assert.match(missing[1].content, /unavailable/);
  assert.equal(missing[1].content.includes('5789'), false);
});

test('a group message is a question only when the bot is mentioned or it starts with bot', () => {
  assert.equal(groupQuestion('hello everyone', {}), null);
  assert.equal(groupQuestion('bottle of water', {}), null);
  assert.equal(groupQuestion('bot how do I send photos?', {}), 'how do I send photos?');
  assert.equal(groupQuestion('@bot translate this', {}), 'translate this');
  assert.equal(groupQuestion('Bot', {}), '');
  const mentioned = groupQuestion('please @SomSaiJai Bot help', {
    mention: { mentionees: [{ index: 7, length: 14, isSelf: true }] },
  });
  assert.equal(mentioned, 'please  help');
});

test('MINIMAX_MODEL defaults to MiniMax-M2 and a missing key stays empty', () => {
  assert.equal(loadConfig({}).minimaxKey, '');
  assert.equal(loadConfig({}).minimaxModel, DEFAULT_MODEL);
  assert.equal(loadConfig({ MINIMAX_API_KEY: 'k', MINIMAX_MODEL: 'MiniMax-M2.5' }).minimaxModel, 'MiniMax-M2.5');
});

function textEvent(text, userId, extra) {
  return {
    webhookEventId: (extra && extra.webhookEventId) || `qa-${userId}-${text}`.slice(0, 80),
    type: 'message',
    timestamp: NOW,
    replyToken: 'reply-1',
    source: { type: 'user', userId },
    message: { type: 'text', id: 'm1', text },
    ...extra,
  };
}

function harness(overrides) {
  const pushes = [];
  const replies = [];
  const calls = [];
  const store = new MemoryStore();
  const config = Object.assign({
    channelSecret: 's',
    ownerUserId: 'U-parn',
    groupId: 'C-staff',
    orderSenderUserIds: ['U-ming'],
    suppliersPath: SUPPLIERS,
    publicUrl: 'https://somsaijailive.vercel.app',
    minimaxKey: 'test-key',
    minimaxModel: '',
    qaDailyLimit: 30,
  }, overrides && overrides.config);
  const salesDoc = (overrides && overrides.sales) || SALES;
  const fetchImpl = (overrides && overrides.fetchImpl) || (async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/data.json')) {
      return { ok: true, async json() { return salesDoc; } };
    }
    return {
      ok: true,
      async json() {
        return {
          base_resp: { status_code: 0 },
          choices: [{
            message: {
              content: 'working it out</think>\nSend photos one by one, not in an album.',
              reasoning_content: 'HIDDEN-REASONING',
            },
          }],
        };
      },
    };
  });
  const ctx = {
    config,
    store,
    now: NOW,
    fetchImpl,
    line: {
      async push(to, messages) { pushes.push({ to, messages }); },
      async reply(token, messages) { replies.push({ token, messages }); },
    },
  };
  return { pushes, replies, calls, store, ctx };
}

async function post(ctx, event) {
  const raw = Buffer.from(JSON.stringify({ events: [event] }));
  return handleWebhook({ rawBody: raw, signature: signBody(raw, ctx.config.channelSecret), ctx });
}

function minimaxCalls(calls) {
  return calls.filter(call => call.url === MINIMAX_URL);
}

function dataCalls(calls) {
  return calls.filter(call => call.url.endsWith('/data.json'));
}

function replyText(replies) {
  return replies.map(row => row.messages.map(message => message.text).join('\n')).join('\n');
}

test('the owner gets sales context and the reply drops thinking', async () => {
  const { pushes, replies, calls, ctx } = harness();
  const result = await post(ctx, textEvent('ยอดขาย B1 เมื่อวาน', 'U-parn', { webhookEventId: 'owner-q' }));
  assert.equal(result.outcomes[0].qa, true);
  assert.equal(result.outcomes[0].owner, true);
  assert.equal(pushes.length, 0);
  assert.equal(dataCalls(calls).length, 1);
  assert.equal(dataCalls(calls)[0].url, 'https://somsaijailive.vercel.app/data.json');
  const sent = minimaxCalls(calls);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.method, 'POST');
  assert.equal(sent[0].options.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(sent[0].options.body);
  assert.equal(body.model, DEFAULT_MODEL);
  assert.equal(body.max_completion_tokens, QA_MAX_TOKENS);
  assert.equal(body.max_tokens, QA_MAX_TOKENS);
  assert.equal(QA_MAX_TOKENS, 1000);
  assert.match(body.messages[0].content, /Answer in 1-3 short sentences unless asked for more/);
  assert.match(STAFF_RULES, /Answer in 1-3 short sentences unless asked for more/);
  assert.match(OWNER_RULES, /Answer in 1-3 short sentences unless asked for more/);
  assert.match(body.messages[1].content, /revenue 5789/);
  assert.equal(JSON.stringify(body).includes('SUPPLIER-SECRET-PRICE'), false);
  assert.equal(JSON.stringify(body).includes('7777'), false);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].token, 'reply-1');
  assert.equal(replies[0].messages[0].text, 'Send photos one by one, not in an album.');
  assert.equal(replyText(replies).includes('HIDDEN-REASONING'), false);
  assert.equal(replyText(replies).includes('</think>'), false);
});

test('staff and owner prompts refuse guessed menu and shop facts', async () => {
  const asked = /menu, ingredients, sugar, recipes, prices, promotions, or shop rules/;
  const example = /I don't know that yet\. Please ask Parn\./;
  for (const rules of [STAFF_RULES, OWNER_RULES]) {
    assert.match(rules, asked);
    assert.match(rules, /Never guess or state those product facts/);
    assert.match(rules, example);
    assert.match(rules, /food safety, storage, polite customer phrases, and English help/);
  }
  assert.match(OWNER_RULES, /Use only figures that appear in that note/);
  assert.match(STAFF_RULES, /Never state sales numbers/);

  const staff = harness();
  await post(staff.ctx, textEvent('what is in the mango juice?', 'U-staff', { webhookEventId: 'menu-staff' }));
  const staffPrompt = JSON.parse(minimaxCalls(staff.calls)[0].options.body).messages[0].content;
  assert.match(staffPrompt, asked);
  assert.match(staffPrompt, example);
  assert.equal(staffPrompt.includes('Recent sales'), false);

  const owner = harness();
  await post(owner.ctx, textEvent('สูตรส้มมีน้ำตาลไหม', 'U-parn', { webhookEventId: 'menu-owner' }));
  const ownerBody = JSON.parse(minimaxCalls(owner.calls)[0].options.body);
  assert.match(ownerBody.messages[0].content, asked);
  assert.match(ownerBody.messages[0].content, example);
  assert.match(ownerBody.messages[0].content, /Use only figures that appear in that note/);
  assert.match(ownerBody.messages[1].content, /revenue 5789/);
});

test('staff and Ming get no sales data and no data.json fetch', async () => {
  for (const userId of ['U-staff', 'U-ming']) {
    const { pushes, replies, calls, ctx } = harness();
    const result = await post(ctx, textEvent('what was B1 revenue?', userId, { webhookEventId: `staff-${userId}` }));
    assert.equal(result.outcomes[0].owner, false);
    assert.equal(pushes.length, 0);
    assert.equal(dataCalls(calls).length, 0);
    const body = JSON.parse(minimaxCalls(calls)[0].options.body);
    assert.match(body.messages[0].content, /Never state sales numbers/);
    assert.equal(JSON.stringify(body).includes('5789'), false);
    assert.equal(JSON.stringify(body).includes('Recent sales'), false);
    assert.equal(JSON.stringify(body).includes('SUPPLIER-SECRET-PRICE'), false);
    assert.match(replies[0].messages[0].text, /one by one/);
  }
});

test('a fruit order is not sent to MiniMax', async () => {
  const { pushes, calls, ctx } = harness();
  const ming = await post(ctx, textEvent(ORDER, 'U-ming', { webhookEventId: 'ming-order' }));
  assert.equal(ming.outcomes[0].order, true);
  const parn = await post(ctx, textEvent(ORDER, 'U-parn', { webhookEventId: 'parn-order' }));
  assert.equal(parn.outcomes[0].order, true);
  assert.equal(minimaxCalls(calls).length, 0);
  assert.equal(dataCalls(calls).length, 0);
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].to, 'U-parn');
});

test('commands stay commands and do not call MiniMax', async () => {
  const { replies, calls, ctx } = harness();
  const id = await post(ctx, textEvent('id', 'U-staff', { webhookEventId: 'cmd-id' }));
  assert.equal(id.outcomes[0].id, true);
  const help = await post(ctx, textEvent('help', 'U-staff', { webhookEventId: 'cmd-help' }));
  assert.equal(help.outcomes[0].help, true);
  const summary = await post(ctx, textEvent('summary', 'U-staff', { webhookEventId: 'cmd-summary' }));
  assert.equal(summary.outcomes[0].denied, true);
  const order = await post(ctx, textEvent('ออเดอร์', 'U-parn', { webhookEventId: 'cmd-order' }));
  assert.equal(order.outcomes[0].empty, true);
  assert.equal(minimaxCalls(calls).length, 0);
  assert.match(replyText(replies), /Your id/);
  assert.match(replyText(replies), /Only Parn can ask for the summary/);
});

test('a group answers only on a mention or a bot prefix, and never with sales figures', async () => {
  const { pushes, replies, calls, ctx } = harness();
  const plain = await post(ctx, textEvent('what was revenue?', 'U-parn', {
    webhookEventId: 'group-plain',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-parn' },
  }));
  assert.equal(plain.outcomes[0].ignored, true);
  assert.equal(replies.length, 0);

  const prefixed = await post(ctx, textEvent('bot how do I send the photos?', 'U-staff', {
    webhookEventId: 'group-bot',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
  }));
  assert.equal(prefixed.outcomes[0].qa, true);
  assert.equal(prefixed.outcomes[0].owner, false);

  const mentioned = await post(ctx, textEvent('@SomSaiJai Bot ยอดวันนี้', 'U-parn', {
    webhookEventId: 'group-mention',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-parn' },
    message: {
      type: 'text',
      id: 'm-mention',
      text: '@SomSaiJai Bot ยอดวันนี้',
      mention: { mentionees: [{ index: 0, length: 15, isSelf: true }] },
    },
  }));
  assert.equal(mentioned.outcomes[0].qa, true);
  assert.equal(mentioned.outcomes[0].owner, false);
  assert.equal(dataCalls(calls).length, 0);
  assert.equal(pushes.length, 0);
  for (const call of minimaxCalls(calls)) {
    const body = JSON.parse(call.options.body);
    assert.equal(JSON.stringify(body).includes('5789'), false);
    assert.match(body.messages[0].content, /Never state sales numbers/);
  }
  const mentionBody = JSON.parse(minimaxCalls(calls)[1].options.body);
  assert.match(mentionBody.messages[1].content, /ยอดวันนี้/);
  assert.equal(mentionBody.messages[1].content.includes('@SomSaiJai'), false);
});

test('a bare mention gets a short prompt and does not call MiniMax', async () => {
  const { calls, replies, ctx } = harness();
  const result = await post(ctx, textEvent('@bot', 'U-staff', {
    webhookEventId: 'group-empty',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
  }));
  assert.equal(result.outcomes[0].empty, true);
  assert.equal(minimaxCalls(calls).length, 0);
  assert.equal(replies[0].messages[0].text, QA_EMPTY);
});

test('a missing MiniMax key is silent', async () => {
  const { pushes, replies, calls, ctx } = harness({ config: { minimaxKey: '' } });
  const direct = await post(ctx, textEvent('how do I send photos?', 'U-staff', { webhookEventId: 'off-direct' }));
  const group = await post(ctx, textEvent('bot hello', 'U-staff', {
    webhookEventId: 'off-group',
    source: { type: 'group', groupId: 'C-staff', userId: 'U-staff' },
  }));
  assert.equal(direct.outcomes[0].ignored, true);
  assert.equal(group.outcomes[0].ignored, true);
  assert.equal(replies.length, 0);
  assert.equal(pushes.length, 0);
  assert.equal(calls.length, 0);
});

test('a foreign group mention stays ignored', async () => {
  const { replies, calls, ctx } = harness();
  const result = await post(ctx, textEvent('bot hello', 'U-staff', {
    webhookEventId: 'foreign',
    source: { type: 'group', groupId: 'C-other', userId: 'U-staff' },
  }));
  assert.equal(result.outcomes[0].ignored, 'foreign_group');
  assert.equal(replies.length, 0);
  assert.equal(calls.length, 0);
});

test('the daily limit replies in English and stops calling MiniMax', async () => {
  const { replies, calls, ctx } = harness({ config: { qaDailyLimit: 2 } });
  await post(ctx, textEvent('question one', 'U-staff', { webhookEventId: 'limit-1' }));
  await post(ctx, textEvent('question two', 'U-staff', { webhookEventId: 'limit-2' }));
  const third = await post(ctx, textEvent('question three', 'U-staff', { webhookEventId: 'limit-3' }));
  assert.equal(third.outcomes[0].limited, true);
  assert.equal(minimaxCalls(calls).length, 2);
  assert.equal(replies[2].messages[0].text, QA_LIMIT);
});

function minimaxPayload(content, finish) {
  return {
    base_resp: { status_code: 0 },
    choices: [{ finish_reason: finish, message: { content } }],
  };
}

test('a length cutoff that is only thinking is retried once at 2000 tokens', async () => {
  const bodies = [];
  const answer = await askMinimax({
    apiKey: 'k',
    messages: [{ role: 'user', content: 'hi' }],
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      const payload = bodies.length === 1
        ? minimaxPayload('<think>still reasoning', 'length')
        : minimaxPayload('<think>done</think>\nSend them one by one.', 'stop');
      return { ok: true, async json() { return payload; } };
    },
  });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].max_tokens, QA_MAX_TOKENS);
  assert.equal(bodies[0].max_completion_tokens, 1000);
  assert.equal(bodies[1].max_tokens, QA_RETRY_TOKENS);
  assert.equal(bodies[1].max_completion_tokens, 2000);
  assert.equal(answer, 'Send them one by one.');
});

test('a length cutoff that already has an answer is not retried', async () => {
  let calls = 0;
  const answer = await askMinimax({
    apiKey: 'k',
    messages: [{ role: 'user', content: 'hi' }],
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, async json() { return minimaxPayload('<think>x</think>\nShort.', 'length'); } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(answer, 'Short.');
});

test('an empty stop reply is not retried', async () => {
  const { replies, calls, ctx } = harness({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, async json() { return minimaxPayload('<think>only</think>', 'stop'); } };
    },
  });
  const result = await post(ctx, textEvent('hello', 'U-staff', { webhookEventId: 'empty-stop' }));
  assert.equal(result.outcomes[0].error, true);
  assert.equal(replies[0].messages[0].text, QA_ERROR);
  assert.equal(minimaxCalls(calls).length, 1);
});

test('a second thinking cutoff falls back to the error text', async () => {
  const { replies, calls, pushes, ctx } = harness({
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options });
      return { ok: true, async json() { return minimaxPayload('<think>still reasoning', 'length'); } };
    },
  });
  const result = await post(ctx, textEvent('hello', 'U-staff', { webhookEventId: 'think-cut' }));
  assert.equal(result.outcomes[0].error, true);
  assert.equal(replies[0].messages[0].text, QA_ERROR);
  assert.equal(pushes.length, 0);
  const sent = minimaxCalls(calls);
  assert.equal(sent.length, 2);
  assert.equal(JSON.parse(sent[0].options.body).max_tokens, 1000);
  assert.equal(JSON.parse(sent[1].options.body).max_tokens, 2000);
  assert.equal(JSON.parse(sent[1].options.body).max_completion_tokens, 2000);
});

test('a timeout or HTTP error becomes a short English reply and does not push', async () => {
  const hanging = harness({
    config: { qaTimeoutMs: 30 },
    fetchImpl: () => new Promise(() => {}),
  });
  const timed = await post(hanging.ctx, textEvent('hello', 'U-staff', { webhookEventId: 'timeout' }));
  assert.equal(timed.outcomes[0].error, true);
  assert.equal(hanging.replies[0].messages[0].text, QA_ERROR);
  assert.equal(hanging.pushes.length, 0);

  const failing = harness({
    fetchImpl: async () => ({ ok: false, status: 500, async json() { return {}; } }),
  });
  const http = await post(failing.ctx, textEvent('hello', 'U-parn', { webhookEventId: 'http' }));
  assert.equal(http.outcomes[0].error, true);
  assert.equal(failing.replies[0].messages[0].text, QA_ERROR);
  assert.equal(failing.pushes.length, 0);
  assert.equal(failing.replies[0].messages[0].text.includes('500'), false);
});

test('a preview GET reports whether Q&A is on and does not call MiniMax', async () => {
  const webhook = require('../../api/webhook');
  const prevEnv = process.env.VERCEL_ENV;
  const prevKey = process.env.MINIMAX_API_KEY;
  const bodies = [];
  const statuses = [];
  function res() {
    return {
      status(code) { statuses.push(code); return this; },
      setHeader() { return this; },
      end(body) { bodies.push(body); return this; },
    };
  }
  const calls = [];
  const prevFetch = global.fetch;
  global.fetch = async (url) => {
    calls.push(String(url));
    throw new Error('network');
  };
  try {
    process.env.VERCEL_ENV = 'production';
    delete process.env.MINIMAX_API_KEY;
    await webhook({ method: 'GET', url: '/api/webhook?qa=1', headers: {} }, res());
    assert.deepEqual(statuses, [405]);

    process.env.VERCEL_ENV = 'preview';
    await webhook({ method: 'GET', url: '/api/webhook?qa=1', headers: {} }, res());
    process.env.MINIMAX_API_KEY = 'present';
    await webhook({ method: 'GET', url: '/api/webhook?qa=1', headers: {} }, res());
    assert.deepEqual(statuses, [405, 200, 200]);
    assert.equal(bodies[0], 'POST only');
    const off = JSON.parse(bodies[1]);
    const on = JSON.parse(bodies[2]);
    assert.equal(off.enabled, false);
    assert.equal(off.model, 'MiniMax-M2');
    assert.equal(JSON.stringify(off).includes('present'), false);
    assert.equal(on.enabled, true);
    assert.equal(JSON.stringify(on).includes('present'), false);
    assert.equal(calls.length, 0);
  } finally {
    global.fetch = prevFetch;
    if (prevEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prevEnv;
    if (prevKey === undefined) delete process.env.MINIMAX_API_KEY;
    else process.env.MINIMAX_API_KEY = prevKey;
  }
});

test('the same webhook event does not call MiniMax twice', async () => {
  const { calls, ctx } = harness();
  const event = textEvent('hello', 'U-staff', { webhookEventId: 'same-event' });
  await post(ctx, event);
  const again = await post(ctx, event);
  assert.equal(again.outcomes[0].duplicate, true);
  assert.equal(minimaxCalls(calls).length, 1);
});
