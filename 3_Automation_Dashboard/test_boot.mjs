// Run: node test_boot.mjs
// Boots the real start() entry point against a minimal fake DOM and disk-backed
// fetch. test_smoke.mjs proves each view renders; this proves the thing the
// browser actually calls wires them together — module graph, data load, routing,
// hashchange repaint and chart mounting. The originating bug was a page that
// loaded fine and then rendered nothing, which only this level catches.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { start } from './js/app.mjs';

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

// The real root is a DOM node; start() delegates a change listener to it.
const rootListeners = {};
const root = {
  innerHTML: '',
  addEventListener: (key, fn) => { rootListeners[key] = fn; }
};
// Simulate the owner picking a value from one of the two <select> controls.
const choose = (control, value) =>
  rootListeners.change({ target: { value, getAttribute: (a) => (a === 'data-control' ? control : null) } });
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

// --- the month and branch controls actually change what is on screen ---
assert.strictEqual(typeof rootListeners.change, 'function', 'start must delegate a change listener');
assert.ok(/data-control="month"/.test(root.innerHTML), 'the month control must be on the page');
assert.ok(/data-control="branch"/.test(root.innerHTML), 'the branch control must be on the page');

// Monthly view, switch to June: the settlement must follow the selection.
window.location.hash = '#monthly';
listeners.hashchange();
assert.ok(root.innerHTML.includes('Jul26 settlement'), 'opens on the newest month');
choose('month', 'Jun26');
assert.ok(root.innerHTML.includes('Jun26 settlement'), 'picking June must re-render June');
assert.ok(root.innerHTML.includes('฿307,490'), "June's revenue, not July's");
assert.ok(!root.innerHTML.includes('฿549,947'), 'July figures must be gone');

// Full Year is reachable and aggregates every month.
choose('month', 'all');
assert.ok(root.innerHTML.includes('฿2,558,806'), 'Full Year revenue across Jan–Jul');

// Branch filter narrows to one branch everywhere.
choose('month', 'Jul26');
choose('branch', 'B2');
assert.ok(root.innerHTML.includes('฿135,960'), "B2's July revenue");
assert.ok(!root.innerHTML.includes('฿242,090'), 'B1 must be filtered out');
assert.ok(/absorb/i.test(root.innerHTML), 'B2 alone still explains its absorbed payout');

// The filters persist across a tab change rather than resetting.
window.location.hash = '#log';
listeners.hashchange();
assert.ok(/data-control="branch"/.test(root.innerHTML), 'controls stay available on every view');
assert.ok(root.innerHTML.includes('B2'), 'log respects the branch filter');

// --- the daily view has a day picker that shows that specific day ---
choose('branch', 'all');
choose('month', 'Jul26');
window.location.hash = '#daily';
listeners.hashchange();
assert.ok(/data-control="day"/.test(root.innerHTML), 'daily must offer a day picker');
assert.ok(root.innerHTML.includes('฿14,748'), 'defaults to the newest day, 31 Jul');

choose('day', 15);
assert.ok(root.innerHTML.includes('฿18,311'), '15 Jul group revenue');
assert.ok(root.innerHTML.includes('Wed 15 Jul'), 'the headline names the chosen day');
assert.ok(!root.innerHTML.includes('฿14,748'), "31 Jul's figure must be gone");

choose('day', 1);
assert.ok(/Wed 1 Jul/.test(root.innerHTML), 'the 1st is reachable');

// the day picker is only on daily — it means nothing on a monthly settlement
window.location.hash = '#monthly';
listeners.hashchange();
assert.ok(!/data-control="day"/.test(root.innerHTML), 'no day picker on monthly');

// --- the fruit cost breakdown is on the monthly view ---
assert.ok(/Fruit cost breakdown/i.test(root.innerHTML));
assert.ok(root.innerHTML.includes('฿65,128'), 'orange cost');
assert.ok(/Other material costs/i.test(root.innerHTML));

// --- switching month while on daily snaps to a valid day ---
window.location.hash = '#daily';
listeners.hashchange();
choose('branch', 'B3');
assert.ok(
  !/Error rendering/i.test(root.innerHTML),
  'B3 has no data on 1 July and must snap to a day it does have'
);
assert.ok(/Jul/.test(root.innerHTML));

console.log('✅ boot OK — tabs, month/branch/day controls and fruit costs all render');
