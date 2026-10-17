const { handleWebhook } = require('../line_bot/lib/handler');
const { verifySignature } = require('../line_bot/lib/signature');
const { loadConfig } = require('../line_bot/lib/config');
const { lineClient } = require('../line_bot/lib/line_client');
const { createStore } = require('../line_bot/lib/store');
const { extractImage } = require('../line_bot/lib/extractor');
const { createProductionDeps } = require('../line_bot/lib/publish');

function readRaw(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body));
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function webhook(req, res) {
  if (req.method !== 'POST') {
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
  const ctx = {
    config,
    store,
    line: lineClient({ token: config.channelAccessToken }),
    extractImage,
    deps: createProductionDeps(config),
    now: Date.now(),
  };
  const job = handleWebhook({ rawBody, signature, ctx });
  // LINE retries when the webhook is slow. Answer 200 first, then keep reading
  // the photos. Reply messages in that work use the reply token and do not
  // spend the free-plan push quota.
  let waitUntil = null;
  try { ({ waitUntil } = require('@vercel/functions')); } catch (e) { waitUntil = null; }
  if (typeof waitUntil === 'function' && process.env.VERCEL) {
    waitUntil(job.catch(err => console.error(err)));
    res.status(200).end('ok');
    return;
  }
  try {
    const result = await job;
    res.status(result.status).end(result.body || 'ok');
  } catch (err) {
    console.error(err);
    res.status(500).end('error');
  }
};

module.exports.config = { api: { bodyParser: false }, maxDuration: 300 };
