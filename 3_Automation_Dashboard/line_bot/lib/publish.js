const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertApproval, GateError } = require('./approval');
const { buildChangePlan } = require('./adapter');

function resultMessage(result) {
  if (result.status === 'published') {
    const live = result.readback && result.readback.ok
      ? 'ตรวจเลขบนเว็บจริงแล้ว ตรงกับที่อนุมัติ'
      : 'commit แล้ว แต่เลขบนเว็บจริงยังไม่ตรง ยังไม่ถือว่าขึ้น dashboard';
    return `อนุมัติแล้ว และเขียนลงสมุดบัญชี\n${live}\n${result.url || 'https://somsaijailive.vercel.app'}`;
  }
  if (result.status === 'held') {
    const first = (result.plan.held[0] && result.plan.held[0].reasons[0]) || 'ไม่มีรายการที่อ่านชัด';
    return `บันทึกการอนุมัติแล้ว แต่ยังไม่เขียนอะไร เพราะ ${first}`;
  }
  if (result.status === 'approved_not_deployed') {
    return `บันทึกการอนุมัติแล้ว แต่ยังไม่เขียนสมุดและยังไม่ deploy\n${result.reason}`;
  }
  if (result.status === 'deployed_readback_failed') {
    return 'เขียนและสั่ง deploy แล้ว แต่ตัวเลขบนเว็บจริงยังไม่ตรงกับที่อนุมัติ ยังไม่ประกาศว่าขึ้น dashboard';
  }
  return `อนุมัติถูกบันทึกแล้ว แต่การเขียนไม่สำเร็จ: ${result.reason || result.status}`;
}

/**
 * Nothing in deps is called unless the owner approval matches this exact reading.
 * A second call with a stored receipt does not import or deploy again.
 */
async function publishApprovedBatch({ review, approval, ownerUserId, config, deps }) {
  if (approval && approval.publish_receipt && approval.publish_receipt.status === 'published') {
    return { ...approval.publish_receipt, duplicate: true, message: resultMessage(approval.publish_receipt) };
  }
  assertApproval({ review, approval, ownerUserId });
  const plan = buildChangePlan(review);
  const salesCount = plan.salesLists.reduce((n, list) => n + list.rows.length, 0);
  const expenseCount = plan.expenseList ? plan.expenseList.rows.length : 0;
  if (!salesCount && !expenseCount) {
    const held = { status: 'held', plan, deployed: false };
    held.message = resultMessage(held);
    return held;
  }
  if (!config || !config.allowDeploy) {
    const blocked = { status: 'approved_not_deployed', reason: 'LINE_BOT_ALLOW_DEPLOY is not 1', plan, deployed: false };
    blocked.message = resultMessage(blocked);
    return blocked;
  }
  if (!config.githubToken || !config.githubRepo) {
    const blocked = { status: 'approved_not_deployed', reason: 'GITHUB_TOKEN or GITHUB_REPO is not set', plan, deployed: false };
    blocked.message = resultMessage(blocked);
    return blocked;
  }
  const work = await deps.prepareWorkdir();
  const salesReceipts = [];
  for (const list of plan.salesLists) salesReceipts.push(await deps.importSales(work, list));
  let expenseReceipt = null;
  if (plan.expenseList) expenseReceipt = await deps.importExpenses(work, plan.expenseList);
  await deps.regenerate(work);
  const commit = await deps.commit(work, review.batch_id);
  const deployment = await deps.deploy(commit);
  const expectations = [];
  for (const list of plan.salesLists) {
    for (const row of list.rows) expectations.push({ branch: row.branch, month: list.month, date: row.date, revenue: row.revenue, cash: row.cash });
  }
  const readback = await deps.readback(expectations);
  const published = {
    status: readback.ok ? 'published' : 'deployed_readback_failed',
    plan, salesReceipts, expenseReceipt, commit, deployment, readback,
    deployed: true,
    url: (config.publicUrl || 'https://somsaijailive.vercel.app'),
  };
  published.message = resultMessage(published);
  return published;
}

function runImporter(script, changeList, dir) {
  const file = path.join(dir, 'change_list.json');
  fs.writeFileSync(file, JSON.stringify(changeList));
  const out = spawnSync(process.execPath, [script, file, '--commit'], {
    env: { ...process.env, SOMSAIJAI_DASHBOARD_DIR: dir },
    encoding: 'utf8',
  });
  if (out.status !== 0) {
    throw new GateError('import_failed', (out.stderr || out.stdout || 'safe import failed').slice(0, 500));
  }
  return out.stdout;
}

