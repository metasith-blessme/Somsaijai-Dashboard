import { baht, pct } from '../format.mjs';

// Categories that appear in fruit_summary but are not fruit. Kept separate so
// the fruit table is actually about fruit, while still reconciling to COGS.
export const NON_FRUIT = ['Packaging', 'Stock', 'Other', 'Ice'];

const round = (n) => Math.round(Number(n) || 0);

// Fruit costs are pooled across branches at source — reports_data.json carries
// fruit_summary and fruit_performance at month level only, with no per-branch
// split. Under a branch filter these figures stay group-wide, and the view says
// so rather than implying the numbers belong to that one branch.
export function buildFruitModel({ reports, month, branch = 'all' }) {
  const report = (reports || {})[month];
  const empty = {
    month, branch, fruits: [], nonFruit: [], totalCost: 0, totalRev: 0,
    totalCups: 0, nonFruitTotal: 0, costSourceMismatch: [], isGroupWide: branch !== 'all'
  };
  if (!report) return empty;

  const summary = report.fruit_summary || {};
  const performance = Array.isArray(report.fruit_performance) ? report.fruit_performance : [];

  const fruits = performance
    .map((p) => {
      const rev = round(p.rev);
      // Cost comes from fruit_summary ONLY. It sums exactly to total_cogs every
      // month, so falling back to fruit_performance.cost for a missing name
      // would inject spend that is not in COGS and break the reconciliation.
      // A missing name means that month booked the cost under a different
      // category (June has no "Coconut" — it is split across "Coconut Water"
      // and "Milk/Conden"), which surfaces below as "not attributed".
      const cost = round(summary[p.name] || 0);
      const cups = round(p.cups);
      return {
        name: p.name,
        rev,
        cost,
        cups,
        gross: rev - cost,
        costPerCup: cups > 0 ? cost / cups : 0,
        revPerCup: cups > 0 ? rev / cups : 0,
        marginPct: rev > 0 ? ((rev - cost) / rev) * 100 : 0,
        // Sells but has no cost attributed to it — a real gap, shown not hidden.
        hasCost: cost > 0
      };
    })
    // Drop only what is entirely absent; a product with sales but no cost stays.
    .filter((f) => f.rev > 0 || f.cost > 0 || f.cups > 0)
    .sort((a, b) => b.cost - a.cost);

  // Where fruit_performance.cost disagrees with fruit_summary. Recorded rather
  // than silently resolved: it means one of the two upstream figures is wrong.
  const costSourceMismatch = performance
    .filter((p) => round(p.cost) !== round(summary[p.name] || 0))
    .map((p) => p.name);

  const fruitNames = new Set(performance.map((p) => p.name));
  const nonFruit = Object.keys(summary)
    .filter((k) => !fruitNames.has(k))
    .map((name) => ({ name, cost: round(summary[name]) }))
    .filter((n) => n.cost !== 0)
    .sort((a, b) => b.cost - a.cost);

  return {
    month,
    branch,
    fruits,
    nonFruit,
    totalCost: fruits.reduce((s, f) => s + f.cost, 0),
    totalRev: fruits.reduce((s, f) => s + f.rev, 0),
    totalCups: fruits.reduce((s, f) => s + f.cups, 0),
    nonFruitTotal: nonFruit.reduce((s, n) => s + n.cost, 0),
    costSourceMismatch,
    isGroupWide: branch !== 'all'
  };
}

export function renderFruit(model) {
  if (model.fruits.length === 0) {
    return `
      <section class="card card-empty">
        <div class="label">Fruit cost breakdown</div>
        <p>No cost data for ${model.month}.</p>
      </section>
    `;
  }

  const rows = model.fruits.map((f) => `
    <tr>
      <td>${f.name}</td>
      <td class="num">${f.cups.toLocaleString('en-US')}</td>
      <td class="num">${baht(f.rev)}</td>
      <td class="num row-cost">${baht(f.cost)}</td>
      <td class="num">${f.hasCost ? baht(f.costPerCup) : '<span class="muted">n/a</span>'}</td>
      <td class="num">${baht(f.gross)}</td>
      <td class="num">${f.hasCost ? pct(f.marginPct, 0) : '<span class="muted">—</span>'}</td>
    </tr>
  `).join('');

  const uncosted = model.fruits.filter((f) => !f.hasCost && f.cups > 0);

  return `
    <section class="card">
      <div class="label">
        Fruit cost breakdown — ${model.month}${model.isGroupWide ? ' · all branches' : ''}
      </div>
      ${model.isGroupWide ? `
        <p class="muted">
          Fruit is bought into one shared pool, so these costs are group-wide and
          are not split per branch — they stay the same whichever branch you select.
        </p>` : ''}
      <table class="statement">
        <thead>
          <tr>
            <th>Fruit</th><th class="num">Cups</th><th class="num">Revenue</th>
            <th class="num">Cost</th><th class="num">Cost/cup</th>
            <th class="num">Gross</th><th class="num">Margin</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="row-payout">
            <td><b>Total fruit</b></td>
            <td class="num"><b>${model.totalCups.toLocaleString('en-US')}</b></td>
            <td class="num"><b>${baht(model.totalRev)}</b></td>
            <td class="num"><b>${baht(model.totalCost)}</b></td>
            <td class="num"></td>
            <td class="num"><b>${baht(model.totalRev - model.totalCost)}</b></td>
            <td class="num"><b>${pct(model.totalRev > 0 ? ((model.totalRev - model.totalCost) / model.totalRev) * 100 : 0, 0)}</b></td>
          </tr>
        </tbody>
      </table>
      ${model.costSourceMismatch.length ? `
        <p class="muted">
          Note: for ${model.costSourceMismatch.join(', ')} the two cost figures in
          the source data disagree. The figure shown is the one that reconciles to
          total material costs; the other is wrong and worth correcting upstream.
        </p>` : ''}
      ${uncosted.length ? `
        <p class="muted">
          ${uncosted.map((f) => f.name).join(', ')} sold cups this period but had no
          purchase cost <b>not attributed</b> to them, so their margin cannot be
          calculated and the totals understate true fruit cost.
        </p>` : ''}
    </section>

    <section class="card">
      <div class="label">Other material costs</div>
      <table class="statement">
        <tbody>
          ${model.nonFruit.map((n) => `
            <tr><td>${n.name}</td><td class="num">${baht(n.cost)}</td></tr>
          `).join('')}
          <tr class="row-payout">
            <td><b>Total</b></td><td class="num"><b>${baht(model.nonFruitTotal)}</b></td>
          </tr>
        </tbody>
      </table>
      <p class="muted">
        Fruit ${baht(model.totalCost)} + other ${baht(model.nonFruitTotal)} =
        <b>${baht(model.totalCost + model.nonFruitTotal)}</b> total material costs.
      </p>
    </section>
  `;
}
