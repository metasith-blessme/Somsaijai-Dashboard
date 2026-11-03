const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { assertApproval, GateError } = require('./approval');
const { buildChangePlan } = require('./adapter');
const { mergeLedger } = require('./stock');
const { heldWords } = require('./words');

// The importers and update_dashboard.js are spawned, so the file tracer never
// sees their require('xlsx'). This static require is what puts the package,
// including dist/cpexcel.js, into the webhook function bundle.
require('xlsx');

const PUBLISH_FILES = [
  'safe_import_sales.js',
  'safe_import_expenses.js',
  'gen_report.js',
  'sync_dashboard_html.js',
  'Sales_System_Automation/ocr-sales-dashboard/scripts/update_dashboard.js',
  'Sales_System_Automation/logic/business_rules.js',
  'Sales_System_Automation/config/audit_params.json',
];

function resultMessage(result) {
  const site = result.url || 'https://somsaijailive.vercel.app';
  if (result.status === 'published') {
    return result.readback && result.readback.ok
      ? `Booked. The dashboard shows it.\n${site}`
      : `Booked, but the dashboard does not show it yet.\n${site}`;
  }
  if (result.status === 'held') {
    const why = result.plan.held[0] ? heldWords(result.plan.held[0].reasons, {}).join('; ') : '';
    return `Approved, but nothing booked: ${why || 'nothing was read clearly'}.`.slice(0, 400);
  }
  if (result.status === 'approved_not_deployed') return `Approved, but not saved or published yet.\n${result.reason}`.slice(0, 400);
  if (result.status === 'deployed_readback_failed') return 'Saved and published, but the dashboard does not match yet.';
  if (result.status === 'error') {
    return `Could not book (${result.step || 'publish'}): ${result.reason || result.status}`.slice(0, 400);
  }
  return `Approved, but saving failed: ${result.reason || result.status}`.slice(0, 400);
}

function stepReason(err) {
  return (err && err.message ? err.message : String(err)).replace(/\s+/g, ' ').trim().slice(0, 300);
}

async function runStep(step, fn) {
  try {
    return await fn();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    error.step = step;
    throw error;
  }
}

/**
 * Approved stock rows go into stock_ledger.json on main. Pushing main starts
 * the Vercel deploy. The same rows merged twice give the same file.
 */
async function publishStock({ rows, digestId, config, deps }) {
  if (!rows.length) return { status: 'held', reason: 'no counted rows' };
  if (!config || !config.allowDeploy) return { status: 'approved_not_deployed', reason: 'LINE_BOT_ALLOW_DEPLOY is not 1' };
  if (!config.githubToken || !config.githubRepo) return { status: 'approved_not_deployed', reason: 'GITHUB_TOKEN or GITHUB_REPO is not set' };
  try {
    const commit = await runStep('commit_stock', () => deps.commitStock(rows, digestId));
    return { status: 'published', commit: commit.sha, url: config.publicUrl || 'https://somsaijailive.vercel.app' };
  } catch (err) {
    return { status: 'error', step: err.step || 'commit_stock', reason: stepReason(err) };
  }
}

/**
 * Nothing in deps is called unless the owner approval matches this exact reading.
 * A second call with a stored receipt does not import or deploy again.
 */
async function publishApprovedBatch({ review, approval, approverUserIds, config, deps }) {
  if (approval && approval.publish_receipt && approval.publish_receipt.status === 'published') {
    return { ...approval.publish_receipt, duplicate: true, message: resultMessage(approval.publish_receipt) };
  }
  assertApproval({ review, approval, approverUserIds });
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
  const expectations = [];
  for (const list of plan.salesLists) {
    for (const row of list.rows) expectations.push({ branch: row.branch, month: list.month, date: row.date, revenue: row.revenue, cash: row.cash });
  }
  try {
    const work = await runStep('prepare', () => deps.prepareWorkdir());
    const salesReceipts = [];
    for (const list of plan.salesLists) salesReceipts.push(await runStep('import_sales', () => deps.importSales(work, list)));
    let expenseReceipt = null;
    if (plan.expenseList) expenseReceipt = await runStep('import_expenses', () => deps.importExpenses(work, plan.expenseList));
    await runStep('regenerate', () => deps.regenerate(work));
    const commit = await runStep('commit', () => deps.commit(work, review.batch_id));
    const deployment = await runStep('deploy', () => deps.deploy(commit));
    let readback;
    try {
      readback = await deps.readback(expectations);
    } catch (err) {
      const reason = stepReason(err);
      console.error(`[publish] readback: ${reason}`);
      const failed = {
        status: 'deployed_readback_failed', step: 'readback', reason,
        plan, salesReceipts, expenseReceipt, commit, deployment,
        deployed: true,
        url: (config.publicUrl || 'https://somsaijailive.vercel.app'),
      };
      failed.message = resultMessage(failed);
      return failed;
    }
    const published = {
      status: readback.ok ? 'published' : 'deployed_readback_failed',
      plan, salesReceipts, expenseReceipt, commit, deployment, readback,
      deployed: true,
      url: (config.publicUrl || 'https://somsaijailive.vercel.app'),
    };
    if (!readback.ok) {
      published.step = 'readback';
      published.reason = readback.error || 'live numbers did not match';
    }
    published.message = resultMessage(published);
    return published;
  } catch (err) {
    const step = err.step || 'publish';
    const reason = stepReason(err);
    console.error(`[publish] ${step}: ${reason}`);
    const failed = { status: 'error', step, reason, plan, deployed: false };
    failed.message = resultMessage(failed);
    return failed;
  }
}

