const { handleWebhook } = require('../line_bot/lib/handler');
const { verifySignature } = require('../line_bot/lib/signature');
const { loadConfig } = require('../line_bot/lib/config');
const { lineClient } = require('../line_bot/lib/line_client');
const { createStore } = require('../line_bot/lib/store');
const { extractImage } = require('../line_bot/lib/extractor');
const { createProductionDeps, publishBundleReport } = require('../line_bot/lib/publish');
const { qaEnabled } = require('../line_bot/lib/qa');

function readRaw(req) {
  if (req && Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (req && typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  // A parsed object is not the original bytes. Do not wait on a stream that already ended.
  if (req && req.body != null && typeof req.body === 'object') {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }
  if (!req || typeof req.on !== 'function' || req.readableEnded) {
    return Promise.resolve(Buffer.alloc(0));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;
    const timer = setTimeout(() => finish(null, Buffer.concat(chunks)), 10000);
    function finish(err, buf) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      if (err) reject(err);
      else resolve(buf);
    }
    function onData(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    function onEnd() { finish(null, Buffer.concat(chunks)); }
    function onError(err) { finish(err); }
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    if (typeof req.resume === 'function') req.resume();
  });
}

function wantsQueryFlag(req, name) {
  if (req && req.query && String(req.query[name]) === '1') return true;
  const raw = String(req && req.url || '');
  const q = raw.includes('?') ? raw.slice(raw.indexOf('?') + 1) : '';
  return new URLSearchParams(q).get(name) === '1';
}

function wantsBundleReport(req) {
  return wantsQueryFlag(req, 'bundle');
}

module.exports = async function webhook(req, res) {
  if (req.method !== 'POST') {
    // Preview deployments can show whether xlsx and the importers are in this
    // function. Production stays POST-only. No LINE, Gemini, git, or deploy calls.
    const preview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
    if (req.method === 'GET' && preview && wantsBundleReport(req)) {
      const report = publishBundleReport();
      res.status(report.ok ? 200 : 500);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(report));
      return;
    }
    // Preview-only. Says whether Q&A is on. Does not call MiniMax or LINE.
    if (req.method === 'GET' && preview && wantsQueryFlag(req, 'qa')) {
      const config = loadConfig();
      res.status(200);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ enabled: qaEnabled(config), model: config.minimaxModel }));
      return;
    }
    res.status(405).end('POST only');
    return;
  }
  const rawBody = await readRaw(req);
  const config = loadConfig();
  const signature = req.headers['x-line-signature'] || req.headers['X-Line-Signature'];
  if (!verifySignature(rawBody, signature, config.channelSecret)) {
    res.status(401).end('invalid signature');
    return;
  }
  let store;
  try {
    store = createStore();
  } catch (err) {
    console.error(err.message);
    res.status(500).end('photo store is not configured');
    return;
  }
  const tails = [];
  const ctx = {
    config,
    store,
    line: lineClient({ token: config.channelAccessToken }),
    extractImage,
    deps: createProductionDeps(config),
    now: Date.now(),
    scheduleBackground(job) { tails.push(Promise.resolve(job)); },
  };
  // The image-set fallback sleeps for about two minutes. It has to stay inside
  // the same waitUntil as OCR, or the function freezes before the set is read.
  const job = (async () => {
    try {
      return await handleWebhook({ rawBody, signature, ctx });
    } finally {
      if (tails.length) await Promise.all(tails);
    }
  })();
  // LINE retries a slow webhook. Answer 200 first and keep reading the photo.
  // OCR is one or two Gemini calls of about half a minute each, plus retries.
  const scheduled = scheduleBackground(job);
  if (scheduled.deferred) {
    res.status(200).end('ok');
    return;
  }
  try {
    const result = await scheduled.job;
    res.status(result.status).end(result.body || 'ok');
  } catch (err) {
    console.error(err);
    res.status(500).end('error');
  }
};

function loadVercelHooks() {
  try {
    const mod = require('@vercel/functions');
    return { waitUntil: mod.waitUntil, after: mod.after };
  } catch (e) {
    return {};
  }
}

function scheduleBackground(job, options = {}) {
  const vercel = options.vercel != null ? options.vercel : Boolean(process.env.VERCEL);
  const hooks = options.hooks || (vercel ? loadVercelHooks() : {});
  const run = [hooks.waitUntil, hooks.after].find(fn => typeof fn === 'function');
  const wrapped = Promise.resolve(job).catch(err => {
    console.error(err);
    throw err;
  });
  if (vercel && run) {
    try {
      run(wrapped.catch(err => console.error(err)));
      return { deferred: true };
    } catch (err) {
      console.error(err);
    }
  }
  return { deferred: false, job: wrapped };
}

module.exports.config = { api: { bodyParser: false }, maxDuration: 300 };
module.exports.scheduleBackground = scheduleBackground;
module.exports.readRaw = readRaw;
