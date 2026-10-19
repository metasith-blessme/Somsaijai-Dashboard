/**
 * MiniMax Q&A for the LINE bot.
 * Replies only (never push). Fully off when MINIMAX_API_KEY is missing.
 * Sales figures are loaded only for the owner's 1:1 chat.
 */

const { ALBUM_HELP } = require('./staff_text');

const MINIMAX_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const DEFAULT_MODEL = 'MiniMax-M2';
const QA_DAILY_LIMIT = 30;
const QA_MAX_TOKENS = 1000;
const QA_RETRY_TOKENS = 2000;
const QA_REPLY_MAX = 1000;
const QA_TIMEOUT_MS = 15000;
const SALES_FETCH_MS = 8000;
const QUESTION_MAX = 1500;

const QA_ERROR = 'Could not answer. Try again.';
const QA_LIMIT = 'Too many questions today. Try again tomorrow.';
const QA_EMPTY = 'Ask a short question. Photos: one by one, not an album.';

const PRODUCT_FACTS = [
  'You do not know SomSaiJai\'s menu, ingredients, sugar, recipes, prices, promotions, or shop rules.',
  'Never guess or state those product facts.',
  'For any such question, reply briefly in the user\'s language that you do not know and to ask Parn. For staff, use simple English, for example: "I don\'t know that yet. Please ask Parn."',
  'General help is still fine: food safety, storage, polite customer phrases, and English help.',
];

const STAFF_RULES = [
  'You are a helpful assistant for SomSaiJai, a cold-press juice shop with branches B1, B2, B3, and B4.',
  'The person you are talking to is staff, not the owner. Staff are often from Myanmar and use simple English.',
  'Reply in the language they wrote in. If you are not sure, use short simple English.',
  'You may explain how to send the daily report photos and do simple translations.',
  `Photo rule: ${ALBUM_HELP}`,
  ...PRODUCT_FACTS,
  'Never state sales numbers, revenue, cash, scan totals, costs, profit, wages, rent, or supplier prices.',
  'You do not have that data. If they ask for any figure, say only Parn can see sales numbers in a private chat, and do not guess.',
  'Never invent numbers.',
  'Answer in 1-3 short sentences unless asked for more.',
].join('\n');

const OWNER_RULES = [
  'You are a helpful assistant for SomSaiJai, a cold-press juice shop with branches B1, B2, B3, and B4.',
  'The person you are talking to is the owner, Parn. They may write in Thai or English.',
  'Reply in the language they wrote in. If you are not sure, use short simple English.',
  'You may explain how to send report photos.',
  `Photo rule: ${ALBUM_HELP}`,
  ...PRODUCT_FACTS,
  'A SALES NOTE may be included in the user message. It comes from the live dashboard data and covers every published day for every branch: month totals, all-branch month totals, cups by fruit, booked expenses, and daily revenue/cash/scan/expense.',
  'Answer sales, revenue, cash, scan, cups, fruit, and expense questions from that note. Copy figures exactly; you may add them up when asked (for example several branches or days).',
  'If a day, month, branch, or figure is not in the note, or the note says sales are unavailable, say you do not have that figure yet. Do not guess.',
  'Never invent numbers. Wages, rent, and supplier prices: only state them if they appear in the note.',
  'Give the figure first, in THB with thousands separators, for example "B3 Oct 2026: ฿97,420 (15 days)".',
  'Answer in 1-3 short sentences unless asked for more.',
].join('\n');

const BOT_PREFIX = /^\s*@?bot\b[:\s,-]*/i;

function qaEnabled(config) {
  return Boolean(config && String(config.minimaxKey || '').trim());
}

function dailyLimit(config) {
  const n = Number(config && config.qaDailyLimit);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return QA_DAILY_LIMIT;
}

