const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { buildReview } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { makeApproval, approvalMatchesReview, payloadHash, GateError } = require('../lib/approval');
const { publishApprovedBatch, createProductionDeps, publishWorkRoot, publishBundleReport, PUBLISH_FILES } = require('../lib/publish');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');
const { loadConfig } = require('../lib/config');

function money(value) { return { raw: String(value), value, state: 'observed' }; }

function reviewFrom(extraction, second) {
  const review = applyChecks(buildReview({
    batchId: 'b_test',
    images: [{
      sourceId: 'src1', sha256: 'a'.repeat(64), contentType: 'image/jpeg',
      extraction, second, secondError: null,
    }],
  }));
  assert.equal(review.review.import_allowed, false);
  return review;
}

function cleanSale() {
  const sales = {
    cash_sales: money(100),
    scan_sales: money(20),
    total_sales: money(120),
  };
  return reviewFrom({
    document_type: 'sales_report',
    header: { date_raw: '17/10/2026', branch_raw: 'B2', staff_raw: ['staff'] },
    sales,
    menu_rows: [{ item_raw: 'ส้ม', qty_raw: '3', qty_value: 3, qty_state: 'observed', uncertain: false }],
  }, { date_raw: '17/10/2026', branch_raw: 'B2', sales });
}

function countingDeps(extra = {}) {
  const calls = [];
  const deps = {
    calls,
    async prepareWorkdir() { calls.push('prepare'); return '/tmp/unused'; },
    async importSales() { calls.push('sales'); },
    async importExpenses() { calls.push('expenses'); },
    async regenerate() { calls.push('regen'); },
    async commit() { calls.push('commit'); return { sha: 'abc' }; },
    async deploy() { calls.push('deploy'); return { triggered: false }; },
    async readback() { calls.push('readback'); return { ok: true }; },
  };
  return Object.assign(deps, extra);
}

const armed = { allowDeploy: true, githubToken: 'tok', githubRepo: 'o/r', publicUrl: 'https://somsaijailive.vercel.app' };

function ownerConfig() {
  return { channelSecret: 's', groupId: 'C1', ownerUserId: 'U-owner', allowDeploy: true, githubToken: 't', githubRepo: 'o/r', publicUrl: 'https://somsaijailive.vercel.app' };
}

async function postApprove(store, deps, { at = '2026-10-17T03:00:00.000Z' } = {}) {
  const replies = [];
  const logs = [];
  const orig = console.error;
  console.error = (...args) => logs.push(args.map(part => String(part)).join(' '));
  const raw = Buffer.from(JSON.stringify({
    events: [{
      webhookEventId: `wh-${Math.random()}`,
      type: 'postback',
      timestamp: 1,
      replyToken: 'r',
      source: { type: 'user', userId: 'U-owner' },
      postback: { data: 'action=approve&batch=b_test' },
    }],
  }));
  try {
    const result = await handleWebhook({
      rawBody: raw,
      signature: signBody(raw, 's'),
      ctx: {
        config: ownerConfig(),
        store,
        deps,
        now: Date.parse(at),
        line: { async reply(_token, messages) { replies.push(messages[0].text); }, async push() {} },
      },
    });
    return { result, replies, logs };
  } finally {
    console.error = orig;
  }
}

function expandBraces(pattern) {
  const match = /^\{(.+)\}$/.exec(pattern);
  if (!match) return [pattern];
  return match[1].split(',');
}

function globMatch(pattern, file) {
  const re = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE::/g, '.*');
  return new RegExp(`^${re}$`).test(file);
}

test('approvalMatchesReview is true only while both hashes still match', () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-16T00:00:00.000Z' });
  assert.equal(approvalMatchesReview(approval, review), true);
  const rewritten = JSON.parse(JSON.stringify(review));
  rewritten.records[0].date.value = '17/10/2026';
  rewritten.records[0].date.raw = '17/10/26';
  if (rewritten.records[0].date.value === review.records[0].date.value) {
    rewritten.records[0].date.value = '18/10/2026';
  }
  assert.equal(approvalMatchesReview(approval, rewritten), false);
  const otherPhoto = JSON.parse(JSON.stringify(review));
  otherPhoto.sources[0].sha256 = 'c'.repeat(64);
  assert.equal(approvalMatchesReview(approval, otherPhoto), false);
  assert.equal(payloadHash(review) === payloadHash(rewritten), false);
});

