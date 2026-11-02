const { loadConfig, approversOf } = require('../line_bot/lib/config');
const { lineClient } = require('../line_bot/lib/line_client');
const { createStore } = require('../line_bot/lib/store');
const { runDailyDigest } = require('../line_bot/lib/stock');

/**
 * Vercel cron, once a day at 15:00 UTC (22:00 Bangkok). Pushes Parn one stock
 * digest when there are lists he has not seen. With CRON_SECRET set, Vercel
 * sends it as a bearer token and nothing else gets through. Without it, the
 * one-per-day marker still caps a stray call at one push.
 */
function authorized(req, env = process.env) {
  const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || '';
  if (env.CRON_SECRET) return header === `Bearer ${env.CRON_SECRET}`;
  const agent = String((req.headers && req.headers['user-agent']) || '');
  return /vercel-cron/i.test(agent);
}

module.exports = async function stockDigest(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end('GET only');
    return;
  }
  if (!authorized(req)) {
    res.status(401).end('unauthorized');
    return;
  }
  const config = loadConfig();
  try {
    const result = await runDailyDigest({
      store: createStore(),
      line: lineClient({ token: config.channelAccessToken }),
      approverUserIds: approversOf(config),
      now: Date.now(),
    });
    res.status(200);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error(`[stock-digest] ${(err && err.message) || err}`);
    res.status(500).end('error');
  }
};

module.exports.authorized = authorized;