function bangkokParts(now) {
  const date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = type => Number(parts.find(part => part.type === type).value);
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

function bangkokStamp(now) {
  const p = bangkokParts(now);
  return Date.UTC(p.year, p.month - 1, p.day);
}

function bangkokDateKey(now) {
  const p = bangkokParts(now);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function mentionedSelf(message) {
  const list = message && message.mention && message.mention.mentionees;
  if (!Array.isArray(list)) return false;
  return list.some(item => item && item.isSelf === true);
}

function stripSelfMentions(text, message) {
  const list = message && message.mention && message.mention.mentionees;
  if (!Array.isArray(list)) return String(text || '');
  const cuts = list.filter(item => item && item.isSelf === true && Number.isFinite(Number(item.index)) && Number.isFinite(Number(item.length)));
  cuts.sort((a, b) => Number(b.index) - Number(a.index));
  let out = String(text || '');
  for (const item of cuts) {
    const start = Number(item.index);
    const end = start + Number(item.length);
    if (start < 0 || start > out.length) continue;
    out = out.slice(0, start) + out.slice(Math.min(end, out.length));
  }
  return out;
}

/**
 * Group/room messages answer only when the bot is mentioned or the text
 * starts with "bot" / "@bot". Returns null when this is not a question,
 * or a string (possibly empty) when it is.
 */
function groupQuestion(text, message) {
  const raw = String(text || '');
  const mentioned = mentionedSelf(message);
  if (!mentioned && !BOT_PREFIX.test(raw)) return null;
  let body = stripSelfMentions(raw, message).replace(BOT_PREFIX, '');
  body = body.replace(BOT_PREFIX, '').trim();
  return body;
}

function qaQuestion(event) {
  const source = event && event.source || {};
  const text = event && event.message && event.message.text;
  if (source.type === 'group' || source.type === 'room') {
    const question = groupQuestion(text, event.message);
    return question == null ? null : { question };
  }
  if (source.type === 'user') {
    const question = String(text || '').trim();
    if (!question) return null;
    return { question };
  }
  return null;
}

function isOwnerDirect(source, config) {
  return Boolean(
    source
    && source.type === 'user'
    && config
    && config.ownerUserId
    && source.userId === config.ownerUserId,
  );
}

function buildChatMessages({ owner, question, salesContext }) {
  const asked = String(question || '').slice(0, QUESTION_MAX);
  if (!owner) {
    return [
      { role: 'system', content: STAFF_RULES },
      { role: 'user', content: asked },
    ];
  }
  const note = salesContext
    ? String(salesContext)
    : 'Sales note: unavailable. Do not invent any figures.';
  return [
    { role: 'system', content: OWNER_RULES },
    { role: 'user', content: `${note}\n\nQuestion:\n${asked}` },
  ];
}

function stripThinking(text) {
  let s = String(text || '');
  s = s.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '');
  const close = s.toLowerCase().lastIndexOf('</think');
  if (close !== -1) {
    const after = s.slice(close);
    const end = after.indexOf('>');
    s = end === -1 ? '' : after.slice(end + 1);
  }
  s = s.replace(/<think(?:ing)?>[\s\S]*$/gi, '');
  s = s.replace(/<\/?think(?:ing)?>/gi, '');
  return s.trim();
}

function messageText(message) {
  if (!message) return '';
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part && part.type === 'text' && typeof part.text === 'string') return part.text;
      return '';
    }).join('');
  }
  return '';
}

function choiceOf(payload) {
  if (!payload || typeof payload !== 'object') {
    const error = new Error('bad minimax response');
    error.qa = true;
    throw error;
  }
  const base = payload.base_resp;
  if (base && Number(base.status_code) !== 0) {
    const error = new Error('minimax status');
    error.qa = true;
    throw error;
  }
  if (payload.output_sensitive === true) {
    const error = new Error('minimax sensitive');
    error.qa = true;
    throw error;
  }
  return Array.isArray(payload.choices) ? payload.choices[0] : null;
}

function extractAnswer(payload) {
  const choice = choiceOf(payload);
  const answer = stripThinking(messageText(choice && choice.message));
  if (!answer) {
    const error = new Error('empty minimax answer');
    error.qa = true;
    throw error;
  }
  return answer.slice(0, QA_REPLY_MAX);
}