test('a stale saved approval is replaced from this tap and then published', async () => {
  const store = new MemoryStore();
  const review = cleanSale();
  const stale = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-16T00:00:00.000Z' });
  review.records[0].date.value = '18/10/2026';
  review.records[0].date.raw = '18/10/26';
  assert.equal(approvalMatchesReview(stale, review), false);
  await store.putJson('review:b_test', review);
  await store.putJson('batch:b_test', { batch_id: 'b_test', status: 'approved', approval: stale });
  const deps = countingDeps();
  const { result, replies, logs } = await postApprove(store, deps);
  assert.equal(result.outcomes[0].status, 'published');
  assert.deepEqual(deps.calls, ['prepare', 'sales', 'regen', 'commit', 'deploy', 'readback']);
  const batch = await store.getJson('batch:b_test');
  assert.equal(batch.status, 'published');
  assert.equal(batch.approval.approved_at, '2026-10-17T03:00:00.000Z');
  assert.equal(approvalMatchesReview(batch.approval, review), true);
  assert.notEqual(batch.approval.payload_hash, stale.payload_hash);
  assert.match(replies[0], /อนุมัติแล้ว/);
  assert.equal(replies.some(text => text.startsWith('ทำไม่สำเร็จ')), false);
  assert.ok(logs.some(line => line.includes('stale approval regenerated')));
});

test('a saved approval is reused when its hashes still match the review', async () => {
  const store = new MemoryStore();
  const review = cleanSale();
  const saved = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-16T00:00:00.000Z' });
  await store.putJson('review:b_test', review);
  await store.putJson('batch:b_test', { batch_id: 'b_test', status: 'approved', approval: saved });
  const deps = countingDeps();
  const { logs } = await postApprove(store, deps);
  const batch = await store.getJson('batch:b_test');
  assert.equal(batch.approval.approved_at, '2026-10-16T00:00:00.000Z');
  assert.equal(batch.approval.payload_hash, saved.payload_hash);
  assert.equal(logs.some(line => line.includes('stale approval regenerated')), false);
  assert.equal(deps.calls[0], 'prepare');
});

test('a publish step error is stored, logged, and replied with the step and message', async () => {
  const store = new MemoryStore();
  const review = cleanSale();
  await store.putJson('review:b_test', review);
  await store.putJson('batch:b_test', { batch_id: 'b_test', status: 'pending_review' });
  const deps = countingDeps({
    async regenerate() {
      deps.calls.push('regen');
      throw new Error("Cannot find module 'xlsx'");
    },
  });
  const { result, replies, logs } = await postApprove(store, deps);
  assert.equal(result.outcomes[0].status, 'error');
  assert.equal(result.outcomes[0].step, 'regenerate');
  assert.deepEqual(deps.calls, ['prepare', 'sales', 'regen']);
  const batch = await store.getJson('batch:b_test');
  assert.equal(batch.status, 'approved');
  assert.equal(batch.last_result.status, 'error');
  assert.equal(batch.last_result.step, 'regenerate');
  assert.match(batch.last_result.reason, /xlsx/);
  assert.match(replies[0], /^ทำไม่สำเร็จ \(regenerate\):/);
  assert.match(replies[0], /xlsx/);
  assert.equal(replies.length, 1);
  assert.ok(logs.some(line => line.includes('[publish] regenerate:') && line.includes('xlsx')));
});

test('a gate rejection is reported as the step instead of an uncaught publish error', async () => {
  const store = new MemoryStore();
  const review = cleanSale();
  review.review.import_allowed = true;
  await store.putJson('review:b_test', review);
  await store.putJson('batch:b_test', { batch_id: 'b_test', status: 'pending_review' });
  const deps = countingDeps();
  const { result, replies, logs } = await postApprove(store, deps);
  assert.equal(result.outcomes[0].step, 'extractor_contract');
  assert.deepEqual(deps.calls, []);
  const batch = await store.getJson('batch:b_test');
  assert.equal(batch.last_result.step, 'extractor_contract');
  assert.match(replies[0], /^ทำไม่สำเร็จ \(extractor_contract\):/);
  assert.ok(logs.some(line => line.startsWith('[publish] extractor_contract:')));
  assert.equal(result.outcomes[0].error, undefined);
});

test('assertApproval still rejects a stale approval that was not regenerated', async () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-16T00:00:00.000Z' });
  review.records[0].date.value = '18/10/2026';
  const deps = countingDeps();
  await assert.rejects(
    () => publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps }),
    (err) => err instanceof GateError && err.code === 'hash_mismatch'
  );
  assert.deepEqual(deps.calls, []);
});

