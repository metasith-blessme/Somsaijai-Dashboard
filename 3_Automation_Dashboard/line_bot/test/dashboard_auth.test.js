const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  AUTH_REQUIRED,
  NOT_CONFIGURED,
  MATCHER,
  authorize,
  dashboardFetchHeaders,
  matcherRuns,
  safeEqual,
} = require('../../../lib/dashboard_auth');
const { loadConfig } = require('../lib/config');
const { readbackLive, createProductionDeps } = require('../lib/publish');
const { fetchSalesContext } = require('../lib/qa');

const PASSWORD_ENV = {
  VERCEL_ENV: 'production',
  DASHBOARD_USER: 'somsaijai',
  DASHBOARD_PASSWORD: 'correct horse',
  DASHBOARD_INTERNAL_TOKEN: 'internal-token-value',
};

function basic(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

function decide(pathname, extra = {}, env = PASSWORD_ENV) {
  return authorize({
    pathname,
    authorization: extra.authorization,
    internalToken: extra.internalToken,
    env,
  });
}

test('middleware runs on every path and the source uses that matcher', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../../middleware.js'), 'utf8');
  assert.match(source, /matcher:\s*\['\/\(\.\*\)'\]/);
  assert.equal(MATCHER, '/(.*)');
  assert.match(source, /from '\.\/lib\/dashboard_auth\.js'/);
  assert.match(source, /runtime:\s*'nodejs'/);
  for (const pathname of [
    '/',
    '/data.json',
    '/reports_data.json',
    '/stock_ledger.json',
    '/SomSaiJai_Dashboard.html',
    '/index.html',
    '/SomSaiJai_Dashboard_B1_2026.xlsx',
    '/3_Automation_Dashboard/data.json',
    '/3_Automation_Dashboard/line_bot/lib/publish.js',
    '/api/webhook',
    '/api/review',
    '/_vercel/insights',
    '/favicon.ico',
  ]) {
    assert.equal(matcherRuns(pathname), true, pathname);
  }
});

test('webhook, review, and Vercel internals are open and do not ask for a password', () => {
  for (const pathname of [
    '/api/webhook',
    '/api/webhook/',
    '/api/review',
    '/api/review/',
    '/_vercel/insights',
    '/_vercel',
    '/_next/static/chunk.js',
    '/api/webhook/../webhook',
  ]) {
    const decision = decide(pathname);
    assert.equal(decision.allow, true, pathname);
    assert.equal(decision.headers, undefined, pathname);
  }
});

test('a near-miss of the open paths is still protected', () => {
  for (const pathname of ['/api/reviewer', '/api/webhook-backup', '/api/data.json', '/_vercelish', '/line_bot_public']) {
    const decision = decide(pathname);
    assert.equal(decision.allow, false, pathname);
    assert.equal(decision.status, 401, pathname);
  }
});

test('line_bot paths stay 404 with or without the password', () => {
  for (const pathname of [
    '/line_bot',
    '/line_bot/',
    '/line_bot/lib/publish.js',
    '/LINE_BOT/SETUP.md',
    '/3_Automation_Dashboard/line_bot',
    '/3_Automation_Dashboard/line_bot/lib/config.js',
  ]) {
    const bare = decide(pathname, {}, { VERCEL_ENV: 'production', DASHBOARD_PASSWORD: 'x' });
    const authed = decide(pathname, { authorization: basic('somsaijai', 'x') }, { VERCEL_ENV: 'production', DASHBOARD_PASSWORD: 'x' });
    assert.equal(bare.status, 404, pathname);
    assert.equal(bare.body, 'Not Found', pathname);
    assert.equal(bare.headers['www-authenticate'], undefined, pathname);
    assert.equal(authed.status, 404, pathname);
  }
});

test('protected paths reject a missing or wrong password and accept the right one', () => {
  const paths = [
    '/',
    '/data.json',
    '/reports_data.json',
    '/SomSaiJai_Dashboard.html',
    '/stock_ledger.json',
    '/SomSaiJai_Dashboard_B2_2026.xlsx',
    '/3_Automation_Dashboard/index.html',
    '//data.json',
    '/line_bot/../data.json',
  ];
  for (const pathname of paths) {
    const missing = decide(pathname);
    assert.equal(missing.status, 401, pathname);
    assert.equal(missing.body, AUTH_REQUIRED, pathname);
    assert.match(missing.headers['www-authenticate'], /^Basic /);
    assert.equal(missing.headers['cache-control'], 'no-store');

    const wrong = decide(pathname, { authorization: basic('somsaijai', 'nope') });
    assert.equal(wrong.status, 401, pathname);

    const wrongUser = decide(pathname, { authorization: basic('other', 'correct horse') });
    assert.equal(wrongUser.status, 401, pathname);

    const right = decide(pathname, { authorization: basic('somsaijai', 'correct horse') });
    assert.equal(right.allow, true, pathname);
  }
});