function publishWorkRoot() {
  // Vercel functions can write only under /tmp. os.tmpdir() is /tmp there too;
  // pin it so a TMPDIR override cannot point the books at the read-only bundle.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return '/tmp';
  return os.tmpdir() || '/tmp';
}

function assertWritableWorkDir(dir) {
  const root = path.resolve(publishWorkRoot());
  const resolved = path.resolve(dir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new GateError('workdir', `refusing to write outside ${root}`);
  }
}

function xlsxNodePath() {
  try {
    return path.dirname(path.dirname(require.resolve('xlsx/package.json')));
  } catch (err) {
    return '';
  }
}

function importerEnv(dir, extra) {
  assertWritableWorkDir(dir);
  const nodePath = [xlsxNodePath(), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  return {
    ...process.env,
    ...extra,
    SOMSAIJAI_DASHBOARD_DIR: dir,
    ...(nodePath ? { NODE_PATH: nodePath } : {}),
  };
}

function runImporter(script, changeList, dir) {
  assertWritableWorkDir(dir);
  const file = path.join(dir, 'change_list.json');
  fs.writeFileSync(file, JSON.stringify(changeList));
  const out = spawnSync(process.execPath, [script, file, '--commit'], {
    cwd: dir,
    env: importerEnv(dir),
    encoding: 'utf8',
  });
  if (out.status !== 0) {
    const detail = (out.stderr || out.stdout || (out.error && out.error.message) || 'safe import failed').replace(/\s+/g, ' ').trim();
    throw new GateError('import_failed', detail.slice(0, 500));
  }
  return out.stdout;
}

function createProductionDeps(config, opts = {}) {
  const dashboardDir = config.dashboardDir;
  const fetchImpl = opts.fetchImpl || fetch;
  const request = opts.githubRequest || ((pathname, options) => githubRequest(config, pathname, options, fetchImpl));
  return {
    async prepareWorkdir() {
      const dir = fs.mkdtempSync(path.join(publishWorkRoot(), 'ssj-publish-'));
      const names = ['SomSaiJai_Dashboard_B1_2026.xlsx', 'SomSaiJai_Dashboard_B2_2026.xlsx', 'SomSaiJai_Dashboard_B3_2026.xlsx', 'SomSaiJai_Dashboard_B4_2026.xlsx'];
      for (const name of names) {
        const bytes = await downloadRepoFile(request, config, `3_Automation_Dashboard/${name}`);
        if (bytes) fs.writeFileSync(path.join(dir, name), bytes);
      }
      for (const name of ['index.html', 'stock_ledger.json', 'xlsx.full.min.js', 'chart.umd.min.js']) {
        const local = path.join(dashboardDir, name);
        if (fs.existsSync(local)) fs.copyFileSync(local, path.join(dir, name));
      }
      const params = path.join(dashboardDir, 'Sales_System_Automation', 'config', 'audit_params.json');
      if (fs.existsSync(params)) {
        const destDir = path.join(dir, 'Sales_System_Automation', 'config');
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(params, path.join(destDir, 'audit_params.json'));
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
      assertWritableWorkDir(dir);
      const script = path.join(dashboardDir, 'Sales_System_Automation', 'ocr-sales-dashboard', 'scripts', 'update_dashboard.js');
      const out = spawnSync(process.execPath, [script, '--no-deploy'], {
        cwd: dir,
        env: importerEnv(dir),
        encoding: 'utf8',
      });
      if (out.status !== 0) {
        const detail = (out.stderr || out.stdout || (out.error && out.error.message) || 'regenerate failed').replace(/\s+/g, ' ').trim();
        throw new GateError('regenerate_failed', detail.slice(0, 500));
      }
      return out.stdout;
    },
    commit(dir, batchId) {
      return commitFiles(request, config, dir, DASHBOARD_FILES, `Import approved LINE batch ${batchId}`);
    },
    async commitStock(rows, digestId) {
      const current = await downloadRepoFile(request, config, '3_Automation_Dashboard/stock_ledger.json');
      const ledger = mergeLedger(current ? JSON.parse(current.toString('utf8')) : {}, rows);
      const dir = fs.mkdtempSync(path.join(publishWorkRoot(), 'ssj-stock-'));
      fs.writeFileSync(path.join(dir, 'stock_ledger.json'), `${JSON.stringify(ledger, null, 2)}\n`);
      return commitFiles(request, config, dir, ['stock_ledger.json'], `Import approved LINE stock ${digestId}`);
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

const DASHBOARD_FILES = [
  'SomSaiJai_Dashboard_B1_2026.xlsx', 'SomSaiJai_Dashboard_B2_2026.xlsx', 'SomSaiJai_Dashboard_B3_2026.xlsx',
  'SomSaiJai_Dashboard_B4_2026.xlsx', 'data.json', 'reports_data.json', 'SomSaiJai_Dashboard.html',
];

async function commitFiles(request, config, dir, files, message) {
  const [owner, repo] = config.githubRepo.split('/');
  const ref = await request(`/repos/${owner}/${repo}/git/ref/heads/${config.githubBranch}`);
  const baseSha = ref.object.sha;
  const commit = await request(`/repos/${owner}/${repo}/git/commits/${baseSha}`);
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
    body: { message, tree: nextTree.sha, parents: [baseSha] },
  });
  await request(`/repos/${owner}/${repo}/git/refs/heads/${config.githubBranch}`, {
    method: 'PATCH',
    body: { sha: next.sha },
  });
  return { sha: next.sha, branch: config.githubBranch };
}

async function deployProduction(config, commit, fetchImpl) {
  // The git push to main starts Vercel's Git deploy. A second API deploy races it.
  if (!config || !config.vercelApiDeploy) {
    return { triggered: false, reason: 'Git push deploys via the Vercel Git integration; API deploy is off' };
  }
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

function spawnChecked(script, work, args, extra) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: work,
    env: importerEnv(work, extra),
    encoding: 'utf8',
    timeout: 20000,
  });
}

function childSummary(result) {
  const stderr = String(result && result.stderr || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const stdout = String(result && result.stdout || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const missing = /Cannot find module|MODULE_NOT_FOUND/.test(`${stderr}\n${stdout}`) || Boolean(result && result.error);
  return { status: result ? result.status : null, missing, stderr, stdout };
}

/**
 * Preview-only check that the webhook bundle can load xlsx the way the
 * importers do. Writes nothing into the books. Scratch files stay under /tmp
 * on Vercel. Does not call LINE, Gemini, GitHub, or the Vercel deploy API.
 */
function publishBundleReport(opts = {}) {
  const dashboardDir = opts.dashboardDir || path.join(__dirname, '..', '..');
  const files = {};
  for (const rel of PUBLISH_FILES) files[rel] = fs.existsSync(path.join(dashboardDir, rel));
  let xlsxResolved = false;
  let xlsxError = null;
  try {
    const resolved = require.resolve('xlsx');
    xlsxResolved = resolved.includes(`${path.sep}node_modules${path.sep}xlsx${path.sep}`);
  } catch (err) {
    xlsxError = err.message;
  }
  const work = fs.mkdtempSync(path.join(publishWorkRoot(), 'ssj-bundle-'));
  try {
    const probe = path.join(work, 'resolve_xlsx.js');
    fs.writeFileSync(probe, 'process.stdout.write(require.resolve("xlsx"));\n');
    const fromTmp = childSummary(spawnChecked(probe, work, []));
    const salesScript = path.join(dashboardDir, 'safe_import_sales.js');
    const expenseScript = path.join(dashboardDir, 'safe_import_expenses.js');
    const updateScript = path.join(dashboardDir, 'Sales_System_Automation', 'ocr-sales-dashboard', 'scripts', 'update_dashboard.js');
    const missingList = path.join(work, 'no-such-change-list.json');
    const sales = fs.existsSync(salesScript) ? childSummary(spawnChecked(salesScript, work, [missingList])) : { status: null, missing: true, stderr: 'script missing', stdout: '' };
    const expenses = fs.existsSync(expenseScript) ? childSummary(spawnChecked(expenseScript, work, [missingList])) : { status: null, missing: true, stderr: 'script missing', stdout: '' };
    const update = fs.existsSync(updateScript)
      ? childSummary(spawnChecked(updateScript, work, [], { SSJ_BUNDLE_CHECK: '1' }))
      : { status: null, missing: true, stderr: 'script missing', stdout: '' };
    const scriptsPresent = Object.values(files).every(Boolean);
    const tmpChildLoaded = fromTmp.status === 0 && !fromTmp.missing && fromTmp.stdout.includes(`${path.sep}node_modules${path.sep}xlsx${path.sep}`);
    const importersLoaded = sales.status === 1 && !sales.missing && expenses.status === 1 && !expenses.missing;
    const updateLoaded = update.status === 0 && !update.missing && update.stdout.includes('xlsx');
    return {
      ok: xlsxResolved && scriptsPresent && tmpChildLoaded && importersLoaded && updateLoaded,
      xlsxResolved,
      xlsxError,
      workRoot: publishWorkRoot(),
      files,
      fromTmp,
      sales,
      expenses,
      update,
    };
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

module.exports = {
  publishApprovedBatch, publishStock, createProductionDeps, resultMessage, readbackLive, rowMatches, GateError,
  publishWorkRoot, publishBundleReport, PUBLISH_FILES,
};
