import { BRANCHES } from '../data.mjs';
import { FIXED_MONTHLY } from '../alerts.mjs';
import { baht, pct } from '../format.mjs';

export const PROFIT_SHARE = { B1: 0.6, B2: 0.7, B3: 0.7 };

const round = (n) => Math.round(Number(n) || 0);

export function buildMonthlyModel({ reports, month, previousMonth, branch = 'all' }) {
  const report = (reports || {})[month];
  if (!report) {
    return {
      month, branch, blessmeTotal: 0, mingTotal: 0, branches: [],
      totals: { rev: 0, cogs: 0, gross: 0, rental: 0, opex: 0, net: 0 },
      previous: null, moved: [], opexRows: []
    };
  }

  const visible = branch === 'all' ? BRANCHES : BRANCHES.filter((b) => b === branch);
  const branches = visible.map((branchKey) => {
    const r = report[branchKey.toLowerCase()];
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
      branch: branchKey,
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
    branch,
    blessmeTotal: sumOf('blessme'),
    mingTotal: sumOf('ming'),
    branches,
    totals,
    opexRows: buildOpexRows(report, branch),
    previous: (reports || {})[previousMonth] || null,
    // Fixed cost base for the visible branches — what revenue must cover before
    // anything is distributable.
    fixedBase: branches.reduce((s, b) => s + (FIXED_MONTHLY[b.branch] || 0), 0),
    grossMargin: totals.rev > 0 ? (totals.gross / totals.rev) * 100 : 0,
    netMargin: totals.rev > 0 ? (totals.net / totals.rev) * 100 : 0
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

// The report's opex_list holds the raw non-COGS rows for the month. COGS is
// shown separately as allocated Material Costs, so listing COGS rows here would
// make the line items disagree with the total — that was a real bug in the old
// dashboard.
export function buildOpexRows(report, only = 'all') {
  if (!report) return [];
  const wanted = only === 'all' ? BRANCHES : BRANCHES.filter((b) => b === only);
  return wanted.flatMap((branch) => {
    const r = report[branch.toLowerCase()];
    if (!r || !Array.isArray(r.opex_list)) return [];
    return r.opex_list
      .filter((e) => e.bucket !== 'COGS' && e.bucket !== 'EXCLUDED' && e.bucket !== 'PENDING_REFUND')
      .map((e) => ({
        branch,
        cat: e.cat || 'Other',
        desc: e.desc || '—',
        amt: Math.round(Number(e.amt) || 0)
      }));
  });
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

  const tile = (label, value, cls = '') =>
    `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value ${cls}">${value}</div></div>`;

  // Break-even: revenue must first cover allocated COGS, then the fixed base.
  const breakEvenPct = model.fixedBase > 0
    ? Math.max(0, Math.min(100, (model.totals.gross / model.fixedBase) * 100))
    : 0;
  const covered = model.totals.gross >= model.fixedBase;

  return `
    <section class="card card-settlement">
      <div class="label">${model.month} settlement · ${model.branch === 'all' ? 'All branches' : model.branch}</div>
      <div class="settle-totals">
        <div><div class="muted">Blessme</div><div class="hero-value">${baht(model.blessmeTotal)}</div></div>
        <div><div class="muted">Ming</div><div class="hero-value">${baht(model.mingTotal)}</div></div>
      </div>
    </section>

    <section class="card">
      <div class="label">Key figures</div>
      <div class="tiles">
        ${tile('Revenue', baht(model.totals.rev))}
        ${tile('Material costs', baht(model.totals.cogs))}
        ${tile('Gross profit', baht(model.totals.gross))}
        ${tile('Gross margin', pct(model.grossMargin, 1))}
        ${tile('Operating costs', baht(model.totals.rental + model.totals.opex))}
        ${tile('Net profit', baht(model.totals.net), model.totals.net < 0 ? 'neg' : 'pos')}
        ${tile('Net margin', pct(model.netMargin, 1), model.netMargin < 0 ? 'neg' : '')}
        ${tile('Fixed cost base', baht(model.fixedBase))}
      </div>
    </section>

    <section class="card">
      <div class="label">Break-even progress</div>
      <div class="progress"><div class="progress-fill${covered ? ' progress-ok' : ''}" style="width:${breakEvenPct.toFixed(1)}%"></div></div>
      <p class="muted">
        Gross profit ${baht(model.totals.gross)} against a ${baht(model.fixedBase)} fixed base —
        ${covered
          ? `covered, with ${baht(model.totals.gross - model.fixedBase)} above break-even.`
          : `${baht(model.fixedBase - model.totals.gross)} short of covering rent, salary and utilities.`}
      </p>
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

    <section class="card">
      <div class="label">Operating expenses — ${model.month}</div>
      <table class="statement">
        <thead><tr><th>Br</th><th>Category</th><th>Detail</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${model.opexRows.map((e) => `
            <tr><td>${e.branch}</td><td>${e.cat}</td><td>${e.desc}</td><td class="num">${baht(e.amt)}</td></tr>
          `).join('')}
          <tr class="row-payout">
            <td colspan="3"><b>Total</b></td>
            <td class="num"><b>${baht(model.opexRows.reduce((s, e) => s + e.amt, 0))}</b></td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="card">
      <div class="label">Charts</div>
      <div class="chart-box"><canvas id="chartRevenue"></canvas></div>
      <div class="chart-box"><canvas id="chartPayment"></canvas></div>
      <div class="chart-box"><canvas id="chartProduct"></canvas></div>
      <div class="chart-box"><canvas id="chartDayOfWeek"></canvas></div>
    </section>
  `;
}
