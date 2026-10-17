const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReview } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { buildChangePlan } = require('../lib/adapter');
const { makeApproval, GateError } = require('../lib/approval');
const { publishApprovedBatch } = require('../lib/publish');
const { handleWebhook } = require('../lib/handler');
const { signBody } = require('../lib/signature');
const { MemoryStore } = require('../lib/store');

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

function countingDeps() {
  const calls = [];
  return {
    calls,
    async prepareWorkdir() { calls.push('prepare'); return '/tmp/unused'; },
    async importSales() { calls.push('sales'); },
    async importExpenses() { calls.push('expenses'); },
    async regenerate() { calls.push('regen'); },
    async commit() { calls.push('commit'); return { sha: 'abc' }; },
    async deploy() { calls.push('deploy'); },
    async readback() { calls.push('readback'); return { ok: true }; },
  };
}

const armed = { allowDeploy: true, githubToken: 'tok', githubRepo: 'o/r', publicUrl: 'https://somsaijailive.vercel.app' };

test('extractor output cannot import itself, and a missing approval calls nothing', async () => {
  const review = cleanSale();
  const deps = countingDeps();
  await assert.rejects(
    () => publishApprovedBatch({ review, approval: null, ownerUserId: 'U-owner', config: armed, deps }),
    (err) => err instanceof GateError && err.code === 'not_approved'
  );
  assert.deepEqual(deps.calls, []);
});

test('flipping import_allowed does not authorize a write', async () => {
  const review = cleanSale();
  review.review.import_allowed = true;
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-17T00:00:00Z' });
  const deps = countingDeps();
  await assert.rejects(
    () => publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps }),
    (err) => err.code === 'extractor_contract'
  );
  assert.deepEqual(deps.calls, []);
});

test('an approval whose reading no longer matches does not import or deploy', async () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-17T00:00:00Z' });
  review.records[0].financials.total_sales.value = 999;
  const deps = countingDeps();
  await assert.rejects(
    () => publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps }),
    (err) => err.code === 'hash_mismatch'
  );
  assert.deepEqual(deps.calls, []);
});

test('the owner approval is what allows import and deploy, and a second run does not repeat it', async () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-17T00:00:00Z' });
  const deps = countingDeps();
  const first = await publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps });
  assert.equal(first.status, 'published');
  assert.deepEqual(deps.calls, ['prepare', 'sales', 'regen', 'commit', 'deploy', 'readback']);

  approval.publish_receipt = first;
  const again = await publishApprovedBatch({ review, approval, ownerUserId: 'U-owner', config: armed, deps });
  assert.equal(again.duplicate, true);
  assert.equal(deps.calls.length, 6);
});

test('approval is stored but nothing is deployed when the switch is off', async () => {
  const review = cleanSale();
  const approval = makeApproval({ review, userId: 'U-owner', decision: 'approve', at: '2026-10-17T00:00:00Z' });
  const deps = countingDeps();
  const result = await publishApprovedBatch({
    review, approval, ownerUserId: 'U-owner', config: { ...armed, allowDeploy: false }, deps,
  });
  assert.equal(result.status, 'approved_not_deployed');
  assert.deepEqual(deps.calls, []);
});

test('only the owner userId can approve from LINE', async () => {
  const store = new MemoryStore();
  const review = cleanSale();
  await store.putJson('review:b_test', review);
  await store.putJson('batch:b_test', { batch_id: 'b_test', status: 'pending_review' });
  const deps = countingDeps();
  const config = { channelSecret: 's', groupId: 'C1', ownerUserId: 'U-owner', allowDeploy: true, githubToken: 't', githubRepo: 'o/r' };
  const raw = Buffer.from(JSON.stringify({
    events: [{
      webhookEventId: 'wh-approve',
      type: 'postback',
      timestamp: 1,
      replyToken: 'r',
      source: { type: 'user', userId: 'U-someone-else' },
      postback: { data: 'action=approve&batch=b_test' },
    }],
  }));
  const result = await handleWebhook({
    rawBody: raw,
    signature: signBody(raw, 's'),
    ctx: { config, store, deps, now: Date.now(), line: { async reply() {}, async push() {} } },
  });
  assert.equal(result.status, 200);
  assert.equal(result.outcomes[0].denied, true);
  assert.deepEqual(deps.calls, []);
  const batch = await store.getJson('batch:b_test');
  assert.equal(batch.status, 'pending_review');
});