test('the default user is somsaijai and Basic auth is case-insensitive on the scheme only', () => {
  const env = { VERCEL_ENV: 'preview', DASHBOARD_PASSWORD: 'pw' };
  assert.equal(decide('/data.json', {}, env).status, 401);
  assert.equal(decide('/data.json', { authorization: basic('somsaijai', 'pw') }, env).allow, true);
  assert.equal(decide('/data.json', { authorization: basic('Somsaijai', 'pw') }, env).status, 401);
  const header = `bAsIc ${Buffer.from('somsaijai:pw').toString('base64')}`;
  assert.equal(decide('/', { authorization: header }, env).allow, true);
});

test('a colon inside the password is part of the password', () => {
  const env = { VERCEL_ENV: 'preview', DASHBOARD_USER: 'somsaijai', DASHBOARD_PASSWORD: 'a:b' };
  assert.equal(decide('/data.json', { authorization: basic('somsaijai', 'a:b') }, env).allow, true);
  assert.equal(decide('/data.json', { authorization: basic('somsaijai', 'a') }, env).status, 401);
  assert.equal(decide('/data.json', { authorization: basic('somsaijai', 'ab') }, env).status, 401);
});

test('production without a password fails closed, including a correct internal token', () => {
  const env = { VERCEL_ENV: 'production', DASHBOARD_INTERNAL_TOKEN: 'tok', DASHBOARD_AUTH_DISABLED: '1' };
  const decision = decide('/data.json', { internalToken: 'tok', authorization: basic('somsaijai', 'tok') }, env);
  assert.equal(decision.status, 503);
  assert.equal(decision.body, NOT_CONFIGURED);
  assert.equal(decision.headers['www-authenticate'], undefined);
  assert.equal(decide('/api/webhook', {}, env).allow, true);
  assert.equal(decide('/api/review', {}, env).allow, true);
  assert.equal(decide('/line_bot/lib/x.js', {}, env).status, 404);
});

test('preview without a password is closed unless the disable flag is exactly 1', () => {
  const preview = { VERCEL_ENV: 'preview' };
  assert.equal(decide('/', {}, preview).status, 401);
  assert.equal(decide('/data.json', {}, preview).status, 401);
  assert.equal(decide('/reports_data.json', {}, { VERCEL_ENV: 'development' }).status, 401);
  assert.equal(decide('/', {}, {}).status, 401);

  for (const flag of ['true', 'yes', 'TRUE', '0', '']) {
    assert.equal(decide('/', {}, { VERCEL_ENV: 'preview', DASHBOARD_AUTH_DISABLED: flag }).status, 401, flag);
  }
  assert.equal(decide('/', {}, { VERCEL_ENV: 'preview', DASHBOARD_AUTH_DISABLED: '1' }).allow, true);
  assert.equal(decide('/data.json', {}, { VERCEL_ENV: 'development', DASHBOARD_AUTH_DISABLED: '1' }).allow, true);

  const production = { VERCEL_ENV: 'production', DASHBOARD_PASSWORD: 'pw', DASHBOARD_AUTH_DISABLED: '1' };
  assert.equal(decide('/', {}, production).status, 401);
  assert.equal(decide('/', { authorization: basic('somsaijai', 'pw') }, production).allow, true);
});

test('the internal token opens protected paths and a wrong token does not', () => {
  const env = { VERCEL_ENV: 'preview', DASHBOARD_PASSWORD: 'pw', DASHBOARD_INTERNAL_TOKEN: 'tok' };
  assert.equal(decide('/data.json', { internalToken: 'tok' }, env).allow, true);
  assert.equal(decide('/data.json', { internalToken: 'nope', authorization: basic('somsaijai', 'pw') }, env).allow, true);
  assert.equal(decide('/reports_data.json', { internalToken: 'tok-extra' }, env).status, 401);
  assert.equal(decide('/', { internalToken: 'to' }, env).status, 401);
  assert.equal(decide('/data.json', { internalToken: 'tok' }, { VERCEL_ENV: 'preview' }).status, 401);
});

test('safeEqual does not throw when the lengths differ', () => {
  assert.equal(safeEqual('a', 'a'), true);
  assert.equal(safeEqual('a', 'b'), false);
  assert.equal(safeEqual('short', 'much-longer-secret'), false);
  assert.equal(safeEqual('', 'x'), false);
});