function thinkingCutOff(payload) {
  const choice = choiceOf(payload);
  const answer = stripThinking(messageText(choice && choice.message));
  return !answer && Boolean(choice) && choice.finish_reason === 'length';
}

function clipReply(text) {
  return String(text || '').slice(0, QA_REPLY_MAX).trim();
}

async function consumeQuota(store, userId, now, limit) {
  const day = bangkokDateKey(now);
  const key = `qa:rate:${userId || 'anonymous'}:${day}`;
  const row = (await store.getJson(key)) || { count: 0, day };
  const count = Number(row.count) || 0;
  if (count >= limit) return { allowed: false, count, key };
  await store.putJson(key, { count: count + 1, day });
  return { allowed: true, count: count + 1, key };
}

function saleStamp(raw) {
  const match = String(raw || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!day || month < 1 || month > 12) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const check = new Date(stamp);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return stamp;
}

function formatStamp(stamp) {
  const date = new Date(stamp);
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getUTCFullYear()}`;
}

function figure(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return 'unknown';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FRUITS = [
  ['or', 'orange'], ['or_100', 'orange premium/no-ice (inside orange)'], ['wm', 'watermelon'], ['mg', 'mango'],
  ['co', 'coconut'], ['ap', 'apple'], ['yco', 'young coconut'], ['guava', 'guava'], ['pineapple', 'pineapple'],
  ['mangosteen', 'mangosteen'], ['mangosteen_lychee', 'mangosteen & lychee'], ['rambutan', 'rambutan'],
];
const SALES_NOTE_MAX = 60000;

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function monthKey(tag) {
  const m = String(tag || '').match(/^([A-Z][a-z]{2})(\d{2})$/);
  if (!m || MONTH_NAMES.indexOf(m[1]) < 0) return null;
  return (2000 + Number(m[2])) * 100 + MONTH_NAMES.indexOf(m[1]) + 1;
}

function monthLabel(tag) {
  const k = monthKey(tag);
  return k ? `${MONTH_NAMES[k % 100 - 1]} ${Math.floor(k / 100)}` : String(tag);
}

/**
 * Owner sales note built from the same data.json the dashboard renders.
 * Every published month for every branch: month totals, cups by fruit, booked expenses,
 * and one compact line of daily figures per branch-month. Oldest daily lines are
 * dropped first if the note would be too long; month totals are always kept.
 */
function compactSales(data, options = {}) {
  const todayStamp = bangkokStamp(options.now);
  const today = formatStamp(todayStamp);
  const thisMonth = (() => { const p = bangkokParts(options.now); return `${MONTH_NAMES[p.month - 1]}${String(p.year).slice(2)}`; })();
  const branchesObj = data && data.branches && typeof data.branches === 'object' ? data.branches : {};
  const branches = Object.keys(branchesObj).filter(b => /^B\d+$/.test(b)).sort();
  const months = new Set();
  const groups = [];
  for (const branch of branches) {
    const sales = branchesObj[branch] && branchesObj[branch].sales;
    if (!sales || typeof sales !== 'object') continue;
    for (const [tag, list] of Object.entries(sales)) {
      if (!Array.isArray(list) || monthKey(tag) == null) continue;
      const rows = [];
      for (const row of list) {
        if (!row || typeof row !== 'object') continue;
        const stamp = saleStamp(row.d);
        if (stamp == null || stamp > todayStamp) continue; // a future date is a data error, not a sale
        rows.push({ stamp, row });
      }
      if (!rows.length) continue;
      rows.sort((a, b) => a.stamp - b.stamp);
      months.add(tag);
      groups.push({ branch, tag, key: monthKey(tag), rows });
    }
  }
  groups.sort((a, b) => a.key - b.key || a.branch.localeCompare(b.branch));
  const monthList = [...months].sort((a, b) => monthKey(a) - monthKey(b));

  const head = [
    'SALES NOTE. Source: the live SomSaiJai dashboard data (data.json), all published days. THB.',
    `Today in Bangkok: ${today}. "This month" = ${monthLabel(thisMonth)}.`,
    `Branches: ${branches.join(', ')}. A day that is not listed has no published sales.`,
    'Revenue = gross sales before shift expenses (ice etc.). Cash and scan (QR/transfer) are the payment split; in some older months they do not add up to revenue, so always quote revenue for totals. Shift exp = expenses paid from the till that day.',
  ];
  const totals = ['MONTH TOTALS (branch month: days, date range, revenue, cash, scan, shift exp):'];
  const cups = ['CUPS BY FRUIT (branch month). Only mangosteen also has booked revenue; other fruit revenue is not recorded:'];
  const daily = [];
  for (const g of groups) {
    const sum = k => Math.round(g.rows.reduce((t, x) => t + num(x.row[k]), 0) * 100) / 100;
    const first = formatStamp(g.rows[0].stamp).slice(0, 5), last = formatStamp(g.rows[g.rows.length - 1].stamp).slice(0, 5);
    totals.push(`${g.branch} ${monthLabel(g.tag)}: ${g.rows.length} days ${first}-${last}, revenue ${sum('rev')}, cash ${sum('cash')}, scan ${sum('scan')}, shift exp ${sum('exp')}`);
    const parts = [];
    for (const [k, name] of FRUITS) {
      const v = sum(k);
      if (!v) continue;
      let text = `${name} ${v}`;
      if (k === 'mangosteen' && g.rows.some(x => typeof x.row.mangosteen_rev === 'number')) text += ` (revenue ${sum('mangosteen_rev')})`;
      parts.push(text);
    }
    cups.push(`${g.branch} ${monthLabel(g.tag)}: total cups ${sum('tot')}${parts.length ? '; ' + parts.join(', ') : ''}`);
    daily.push({ key: g.key, text: `${g.branch} ${monthLabel(g.tag)} daily (day revenue/cash/scan/exp): ` + g.rows.map(x => {
      const dd = formatStamp(x.stamp).slice(0, 2);
      return `${dd} ${figure(x.row.rev)}/${figure(x.row.cash)}/${figure(x.row.scan)}/${num(x.row.exp)}`;
    }).join('; ') });
  }
  const all = ['ALL BRANCHES BY MONTH (revenue):'];
  for (const tag of monthList) {
    const parts = groups.filter(g => g.tag === tag).map(g => [g.branch, Math.round(g.rows.reduce((t, x) => t + num(x.row.rev), 0) * 100) / 100]);
    all.push(`${monthLabel(tag)}: total ${Math.round(parts.reduce((t, p) => t + p[1], 0) * 100) / 100} (${parts.map(p => `${p[0]} ${p[1]}`).join(', ')})`);
  }
  const exp = ['BOOKED EXPENSES from the expense sheets (branch month: bucket total, then categories):'];
  const ex = Array.isArray(data && data.expenses) ? data.expenses : [];
  const eg = new Map();
  for (const e of ex) {
    if (!e || !num(e.amt) || monthKey(e.month) == null) continue;
    const key = `${e.branch || '?'}|${e.month}`;
    if (!eg.has(key)) eg.set(key, { branch: e.branch || '?', tag: e.month, buckets: new Map() });
    const b = eg.get(key).buckets;
    const bucket = e.bucket || 'Other';
    if (!b.has(bucket)) b.set(bucket, { total: 0, cats: new Map() });
    const t = b.get(bucket); t.total += num(e.amt);
    const cat = e.cat || 'Other'; t.cats.set(cat, (t.cats.get(cat) || 0) + num(e.amt));
  }
  const round = v => Math.round(v * 100) / 100;
  for (const g of [...eg.values()].sort((a, b) => monthKey(a.tag) - monthKey(b.tag) || a.branch.localeCompare(b.branch))) {
    const parts = [...g.buckets.entries()].map(([name, t]) => `${name} ${round(t.total)} (${[...t.cats.entries()].map(([c, v]) => `${c} ${round(v)}`).join(', ')})`);
    exp.push(`${g.branch} ${monthLabel(g.tag)}: ${parts.join('; ')}`);
  }
  const fixed = [head, all, totals, cups, exp].map(x => x.join('\n')).join('\n\n');
  // keep the newest daily lines; drop the oldest months first if too long
  daily.sort((a, b) => b.key - a.key);
  const kept = [];
  let size = fixed.length + 40;
  let dropped = 0;
  for (const d of daily) {
    if (size + d.text.length + 1 > (options.maxChars || SALES_NOTE_MAX)) { dropped++; continue; }
    kept.push(d); size += d.text.length + 1;
  }
  kept.sort((a, b) => a.key - b.key);
  const tail = ['DAILY FIGURES:', ...kept.map(d => d.text)];
  if (dropped) tail.push(`(${dropped} older branch-months have month totals above but no daily lines here.)`);
  return `${fixed}\n\n${tail.join('\n')}`;
}

async function fetchSalesContext({ publicUrl, fetchImpl, now, timeoutMs }) {
  const base = String(publicUrl || '').replace(/\/$/, '');
  if (!base) return null;
  const fetchFn = fetchImpl || fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeoutMs || SALES_FETCH_MS;
  let timer;
  const pending = fetchFn(`${base}/data.json`, {
    method: 'GET',
    signal: controller ? controller.signal : undefined,
  });
  pending.catch(() => {});
  try {
    const res = await Promise.race([
      pending,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          if (controller) controller.abort();
          reject(new Error('sales timeout'));
        }, ms);
      }),
    ]);
    if (!res || !res.ok) return null;
    const data = await res.json();
    return compactSales(data, { now });
  } finally {
    clearTimeout(timer);
  }
}

async function postMinimax({ apiKey, model, messages, fetchImpl, timeoutMs, tokens }) {
  const fetchFn = fetchImpl || fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeoutMs || QA_TIMEOUT_MS;
  let timer;
  const pending = fetchFn(MINIMAX_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      messages,
      max_completion_tokens: tokens,
      max_tokens: tokens,
      temperature: 1,
    }),
    signal: controller ? controller.signal : undefined,
  });
  pending.catch(() => {});
  const res = await Promise.race([
    pending,
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        if (controller) controller.abort();
        reject(new Error('timeout'));
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
  if (!res || !res.ok) {
    const error = new Error('minimax http');
    error.qa = true;
    throw error;
  }
  try {
    return await res.json();
  } catch (err) {
    const error = new Error('minimax json');
    error.qa = true;
    throw error;
  }
}

async function askMinimax({ apiKey, model, messages, fetchImpl, timeoutMs, maxTokens }) {
  const request = tokens => postMinimax({
    apiKey, model, messages, fetchImpl, timeoutMs, tokens,
  });
  const first = await request(maxTokens || QA_MAX_TOKENS);
  if (!thinkingCutOff(first)) return extractAnswer(first);
  return extractAnswer(await request(QA_RETRY_TOKENS));
}

module.exports = {
  MINIMAX_URL,
  DEFAULT_MODEL,
  QA_DAILY_LIMIT,
  QA_MAX_TOKENS,
  QA_RETRY_TOKENS,
  QA_REPLY_MAX,
  QA_TIMEOUT_MS,
  QA_ERROR,
  QA_LIMIT,
  QA_EMPTY,
  STAFF_RULES,
  OWNER_RULES,
  qaEnabled,
  dailyLimit,
  bangkokDateKey,
  qaQuestion,
  groupQuestion,
  isOwnerDirect,
  buildChatMessages,
  stripThinking,
  extractAnswer,
  clipReply,
  consumeQuota,
  compactSales,
  fetchSalesContext,
  askMinimax,
};