test('scan is not invented from revenue minus cash, and a blank is not zero', () => {
  const review = reviewFrom({
    document_type: 'sales_report',
    header: { date_raw: '17/10/2026', branch_raw: 'B1' },
    sales: {
      cash_sales: money(80),
      scan_sales: { raw: null, value: null, state: 'missing' },
      total_sales: money(80),
    },
    menu_rows: [{ item_raw: 'ส้ม', qty_raw: null, qty_value: null, qty_state: 'missing' }],
  }, {
    date_raw: '17/10/2026', branch_raw: 'B1',
    sales: {
      cash_sales: money(80),
      scan_sales: { raw: null, value: null, state: 'missing' },
      total_sales: money(80),
    },
  });
  const plan = buildChangePlan(review);
  assert.equal(plan.salesLists.length, 1);
  const row = plan.salesLists[0].rows[0];
  assert.equal(row.revenue, 80);
  assert.equal(row.cash, 80);
  assert.equal('scan' in row, false);
  assert.equal(row.or, undefined);

  const zero = reviewFrom({
    document_type: 'sales_report',
    header: { date_raw: '17/10/2026', branch_raw: 'B3' },
    sales: { cash_sales: money(0), scan_sales: money(50), total_sales: money(50) },
    menu_rows: [],
  }, {
    date_raw: '17/10/2026', branch_raw: 'B3',
    sales: { cash_sales: money(0), scan_sales: money(50), total_sales: money(50) },
  });
  const zeroRow = buildChangePlan(zero).salesLists[0].rows[0];
  assert.equal(zeroRow.cash, 0);
});

test('two sales photos for the same branch and date are both held', () => {
  const one = cleanSale();
  const other = cleanSale();
  other.records[0].record_id = 'src2';
  other.sources.push({ ...one.sources[0], source_id: 'src2', sha256: 'b'.repeat(64) });
  one.records.push(other.records[0]);
  one.sources.push(other.sources[1]);
  const plan = buildChangePlan(one);
  assert.equal(plan.salesLists.length, 0);
  assert.equal(plan.held.length, 2);
});

test('an illegible total and a January row are held', () => {
  const illegible = reviewFrom({
    document_type: 'sales_report',
    header: { date_raw: '17/10/2026', branch_raw: 'B2' },
    sales: {
      cash_sales: money(10),
      scan_sales: money(10),
      total_sales: { raw: '1?', value: null, state: 'illegible' },
    },
    menu_rows: [],
  }, {
    date_raw: '17/10/2026', branch_raw: 'B2',
    sales: {
      cash_sales: money(10),
      scan_sales: money(10),
      total_sales: { raw: null, value: null, state: 'illegible' },
    },
  });
  const held = buildChangePlan(illegible);
  assert.equal(held.salesLists.length, 0);
  assert.ok(held.held.length > 0);

  const january = reviewFrom({
    document_type: 'sales_report',
    header: { date_raw: '15/01/2026', branch_raw: 'B1' },
    sales: { cash_sales: money(10), scan_sales: money(0), total_sales: money(10) },
    menu_rows: [],
  }, {
    date_raw: '15/01/2026', branch_raw: 'B1',
    sales: { cash_sales: money(10), scan_sales: money(0), total_sales: money(10) },
  });
  const q1 = buildChangePlan(january);
  assert.equal(q1.salesLists.length, 0);
  assert.match(q1.held[0].reasons.join(' '), /January/);
});
