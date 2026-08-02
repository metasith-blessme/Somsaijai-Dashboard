// Runs the REAL renderFinance() from index.html against the REAL reports_data.json,
// with DOM/Chart stubbed, and asserts the branch-selected totals match the report.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const html = fs.readFileSync('index.html', 'utf8');
const script = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n;\n');

const captured = {};
const sandbox = {
  console,
  document: { documentElement: { setAttribute(){}, style:{} },
    getElementById: (id) => ({ set innerHTML(v) { captured[id] = v; }, get innerHTML() { return captured[id] || ''; }, className: '', style: {}, addEventListener(){}, setAttribute(){}, getAttribute(){ return null; }, appendChild(){}, getContext: () => ({}), querySelectorAll: () => [], classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } } }),
    querySelectorAll: () => [], querySelector: () => null, addEventListener: () => {}, body: { classList: { add(){}, remove(){} } }
  },
  window: { addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener(){} }) },
  Chart: function () { return { destroy(){}, update(){} }; },
  // never settles: the page's own init() calls fetch on load; we drive renderFinance directly
  fetch: () => new Promise(() => {}),
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: 'index.html' });

// DATA/REPORTS_DATA/currentBranch are `let` bindings — assign inside the context, not on the sandbox object.
sandbox.__data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
sandbox.__reports = JSON.parse(fs.readFileSync('reports_data.json', 'utf8'));
vm.runInContext('DATA = __data; REPORTS_DATA = __reports;', sandbox);
const R = sandbox.__reports;

// pull "Net Operational Profit" and "Revenue (Total)" out of the rendered table
const num = (s) => Number(String(s).replace(/[^0-9.-]/g, ''));
function render(branch, month) {
  sandbox.__b = branch; sandbox.__m = month;
  vm.runInContext('currentBranch = __b; currentMonth = __m; renderFinance([], []);', sandbox);
  const rows = captured.cfBody;
  return {
    rev: num(rows.match(/Revenue \(Total\)<\/b><\/td><td class="num">฿([\d,]+)/)[1]),
    mat: num(rows.match(/Material Costs<\/b><\/td><td class="num"[^>]*>- ฿([\d,]+)/)[1]),
    net: num(rows.match(/Net Operational Profit<\/b>\s*<\/td>\s*<td class="num"[^>]*>฿(-?[\d,]+)/)[1]),
  };
}

let checks = 0;
for (const m of ['Jan26', 'Apr26', 'Jul26', 'all']) {
  for (const b of ['B1', 'B2', 'B3']) {
    const r = R[m][b.toLowerCase()];
    if (!r || (!r.rev && !r.cogs)) continue;
    const got = render(b, m);
    assert.strictEqual(got.rev, Math.round(r.rev), `${m}/${b} revenue`);
    assert.strictEqual(got.mat, Math.round(r.cogs), `${m}/${b} material cost (must be ALLOCATED, not raw)`);
    assert.strictEqual(got.net, Math.round(r.net), `${m}/${b} net`);
    checks++;
  }
  // 'all' view must equal the sum of the branches
  const all = render('all', m);
  const brs = ['b1','b2','b3'].map(k => R[m][k]).filter(Boolean);
  assert.strictEqual(all.rev, Math.round(brs.reduce((s,x)=>s+x.rev,0)), `${m}/all revenue == sum of branches`);
  assert.strictEqual(all.net, Math.round(brs.reduce((s,x)=>s+x.net,0)), `${m}/all net == sum of branches`);
  checks++;
}
console.log(`✅ renderFinance OK — ${checks} branch/month views match reports_data.json`);
