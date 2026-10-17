/**
 * MiniMax Q&A for the LINE bot.
 * Replies only (never push). Fully off when MINIMAX_API_KEY is missing.
 * Sales figures are loaded only for the owner's 1:1 chat.
 */

const { ALBUM_HELP } = require('./staff_text');

const MINIMAX_URL = 'https://api.minimax.io/v1/text/chatcompletion_v2';
const DEFAULT_MODEL = 'MiniMax-M2';
const QA_DAILY_LIMIT = 30;
const QA_MAX_TOKENS = 700;
const QA_REPLY_MAX = 1000;
const QA_TIMEOUT_MS = 15000;
const SALES_FETCH_MS = 8000;
const SALES_DAYS = 14;
const QUESTION_MAX = 1500;

const QA_ERROR = 'Sorry, I could not answer just now. Please try again.';
const QA_LIMIT = 'Too many questions today. Please try again tomorrow.';
const QA_EMPTY = 'Send a short question. Report photos go in this chat one by one, not in an album.';

const STAFF_RULES = [
  'You are a helpful assistant for SomSaiJai, a cold-press juice shop with branches B1, B2, and B3.',
  'The person you are talking to is staff, not the owner. Staff are often from Myanmar and use simple English.',
  'Reply in the language they wrote in. If you are not sure, use short simple English.',
  'You may explain how to send the daily report photos, answer general questions about the shop routine, and do simple translations.',
  `Photo rule: ${ALBUM_HELP}`,
  'Never state sales numbers, revenue, cash, scan totals, costs, profit, wages, rent, or supplier prices.',
  'You do not have that data. If they ask for any figure, say only Parn can see sales numbers in a private chat, and do not guess.',
  'Never invent numbers.',
  'Keep the answer to a few short sentences.',
].join('\n');

const OWNER_RULES = [
  'You are a helpful assistant for SomSaiJai, a cold-press juice shop with branches B1, B2, and B3.',
  'The person you are talking to is the owner, Parn. They may write in Thai or English.',
  'Reply in the language they wrote in. If you are not sure, use short simple English.',
  'You may explain how to send report photos and answer general shop questions.',
  `Photo rule: ${ALBUM_HELP}`,
  'A sales note may be included in the user message. It lists only date, revenue, cash, and scan in THB for recent days.',
  'Use only figures that appear in that note. If a day or branch is missing, or the note says sales are unavailable, say you do not have that figure.',
  'Never invent numbers. Do not state costs, wages, rent, or supplier prices. Those are not in the note.',
  'Keep the answer to a few short sentences.',
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

function extractAnswer(payload) {
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
  const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
  const answer = stripThinking(messageText(choice && choice.message));
  if (!answer) {
    const error = new Error('empty minimax answer');
    error.qa = true;
    throw error;
  }
  return answer.slice(0, QA_REPLY_MAX);
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

function compactSales(data, options = {}) {
  const days = Number.isFinite(options.days) && options.days > 0 ? Math.floor(options.days) : SALES_DAYS;
  const end = bangkokStamp(options.now);
  const start = end - (days - 1) * 86400000;
  const branches = data && data.branches && typeof data.branches === 'object' ? data.branches : {};
  const lines = [
    `Recent sales, last ${days} days, THB. One line per branch per day: date, revenue, cash, scan. Missing days are not listed.`,
  ];
  for (const branch of ['B1', 'B2', 'B3']) {
    const sales = branches[branch] && branches[branch].sales;
    const rows = [];
    if (sales && typeof sales === 'object') {
      for (const month of Object.values(sales)) {
        if (!Array.isArray(month)) continue;
        for (const row of month) {
          if (!row || typeof row !== 'object') continue;
          const stamp = saleStamp(row.d);
          if (stamp == null || stamp < start || stamp > end) continue;
          rows.push({
            stamp,
            date: formatStamp(stamp),
            rev: figure(row.rev),
            cash: figure(row.cash),
            scan: figure(row.scan),
          });
        }
      }
    }
    rows.sort((a, b) => a.stamp - b.stamp);
    if (!rows.length) {
      lines.push(`${branch}: no sales in this window`);
      continue;
    }
    for (const row of rows) {
      lines.push(`${branch} ${row.date} revenue ${row.rev} cash ${row.cash} scan ${row.scan}`);
    }
  }
  return lines.join('\n').slice(0, 4000);
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
    return compactSales(data, { now, days: SALES_DAYS });
  } finally {
    clearTimeout(timer);
  }
}

async function askMinimax({ apiKey, model, messages, fetchImpl, timeoutMs, maxTokens }) {
  const fetchFn = fetchImpl || fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const ms = timeoutMs || QA_TIMEOUT_MS;
  const tokens = maxTokens || QA_MAX_TOKENS;
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
  let payload;
  try {
    payload = await res.json();
  } catch (err) {
    const error = new Error('minimax json');
    error.qa = true;
    throw error;
  }
  return extractAnswer(payload);
}

module.exports = {
  MINIMAX_URL,
  DEFAULT_MODEL,
  QA_DAILY_LIMIT,
  QA_MAX_TOKENS,
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
