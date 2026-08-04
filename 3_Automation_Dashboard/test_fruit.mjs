// Run: node test_fruit.mjs
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { buildFruitModel, renderFruit, NON_FRUIT } from './js/views/fruit.mjs';

const reports = JSON.parse(readFileSync('reports_data.json', 'utf8'));

const model = buildFruitModel({ reports, month: 'Jul26', branch: 'all' });

// --- every fruit with a cost is listed, most expensive first ---
assert.ok(model.fruits.length > 0);
for (let i = 1; i < model.fruits.length; i++) {
  assert.ok(model.fruits[i].cost <= model.fruits[i - 1].cost, 'sorted by cost, dearest first');
}
const orange = model.fruits.find((f) => f.name === 'Orange');
assert.strictEqual(orange.cost, 65128, 'orange is the biggest fruit cost in July');
assert.strictEqual(orange.rev, 116100);
assert.strictEqual(orange.cups, 1935);
assert.strictEqual(orange.gross, 116100 - 65128);
assert.ok(Math.abs(orange.costPerCup - 65128 / 1935) < 0.01);
assert.ok(Math.abs(orange.marginPct - ((116100 - 65128) / 116100) * 100) < 0.01);

const watermelon = model.fruits.find((f) => f.name === 'Watermelon');
assert.strictEqual(watermelon.cost, 36880);
assert.strictEqual(watermelon.rev, 196150, 'watermelon earns most on modest cost');
assert.ok(watermelon.marginPct > orange.marginPct, 'watermelon is the better margin');

// --- the breakdown must reconcile to the reported COGS ---
assert.strictEqual(
  model.totalCost + model.nonFruitTotal,
  223530,
  'fruit + non-fruit categories must equal July total COGS exactly'
);
assert.strictEqual(model.totalCost, model.fruits.reduce((s, f) => s + f.cost, 0));

// --- non-fruit COGS lines are separated, not silently mixed in ---
assert.ok(model.nonFruit.length > 0);
assert.ok(model.nonFruit.some((n) => n.name === 'Packaging'));
assert.ok(NON_FRUIT.includes('Packaging'));
// the two buckets never overlap
model.nonFruit.forEach((n) =>
  assert.ok(!model.fruits.some((f) => f.name === n.name), `${n.name} counted twice`));
assert.ok(!model.fruits.some((f) => NON_FRUIT.includes(f.name)), 'Packaging is not a fruit');

// --- cost comes from fruit_summary, which is what reconciles to total_cogs ---
// The two sources disagree: fruit_performance reports Guava at 0 for July while
// fruit_summary has 21,200, and June's Coconut is 20,400 vs 0 the other way.
// Only fruit_summary adds up to total_cogs, so it wins — the old dashboard's
// ROI panel read from fruit_performance and therefore showed Guava as "N/A".
const guava = model.fruits.find((f) => f.name === 'Guava');
assert.ok(guava, 'guava sold 285 cups and must not vanish');
assert.strictEqual(guava.cost, 21200, 'from fruit_summary, not fruit_performance');
assert.strictEqual(guava.hasCost, true);
assert.ok(model.costSourceMismatch.includes('Guava'), 'the disagreement must be recorded');

// June really does have a fruit with revenue and no attributed cost
const june = buildFruitModel({ reports, month: 'Jun26', branch: 'all' });
const juneCoconut = june.fruits.find((f) => f.name === 'Coconut');
assert.ok(juneCoconut.rev > 0, 'coconut sold in June');
assert.strictEqual(
  juneCoconut.cost, 0,
  'June has no "Coconut" key in fruit_summary — its spend sits under Coconut Water / Milk-Conden'
);
assert.strictEqual(juneCoconut.hasCost, false, 'flagged so the view can say "not attributed"');
assert.ok(/not attributed/i.test(renderFruit(june)), 'June must disclose the gap');

// zero-everything products are dropped rather than shown as empty rows
assert.ok(!model.fruits.some((f) => f.name === 'Young Coco'), 'no sales and no cost: omit');

// --- reconciliation must hold for EVERY month, not just July ---
const expectedCogs = { Jan26: null, Jun26: 199025, Jul26: 223530, all: 1120823 };
Object.entries(expectedCogs).filter(([, v]) => v !== null).forEach(([m, total]) => {
  const mm = buildFruitModel({ reports, month: m, branch: 'all' });
  assert.strictEqual(
    mm.totalCost + mm.nonFruitTotal, total,
    `${m}: fruit + other must equal total material costs exactly`
  );
});

// --- full year works ---
const year = buildFruitModel({ reports, month: 'all', branch: 'all' });
assert.ok(year.totalCost > model.totalCost);

// --- a month with no report degrades cleanly ---
const missing = buildFruitModel({ reports, month: 'Dec26', branch: 'all' });
assert.deepStrictEqual(missing.fruits, []);
assert.ok(renderFruit(missing).length > 0);

// --- render ---
const html = renderFruit(model);
assert.ok(/fruit/i.test(html));
assert.ok(html.includes('฿65,128'), 'orange cost on screen');
assert.ok(html.includes('Watermelon'));
assert.ok(html.includes('Packaging'), 'non-fruit COGS still shown, just separated');
assert.ok(html.includes('฿21,200'), 'guava cost from the reconciling source');

// --- branch honesty: fruit costs are pooled group-wide, never per branch ---
const b2 = buildFruitModel({ reports, month: 'Jul26', branch: 'B2' });
assert.strictEqual(b2.totalCost, model.totalCost, 'the numbers are identical because they are group-wide');
assert.strictEqual(b2.isGroupWide, true);
assert.ok(
  /all branches|not split|pooled|group/i.test(renderFruit(b2)),
  'under a branch filter the page must say these figures are not branch-specific'
);

console.log('✅ fruit OK');
