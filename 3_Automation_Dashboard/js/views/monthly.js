import { BRANCHES } from '../data.js';
import { baht, pct } from '../format.js';

export const PROFIT_SHARE = { B1: 0.6, B2: 0.7, B3: 0.7 };

const round = (n) => Math.round(Number(n) || 0);

export function buildMonthlyModel({ reports, month, previousMonth }) {
  const report = (reports || {})[month];
  if (!report) {
    return {
      month, blessmeTotal: 0, mingTotal: 0, branches: [],
      totals: { rev: 0, cogs: 0, gross: 0, rental: 0, opex: 0, net: 0 },
      previous: null, moved: []
    };
  }

  const branches = BRANCHES.map((branch) => {
    const r = report[branch.toLowerCase()];
    if (!r || (!r.rev && !r.cogs)) return null;

    const rev = round(r.rev);
    const cogs = round(r.cogs);
    const net = round(r.net);
    const distributable = round(r.adjusted_net);
    const blessme = round(r.share);
    const ming = round(r.ming_share);
    // What the carry-forward actually removed from this month's payout.
    const lossApplied = Math.max(0, net - distributable);

    return {
      branch,
      rev,
      cogs,
      gross: rev - cogs,
      rental: round(r.rental),
      opex: round(r.opex),
      net,
      lossApplied,
      distributable,
      blessme,
      ming,
      // Earned a profit this month, yet pays nothing — the case that must be explained.
      absorbed: net > 0 && distributable === 0,
      margin: rev > 0 ? (net / rev) * 100 : 0
    };
  }).filter(Boolean);

  const sumOf = (key) => branches.reduce((s, b) => s + b[key], 0);
  const totals = {
    rev: sumOf('rev'), cogs: sumOf('cogs'), gross: sumOf('gross'),
    rental: sumOf('rental'), opex: sumOf('opex'), net: sumOf('net')
  };

  const model = {
    month,
    blessmeTotal: sumOf('blessme'),
    mingTotal: sumOf('ming'),
    branches,
    totals,
    previous: (reports || {})[previousMonth] || null
  };
  model.moved = whatMoved(model);
  return model;
}

// Facts derived from the data. Never hand-authored prose: written narrative
// goes stale the moment the numbers change.
export function whatMoved(model) {
  const facts = [];
  if (model.branches.length === 0) return facts;

  if (model.previous && model.previous.total_rev) {
    const change = (model.totals.rev - model.previous.total_rev) / model.previous.total_rev * 100;
    facts.push(
      `Revenue ${baht(model.totals.rev)}, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(0)}% on the previous month.`
    );
  }

  const best = [...model.branches].sort((a, b) => b.margin - a.margin)[0];
  const worst = [...model.branches].sort((a, b) => a.margin - b.margin)[0];
  if (best) facts.push(`${best.branch} has the strongest margin at ${pct(best.margin, 1)}.`);
  if (worst && worst.branch !== best.branch) {
    facts.push(`${worst.branch} is weakest at ${pct(worst.margin, 1)}.`);
  }

  model.branches.filter((b) => b.absorbed).forEach((b) => {
    facts.push(
      `${b.branch} earned ${baht(b.net)} but pays out nothing — a carried-forward loss absorbed all of it.`
    );
  });

  model.branches.filter((b) => b.net < 0).forEach((b) => {
    facts.push(`${b.branch} lost ${baht(Math.abs(b.net))} this month.`);
  });

  return facts.slice(0, 5);
}

const settlementRow = (b) => `
  <div class="settle-row${b.absorbed ? ' settle-absorbed' : ''}">
    <div>
      <b>${b.branch}</b>
      <span class="muted">${Math.round(PROFIT_SHARE[b.branch] * 100)}/${100 - Math.round(PROFIT_SHARE[b.branch] * 100)}</span>
      <div class="settle-note">
        ${b.absorbed
          ? `net ${baht(b.net)} — fully absorbed by ${baht(b.lossApplied)} carried loss`
          : b.lossApplied > 0
            ? `net ${baht(b.net)} − ${baht(b.lossApplied)} carried loss`
            : `net ${baht(b.net)}`}
      </div>
    </div>
    <div class="settle-figures">
      <b>${baht(b.blessme)}</b>
      <div class="muted">Ming ${baht(b.ming)}</div>
    </div>
  </div>
`;

const statementRow = (label, key, model, negative = false) => `
  <tr${negative ? ' class="row-cost"' : ''}>
    <td>${label}</td>
    ${model.branches.map((b) => `<td class="num">${negative ? `(${baht(b[key]).slice(1)})` : baht(b[key])}</td>`).join('')}
    <td class="num"><b>${negative ? `(${baht(model.totals[key]).slice(1)})` : baht(model.totals[key])}</b></td>
  </tr>
`;

export function renderMonthly(model) {
  if (model.branches.length === 0) {
    return `<div class="card card-empty"><p>No data for ${model.month}. Run <code>npm run update-dashboard</code>.</p></div>`;
  }

  return `
    <section class="card card-settlement">
      <div class="label">${model.month} settlement</div>
      <div class="settle-totals">
        <div><div class="muted">Blessme</div><div class="hero-value">${baht(model.blessmeTotal)}</div></div>
        <div><div class="muted">Ming</div><div class="hero-value">${baht(model.mingTotal)}</div></div>
      </div>
    </section>

    <section class="card">
      ${model.branches.map(settlementRow).join('')}
    </section>

    <section class="card">
      <div class="label">What moved</div>
      <ul class="moved-list">${model.moved.map((f) => `<li>${f}</li>`).join('')}</ul>
    </section>

    <section class="card card-statement">
      <div class="label">Profit &amp; loss — ${model.month}</div>
      <table class="statement">
        <thead>
          <tr><th></th>${model.branches.map((b) => `<th class="num">${b.branch}</th>`).join('')}<th class="num">Total</th></tr>
        </thead>
        <tbody>
          ${statementRow('Revenue', 'rev', model)}
          ${statementRow('COGS (allocated)', 'cogs', model, true)}
          ${statementRow('Gross profit', 'gross', model)}
          ${statementRow('Rent', 'rental', model, true)}
          ${statementRow('Other OPEX', 'opex', model, true)}
          ${statementRow('Net profit', 'net', model)}
          <tr class="row-carry">
            <td>Loss carried forward</td>
            ${model.branches.map((b) => `<td class="num">${b.lossApplied ? `(${baht(b.lossApplied).slice(1)})` : '—'}</td>`).join('')}
            <td class="num"><b>(${baht(model.branches.reduce((s, b) => s + b.lossApplied, 0)).slice(1)})</b></td>
          </tr>
          <tr class="row-payout">
            <td><b>Blessme</b></td>
            ${model.branches.map((b) => `<td class="num"><b>${baht(b.blessme)}</b></td>`).join('')}
            <td class="num"><b>${baht(model.blessmeTotal)}</b></td>
          </tr>
          <tr class="row-payout">
            <td><b>Ming</b></td>
            ${model.branches.map((b) => `<td class="num"><b>${baht(b.ming)}</b></td>`).join('')}
            <td class="num"><b>${baht(model.mingTotal)}</b></td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}