function createProductionDeps(config, opts = {}) {
  const dashboardDir = config.dashboardDir;
  const fetchImpl = opts.fetchImpl || fetch;
  const request = opts.githubRequest || ((pathname, options) => githubRequest(config, pathname, options, fetchImpl));
  return {
    async prepareWorkdir() {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssj-publish-'));
      const names = ['SomSaiJai_Dashboard_B1_2026.xlsx', 'SomSaiJai_Dashboard_B2_2026.xlsx', 'SomSaiJai_Dashboard_B3_2026.xlsx', 'SomSaiJai_Dashboard_B4_2026.xlsx'];
      for (const name of names) {
        const bytes = await downloadRepoFile(request, config, `3_Automation_Dashboard/${name}`);
        if (bytes) fs.writeFileSync(path.join(dir, name), bytes);
      }
      for (const name of ['index.html', 'stock_ledger.json', 'xlsx.full.min.js', 'chart.umd.min.js']) {
        const local = path.join(dashboardDir, name);
        if (fs.existsSync(local)) fs.copyFileSync(local, path.join(dir, name));
      }
      return dir;
    },
    importSales(dir, changeList) {
      return runImporter(path.join(dashboardDir, 'safe_import_sales.js'), changeList, dir);
    },
    importExpenses(dir, changeList) {
      return runImporter(path.join(dashboardDir, 'safe_import_expenses.js'), changeList, dir);
    },
    regenerate(dir) {
      const script = path.join(dashboardDir, 'Sales_System_Automation', 'ocr-sales-dashboard', 'scripts', 'update_dashboard.js');
      const out = spawnSync(process.execPath, [script, '--no-deploy'], {
        env: { ...process.env, SOMSAIJAI_DASHBOARD_DIR: dir },
        encoding: 'utf8',
      });
      if (out.status !== 0) throw new GateError('regenerate_failed', (out.stderr || out.stdout || 'regenerate failed').slice(0, 500));
      return out.stdout;
    },
    commit(dir, batchId) {
      return commitDashboard(request, config, dir, batchId);
    },
    deploy(commit) {
      return deployProduction(config, commit, fetchImpl);
    },
    readback(expectations) {
      return readbackLive({ publicUrl: config.publicUrl, expectations, fetchImpl, attempts: opts.readbackAttempts || 12, delayMs: opts.readbackDelayMs || 10000 });
    },
  };
}

async function githubRequest(config, pathname, options = {}, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com${pathname}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${config.githubToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'somsaijai-line-bot',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const error = new Error(`GitHub ${res.status} ${pathname}: ${(data.message || text).slice(0, 240)}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

async function downloadRepoFile(request, config, filePath) {
  const [owner, repo] = config.githubRepo.split('/');
  let meta;
  try {
    meta = await request(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(config.githubBranch)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
  if (meta.content && meta.encoding === 'base64') return Buffer.from(String(meta.content).replace(/\n/g, ''), 'base64');
  const blob = await request(`/repos/${owner}/${repo}/git/blobs/${meta.sha}`);
  return Buffer.from(blob.content, 'base64');
}

async function commitDashboard(request, config, dir, batchId) {
  const [owner, repo] = config.githubRepo.split('/');
  const ref = await request(`/repos/${owner}/${repo}/git/ref/heads/${config.githubBranch}`);
  const baseSha = ref.object.sha;
  const commit = await request(`/repos/${owner}/${repo}/git/commits/${baseSha}`);
  const files = [
    'SomSaiJai_Dashboard_B1_2026.xlsx', 'SomSaiJai_Dashboard_B2_2026.xlsx', 'SomSaiJai_Dashboard_B3_2026.xlsx',
    'data.json', 'reports_data.json', 'SomSaiJai_Dashboard.html',
  ];
  const tree = [];
  for (const name of files) {
    const full = path.join(dir, name);
    if (!fs.existsSync(full)) continue;
    const blob = await request(`/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      body: { content: fs.readFileSync(full).toString('base64'), encoding: 'base64' },
    });
    tree.push({ path: `3_Automation_Dashboard/${name}`, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const nextTree = await request(`/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: { base_tree: commit.tree.sha, tree },
  });
  const next = await request(`/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: { message: `Import approved LINE batch ${batchId}`, tree: nextTree.sha, parents: [baseSha] },
  });
  await request(`/repos/${owner}/${repo}/git/refs/heads/${config.githubBranch}`, {
    method: 'PATCH',
    body: { sha: next.sha },
  });
  return { sha: next.sha, branch: config.githubBranch };
}

async function deployProduction(config, commit, fetchImpl) {
  if (!config.vercelToken || !config.vercelProjectId) {
    return { triggered: false, reason: 'VERCEL_TOKEN or VERCEL_PROJECT_ID is not set; waiting on the GitHub integration' };
  }
  const [org, repo] = config.githubRepo.split('/');
  const url = new URL('https://api.vercel.com/v13/deployments');
  url.searchParams.set('slug', config.vercelScope || 'parn');
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.vercelToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'somsaijai',
      project: config.vercelProjectId,
      target: 'production',
      gitSource: { type: 'github', org, repo, ref: config.githubBranch, sha: commit.sha },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { triggered: false, reason: data.error && data.error.message || `Vercel ${res.status}` };
  return { triggered: true, id: data.id || data.uid || null, url: data.url || null };
}

function rowMatches(data, expected) {
  const rows = data && data.branches && data.branches[expected.branch] && data.branches[expected.branch].sales
    && data.branches[expected.branch].sales[expected.month] || [];
  return rows.some(row => String(row.d) === expected.date && Number(row.rev) === Number(expected.revenue)
    && (expected.cash == null || Number(row.cash) === Number(expected.cash)));
}

async function readbackLive({ publicUrl, expectations, fetchImpl, attempts, delayMs }) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetchImpl(`${publicUrl}/data.json?linebot=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const missing = expectations.filter(item => !rowMatches(data, item));
        if (!missing.length) return { ok: true, attempts: i + 1 };
        lastError = `missing ${missing.length}`;
      } else lastError = `HTTP ${res.status}`;
    } catch (err) { lastError = err.message; }
    if (i < attempts - 1 && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return { ok: false, error: lastError };
}

module.exports = {
  publishApprovedBatch, createProductionDeps, resultMessage, readbackLive, rowMatches, GateError,
};
