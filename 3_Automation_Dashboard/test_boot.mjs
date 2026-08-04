// Run: node test_boot.mjs
// Boots the real start() entry point against a minimal fake DOM and disk-backed
// fetch. test_smoke.mjs proves each view renders; this proves the thing the
// browser actually calls wires them together — module graph, data load, routing,
// hashchange repaint and chart mounting. The originating bug was a page that
// loaded fine and then rendered nothing, which only this level catches.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { start } from './js/app.js';

const listeners = {};
globalThis.window = {
  location: { hash: '#daily' },
  addEventListener: (key, fn) => { listeners[key] = fn; },
  Chart: function FakeChart(ctx, cfg) { this.type = cfg.type; this.destroy = () => {}; }
};

const navEls = ['daily', 'monthly', 'stock', 'log'].map((v) => ({
  getAttribute: () => v,
  classList: { toggle: () => {} }
}));

globalThis.document = {
  querySelectorAll: () => navEls,
  getElementById: (id) => (/^chart/.test(id) ? { getContext: () => ({}) } : null)
};

const root = { innerHTML: '' };
const fetchFn = async (url) => ({
  ok: true,
  json: async () => JSON.parse(readFileSync(url.split('?')[0], 'utf8'))
});

await start(root, { fetchFn, today: new Date(2026, 7, 2), document: globalThis.document });

// --- the landing view carries real numbers ---
assert.ok(root.innerHTML.includes('฿14,748'), 'daily must show the 31 Jul group total');
assert.ok(/2 days/.test(root.innerHTML), 'staleness must be disclosed on boot');
assert.ok(!/card-error/.test(root.innerHTML), 'a clean load must show no error card');
const dailyHtml = root.innerHTML;

// --- every tab repaints via hashchange ---
assert.strictEqual(typeof listeners.hashchange, 'function', 'start must register a hashchange handler');
for (const view of ['monthly', 'stock', 'log']) {
  window.location.hash = `#${view}`;
  listeners.hashchange();
  assert.ok(root.innerHTML.length > 200, `${view} painted almost nothing`);
  assert.ok(!/Error rendering/i.test(root.innerHTML), `${view} threw during repaint`);
}

// --- the monthly view explains the absorbed payout, not just a zero ---
window.location.hash = '#monthly';
listeners.hashchange();
assert.ok(/absorb/i.test(root.innerHTML), 'B2 pays ฿0 and the page must say why');
assert.ok(root.innerHTML.includes('฿51,254'), 'Blessme settlement total');

// --- navigating back is not a one-way trip ---
window.location.hash = '#daily';
listeners.hashchange();
assert.strictEqual(root.innerHTML, dailyHtml, 'returning to daily must reproduce the same page');

console.log('✅ boot OK — start() mounts, all four tabs repaint, no blank page');
