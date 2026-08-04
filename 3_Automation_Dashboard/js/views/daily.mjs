import { BRANCHES, flattenSales, seriesFor, trailingAverage } from '../data.mjs';
import { buildAlerts, THRESHOLDS } from '../alerts.mjs';
import { baht, pct, formatDate, delta, daysBetween } from '../format.mjs';

const SPARKLINE_DAYS = 7;

export function buildDailyModel({ data, reports, today, branch = 'all', month = 'all' }) {
  const all = flattenSales(data).rows;
  // Global filters: month scopes which days exist, branch scopes whose money it is.
  const rows = all.filter(
    (r) => (month === 'all' || r.month === month) && (branch === 'all' || r.branch === branch)
  );
  if (rows.length === 0) {
    return {
      date: null, dateLabel: '', stalenessDays: 0, stalenessNote: null,
      total: 0, totalDelta: null, sparkline: [], branches: [], alerts: [],
      branch, month, cups: 0, cash: 0, scan: 0, revPerCup: 0
    };
  }

  const scope = branch === 'all' ? 'all' : branch;
  const latest = rows[rows.length - 1].date;
  const groupSeries = seriesFor(rows, scope);
  const latestGroup = groupSeries[groupSeries.length - 1];
  const latestRows = rows.filter((r) => r.date.getTime() === latest.getTime());
  const sumRaw = (key) => latestRows.reduce((s, r) => s + (Number(r.raw[key]) || 0), 0);
  const cups = latestRows.reduce((s, r) => s + r.cups, 0);

  const stalenessDays = Math.max(0, daysBetween(latest, today));
  const stalenessNote = stalenessDays > 0
    ? `Latest data is ${stalenessDays} day${stalenessDays === 1 ? '' : 's'} old — run \`npm run update-dashboard\` after entering newer sales.`
    : null;

  const trailing = trailingAverage(
    groupSeries.slice(0, -1), latest, THRESHOLDS.TRAILING_WINDOW_DAYS
  );

  const sparkline = groupSeries.slice(-SPARKLINE_DAYS).map((r) => r.rev);

  const visibleBranches = branch === 'all' ? BRANCHES : [branch];
  const branches = visibleBranches.map((b) => {
    const series = seriesFor(rows, b);
    const row = series.filter((r) => r.date.getTime() === latest.getTime())[0];
    const avg = trailingAverage(series, latest, THRESHOLDS.TRAILING_WINDOW_DAYS);
    return {
      branch: b,
      rev: row ? row.rev : 0,
      cups: row ? row.cups : 0,
      cash: row ? Number(row.raw.cash) || 0 : 0,
      scan: row ? Number(row.raw.scan) || 0 : 0,
      delta: row ? delta(row.rev, avg) : null
    };
  });

  return {
    date: latest,
    dateLabel: formatDate(latest),
    stalenessDays,
    stalenessNote,
    total: latestGroup.rev,
    totalDelta: delta(latestGroup.rev, trailing),
    sparkline,
    branches,
    branch,
    month,
    cups,
    cash: sumRaw('cash'),
    scan: sumRaw('scan'),
    revPerCup: cups > 0 ? latestGroup.rev / cups : 0,
    trailingAvg: trailing,
    alerts: buildAlerts({ rows, latest, reports })
  };
}

const deltaChip = (d) => {
  if (!d) return '';
  const cls = d.direction === 'down' ? 'chip-down' : 'chip-up';
  const arrow = d.direction === 'down' ? '▼' : '▲';
  return `<span class="chip ${cls}">${arrow} ${Math.abs(d.pct).toFixed(0)}%</span>`;
};

const sparklineBars = (values) => {
  const max = Math.max(...values, 1);
  return values
    .map((v, i) => {
      const isLast = i === values.length - 1;
      return `<div class="spark-bar${isLast ? ' spark-bar-current' : ''}" style="height:${(v / max * 100).toFixed(1)}%"></div>`;
    })
    .join('');
};

const alertRow = (a) =>
  `<li class="alert alert-${a.severity}"><span class="alert-dot"></span>${a.message}</li>`;

export function renderDaily(model) {
  if (!model.date) {
    return `<div class="card card-empty"><p>No sales data yet. Run <code>npm run update-dashboard</code> to load it.</p></div>`;
  }

  const alertsSection = model.alerts.length
    ? `<ul class="alert-list">${model.alerts.map(alertRow).join('')}</ul>`
    : `<p class="all-clear">✓ All clear — nothing needs attention.</p>`;

  const scopeLabel = model.branch === 'all' ? 'All branches' : model.branch;
  const tile = (label, value) =>
    `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value">${value}</div></div>`;

  return `
    <section class="card card-hero">
      <div class="label">${model.dateLabel} · ${scopeLabel}</div>
      <div class="hero-value">${baht(model.total)}</div>
      ${deltaChip(model.totalDelta)}
      <div class="sparkline">${sparklineBars(model.sparkline)}</div>
      ${model.stalenessNote ? `<p class="staleness">${model.stalenessNote}</p>` : ''}
    </section>

    <section class="card">
      <div class="label">That day at a glance</div>
      <div class="tiles">
        ${tile('Cups', model.cups.toLocaleString('en-US'))}
        ${tile('Revenue / cup', baht(model.revPerCup))}
        ${tile('Cash', baht(model.cash))}
        ${tile('Scan', baht(model.scan))}
        ${tile('30-day avg', baht(model.trailingAvg))}
        ${tile('Scan share', pct(model.total > 0 ? (model.scan / model.total) * 100 : 0, 0))}
      </div>
    </section>

    <section class="card">
      <div class="label">By branch</div>
      <table class="statement">
        <thead>
          <tr><th>Br</th><th class="num">Revenue</th><th class="num">Cups</th><th class="num">Cash</th><th class="num">Scan</th><th class="num">vs avg</th></tr>
        </thead>
        <tbody>
          ${model.branches.map((b) => `
            <tr>
              <td><b>${b.branch}</b></td>
              <td class="num">${baht(b.rev)}</td>
              <td class="num">${b.cups}</td>
              <td class="num">${baht(b.cash)}</td>
              <td class="num">${baht(b.scan)}</td>
              <td class="num">${deltaChip(b.delta) || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>

    <section class="card">
      <div class="label">Needs attention${model.alerts.length ? ` · ${model.alerts.length}` : ''}</div>
      ${alertsSection}
    </section>
  `;
}