test('loadConfig exposes the dashboard secrets without inventing a password', () => {
  const empty = loadConfig({});
  assert.equal(empty.dashboardUser, 'somsaijai');
  assert.equal(empty.dashboardPassword, '');
  assert.equal(empty.dashboardInternalToken, '');
  const set = loadConfig({
    DASHBOARD_USER: 'owner',
    DASHBOARD_PASSWORD: 'pw',
    DASHBOARD_INTERNAL_TOKEN: 'tok',
  });
  assert.equal(set.dashboardUser, 'owner');
  assert.equal(set.dashboardPassword, 'pw');
  assert.equal(set.dashboardInternalToken, 'tok');
});

test('server fetches prefer the internal token and otherwise send Basic auth', () => {
  assert.deepEqual(dashboardFetchHeaders({}), {});
  assert.deepEqual(
    dashboardFetchHeaders({ dashboardInternalToken: 'tok', dashboardPassword: 'pw' }),
    { 'x-dashboard-internal-token': 'tok' }
  );
  assert.deepEqual(
    dashboardFetchHeaders({ DASHBOARD_PASSWORD: 'pw' }),
    { Authorization: basic('somsaijai', 'pw') }
  );
  assert.deepEqual(
    dashboardFetchHeaders({ dashboardUser: 'owner', dashboardPassword: 'pw' }),
    { Authorization: basic('owner', 'pw') }
  );
});

test('publish readback fetches the live data.json with the internal token', async () => {
  const seen = [];
  const result = await readbackLive({
    publicUrl: 'https://somsaijailive.vercel.app',
    expectations: [{ branch: 'B1', month: 'Oct26', date: '17/10/2026', revenue: 10, cash: 4 }],
    attempts: 1,
    delayMs: 0,
    headers: dashboardFetchHeaders({ dashboardInternalToken: 'sekret', dashboardPassword: 'pw' }),
    fetchImpl: async (url, options) => {
      seen.push({ url: String(url), headers: options && options.headers, cache: options && options.cache });
      return {
        ok: true,
        async json() {
          return { branches: { B1: { sales: { Oct26: [{ d: '17/10/2026', rev: 10, cash: 4 }] } } } };
        },
      };
    },
  });
  assert.equal(result.ok, true);
  assert.match(seen[0].url, /^https:\/\/somsaijailive\.vercel\.app\/data\.json\?linebot=\d+$/);
  assert.equal(seen[0].headers['x-dashboard-internal-token'], 'sekret');
  assert.equal(seen[0].headers.Authorization, undefined);
  assert.equal(seen[0].cache, 'no-store');
});

test('production deps attach the live-read headers from config', async () => {
  const seen = [];
  const deps = createProductionDeps({
    publicUrl: 'https://somsaijailive.vercel.app',
    dashboardUser: 'somsaijai',
    dashboardPassword: 'pw',
    githubToken: 't',
    githubRepo: 'o/r',
    githubBranch: 'main',
  }, {
    readbackAttempts: 1,
    readbackDelayMs: 0,
    fetchImpl: async (url, options) => {
      seen.push({ url: String(url), headers: options && options.headers });
      return { ok: false, status: 401, async json() { return {}; } };
    },
  });
  const result = await deps.readback([]);
  assert.equal(result.ok, false);
  assert.match(seen[0].url, /^https:\/\/somsaijailive\.vercel\.app\/data\.json\?linebot=\d+$/);
  assert.equal(seen[0].headers.Authorization, basic('somsaijai', 'pw'));
  assert.equal(String(seen[0].url).includes('node_modules'), false);
  assert.equal(String(seen[0].url).startsWith('https://somsaijailive.vercel.app/'), true);
});

test('owner sales context is loaded from the live data.json with the token', async () => {
  let seen;
  await fetchSalesContext({
    publicUrl: 'https://somsaijailive.vercel.app/',
    auth: { dashboardInternalToken: 'sekret', dashboardPassword: 'pw' },
    now: Date.parse('2026-10-17T05:00:00.000Z'),
    fetchImpl: async (url, options) => {
      seen = { url: String(url), headers: options.headers };
      return { ok: true, async json() { return { branches: {} }; } };
    },
  });
  assert.equal(seen.url, 'https://somsaijailive.vercel.app/data.json');
  assert.equal(seen.headers['x-dashboard-internal-token'], 'sekret');
  assert.equal(seen.headers.Authorization, undefined);
});
