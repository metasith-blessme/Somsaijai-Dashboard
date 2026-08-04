import { BRANCHES, seriesFor, trailingAverage } from './data.js';

export const THRESHOLDS = {
  REVENUE_DEVIATION_PCT: 20,
  USAGE_DEVIATION_PCT: 30,
  TRAILING_WINDOW_DAYS: 30,
  RECENT_WINDOW_DAYS: 7
};

// Carried from the old dashboard's PARAMS.fixed (rent + salary + utilities).
// B2's ฿25,000 rent is the Jul–Sep discounted rate and reverts to ฿30,000 in
// October 2026, which will make B2's break-even alert ฿5,000 optimistic from
// that month. Update this constant then.
export const FIXED_MONTHLY = { B1: 74000, B2: 59000, B3: 69500 };

const SEVERITY_RANK = { high: 0, warn: 1, info: 2 };

export function revenueAnomaly(branch, latestRev, trailingAvg) {
  if (!trailingAvg) return null;
  const change = (latestRev - trailingAvg) / trailingAvg * 100;
  if (Math.abs(change) < THRESHOLDS.REVENUE_DEVIATION_PCT) return null;
  const isDown = change < 0;
  return {
    severity: isDown ? 'high' : 'info',
    branch,
    message: `${branch} ${isDown ? 'down' : 'up'} ${Math.abs(change).toFixed(0)}% vs its 30-day average`
  };
}

export function auditVariance(branch, branchRows) {
  const flagged = branchRows.filter((r) => r.raw && r.raw.audit && r.raw.audit.is_flagged);
  if (flagged.length === 0) return null;
  const total = flagged.reduce((s, r) => s + (Number(r.raw.audit.rev_diff) || 0), 0);
  const sign = total >= 0 ? '+' : '';
  return {
    severity: 'warn',
    branch,
    message: `${branch} has ${flagged.length} flagged day${flagged.length === 1 ? '' : 's'} (${sign}${Math.round(total).toLocaleString('en-US')})`
  };
}

export function belowBreakEven(branch, monthToDateNet) {
  const base = FIXED_MONTHLY[branch];
  if (!base) return null;
  if (monthToDateNet >= base) return null;
  return {
    severity: 'high',
    branch,
    message: `${branch} month-to-date net is below its ฿${base.toLocaleString('en-US')} fixed cost base`
  };
}

export function buildAlerts({ rows, latest, reports }) {
  const alerts = [];
  if (!rows || rows.length === 0) return alerts;

  BRANCHES.forEach((branch) => {
    const series = seriesFor(rows, branch);
    if (series.length === 0) return;

    const latestRow = series.filter((r) => r.date.getTime() === latest.getTime())[0];
    if (latestRow) {
      const avg = trailingAverage(series, latest, THRESHOLDS.TRAILING_WINDOW_DAYS);
      const anomaly = revenueAnomaly(branch, latestRow.rev, avg);
      if (anomaly) alerts.push(anomaly);
    }

    const latestMonth = series[series.length - 1].month;
    const monthRows = series.filter((r) => r.month === latestMonth);
    const variance = auditVariance(branch, monthRows);
    if (variance) alerts.push(variance);

    const monthReport = (reports || {})[latestMonth];
    const branchReport = monthReport ? monthReport[branch.toLowerCase()] : null;
    if (branchReport && typeof branchReport.net === 'number') {
      const under = belowBreakEven(branch, branchReport.net);
      if (under) alerts.push(under);
    }
  });

  return alerts.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
