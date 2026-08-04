import { BRANCHES, flattenSales, seriesFor, trailingAverage } from '../data.js';
import { buildAlerts, THRESHOLDS } from '../alerts.js';
import { baht, formatDate, delta, daysBetween } from '../format.js';

const SPARKLINE_DAYS = 7;

export function buildDailyModel({ data, reports, today }) {
  const { rows } = flattenSales(data);
  if (rows.length === 0) {
    return {
      date: null, dateLabel: '', stalenessDays: 0, stalenessNote: null,
      total: 0, totalDelta: null, sparkline: [], branches: [], alerts: []
    };
  }

  const latest = rows[rows.length - 1].date;
  const groupSeries = seriesFor(rows, 'all');
  const latestGroup = groupSeries[groupSeries.length - 1];

  const stalenessDays = Math.max(0, daysBetween(latest, today));
  const stalenessNote = stalenessDays > 0
    ? `Latest data is ${stalenessDays} day${stalenessDays === 1 ? '' : 's'} old — run \`npm run update-dashboard\` after entering newer sales.`
    : null;

  const trailing = trailingAverage(
    groupSeries.slice(0, -1), latest, THRESHOLDS.TRAILING_WINDOW_DAYS
  );

  const sparkline = groupSeries.slice(-SPARKLINE_DAYS).map((r) => r.rev);

  const branches = BRANCHES.map((branch) => {
    const series = seriesFor(rows, branch);
    const row = series.filter((r) => r.date.getTime() === latest.getTime())[0];
    const avg = trailingAverage(series, latest, THRESHOLDS.TRAILING_WINDOW_DAYS);
    return {
      branch,
      rev: row ? row.rev : 0,
      cups: row ? row.cups : 0,
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

  return `
    <section class="card card-hero">
      <div class="label">${model.dateLabel} · All branches</div>
      <div class="hero-value">${baht(model.total)}</div>
      ${deltaChip(model.totalDelta)}
      <div class="sparkline">${sparklineBars(model.sparkline)}</div>
      ${model.stalenessNote ? `<p class="staleness">${model.stalenessNote}</p>` : ''}
    </section>

    <section class="card">
      ${model.branches.map((b) => `
        <div class="branch-row">
          <span class="branch-name"><b>${b.branch}</b></span>
          <span class="branch-figure">${baht(b.rev)} ${deltaChip(b.delta)}</span>
        </div>
      `).join('')}
    </section>

    <section class="card">
      <div class="label">Needs attention${model.alerts.length ? ` · ${model.alerts.length}` : ''}</div>
      ${alertsSection}
    </section>
  `;
}