test('readback still runs when the bot does not call the Vercel API', async () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-17T00:00:00.000Z' });
  const deps = countingDeps();
  const result = await publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps });
  assert.equal(result.status, 'published');
  assert.equal(result.deployment.triggered, false);
  assert.equal(result.readback.ok, true);
  assert.deepEqual(deps.calls, ['prepare', 'sales', 'regen', 'commit', 'deploy', 'readback']);
});

test('LINE_BOT_VERCEL_DEPLOY defaults off and is the only switch for the API deploy', async () => {
  assert.equal(loadConfig({}).vercelApiDeploy, false);
  assert.equal(loadConfig({ LINE_BOT_VERCEL_DEPLOY: 'true' }).vercelApiDeploy, false);
  assert.equal(loadConfig({ LINE_BOT_VERCEL_DEPLOY: '1' }).vercelApiDeploy, true);

  const fetches = [];
  const off = createProductionDeps({
    vercelApiDeploy: false,
    vercelToken: 'tok',
    vercelProjectId: 'prj',
    githubRepo: 'org/repo',
    githubBranch: 'main',
  }, {
    fetchImpl: async () => { fetches.push('off'); return { ok: true, json: async () => ({}) }; },
  });
  const skipped = await off.deploy({ sha: 'abc' });
  assert.equal(skipped.triggered, false);
  assert.match(skipped.reason, /Git integration/);
  assert.deepEqual(fetches, []);

  const on = createProductionDeps({
    vercelApiDeploy: true,
    vercelToken: 'tok',
    vercelProjectId: 'prj',
    vercelScope: 'parn',
    githubRepo: 'org/repo',
    githubBranch: 'main',
  }, {
    fetchImpl: async (url) => {
      fetches.push(String(url));
      return { ok: true, json: async () => ({ id: 'dpl_1', url: 'example.vercel.app' }) };
    },
  });
  const triggered = await on.deploy({ sha: 'abc' });
  assert.equal(triggered.triggered, true);
  assert.equal(triggered.id, 'dpl_1');
  assert.equal(fetches.length, 1);
  assert.match(fetches[0], /api\.vercel\.com\/v13\/deployments/);
});

test('publish scratch files stay under /tmp on Vercel', () => {
  const prev = process.env.VERCEL;
  process.env.VERCEL = '1';
  try {
    assert.equal(publishWorkRoot(), '/tmp');
  } finally {
    if (prev === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prev;
  }
});

test('the webhook bundle pattern includes xlsx and the import scripts', () => {
  const vercel = require('../../../vercel.json');
  const includeFiles = vercel.functions['api/webhook.js'].includeFiles;
  assert.ok(includeFiles.length <= 256);
  const patterns = expandBraces(includeFiles);
  const wanted = [
    ...PUBLISH_FILES.map(rel => `3_Automation_Dashboard/${rel}`),
    'node_modules/xlsx/package.json',
    'node_modules/xlsx/xlsx.js',
    'node_modules/xlsx/dist/cpexcel.js',
    'lib/dashboard_auth.js',
  ];
  for (const file of wanted) {
    assert.ok(patterns.some(pattern => globMatch(pattern, file)), `${file} not matched by ${includeFiles}`);
  }
});

test('a child process can load xlsx and the import scripts', () => {
  const report = publishBundleReport();
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.xlsxResolved, true);
  for (const rel of PUBLISH_FILES) assert.equal(report.files[rel], true, rel);
  assert.equal(report.sales.missing, false);
  assert.equal(report.expenses.missing, false);
  assert.equal(report.update.missing, false);
  assert.equal(report.fromTmp.missing, false);
});

test('the bundle report is only served on preview GETs', async () => {
  const webhook = require('../../api/webhook');
  const prev = process.env.VERCEL_ENV;
  const bodies = [];
  const statuses = [];
  function res() {
    return {
      status(code) { statuses.push(code); return this; },
      setHeader() { return this; },
      end(body) { bodies.push(body); return this; },
    };
  }
  try {
    process.env.VERCEL_ENV = 'production';
    await webhook({ method: 'GET', url: '/api/webhook?bundle=1', headers: {} }, res());
    assert.deepEqual(statuses, [405]);

    process.env.VERCEL_ENV = 'preview';
    await webhook({ method: 'GET', url: '/api/webhook?bundle=1', headers: {} }, res());
    assert.deepEqual(statuses, [405, 200]);
    assert.equal(bodies[0], 'POST only');
    const report = JSON.parse(bodies[1]);
    assert.equal(report.ok, true);
    assert.equal(report.files['safe_import_sales.js'], true);
    assert.equal(report.xlsxResolved, true);
  } finally {
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  }
});
