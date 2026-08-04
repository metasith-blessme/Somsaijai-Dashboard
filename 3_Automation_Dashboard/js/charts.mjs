import { seriesFor, flattenSales } from './data.mjs';

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Date.getDay() is Sunday-first; this maps it to a Monday-first index.
const DOW_INDEX = [6, 0, 1, 2, 3, 4, 5];

const PRODUCTS = [
  { label: 'Orange', columns: ['or', 'or_100'] },
  { label: 'Watermelon', columns: ['wm'] },
  { label: 'Mango', columns: ['mg'] },
  { label: 'Coconut', columns: ['co'] },
  { label: 'Apple', columns: ['ap'] },
  { label: 'Young Coco', columns: ['yco'] },
  { label: 'Guava', columns: ['guava'] },
  { label: 'Pineapple', columns: ['pineapple'] }
];

const monthRows = (rows, month, branch = 'all') =>
  rows.filter((r) => (month === 'all' || r.month === month) && (branch === 'all' || r.branch === branch));

export function buildRevenueSeries({ rows, month, branch = 'all' }) {
  const group = seriesFor(monthRows(rows, month, branch), 'all');
  return {
    labels: group.map((r) => String(r.date.getDate())),
    data: group.map((r) => r.rev)
  };
}

export function buildPaymentMix({ rows, month, branch = 'all' }) {
  const sel = monthRows(rows, month, branch);
  const cash = sel.reduce((s, r) => s + (Number(r.raw.cash) || 0), 0);
  const scan = sel.reduce((s, r) => s + (Number(r.raw.scan) || 0), 0);
  return { labels: ['Cash', 'Scan'], data: [cash, scan] };
}

export function buildProductMix({ rows, month, branch = 'all' }) {
  const sel = monthRows(rows, month, branch);
  const totals = PRODUCTS.map((p) => ({
    label: p.label,
    value: sel.reduce(
      (s, r) => s + p.columns.reduce((c, col) => c + (Number(r.raw[col]) || 0), 0),
      0
    )
  }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  return { labels: totals.map((p) => p.label), data: totals.map((p) => p.value) };
}

export function buildDayOfWeek({ rows, month, branch = 'all' }) {
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  seriesFor(monthRows(rows, month, branch), 'all').forEach((r) => {
    const i = DOW_INDEX[r.date.getDay()];
    buckets[i] += r.rev;
    counts[i] += 1;
  });
  return {
    labels: DOW_LABELS,
    data: buckets.map((total, i) => (counts[i] ? Math.round(total / counts[i]) : 0))
  };
}

export function buildChartModels({ data, month, branch = 'all' }) {
  const { rows } = flattenSales(data);
  return {
    revenue: buildRevenueSeries({ rows, month, branch }),
    payment: buildPaymentMix({ rows, month, branch }),
    product: buildProductMix({ rows, month, branch }),
    dayOfWeek: buildDayOfWeek({ rows, month, branch })
  };
}

const CHART_SPECS = [
  { id: 'chartRevenue', key: 'revenue', type: 'line' },
  { id: 'chartPayment', key: 'payment', type: 'doughnut' },
  { id: 'chartProduct', key: 'product', type: 'doughnut' },
  { id: 'chartDayOfWeek', key: 'dayOfWeek', type: 'bar' }
];

const live = [];

// A missing canvas is skipped rather than throwing — the monthly view must
// still render its tables if a chart element is absent.
export function mountCharts(models, ChartCtor, doc) {
  while (live.length) {
    const c = live.pop();
    if (c && typeof c.destroy === 'function') c.destroy();
  }
  CHART_SPECS.forEach((spec) => {
    const el = doc.getElementById(spec.id);
    if (!el) return;
    const model = models[spec.key];
    if (!model || !model.data || model.data.length === 0) return;
    live.push(new ChartCtor(el.getContext('2d'), {
      type: spec.type,
      data: {
        labels: model.labels,
        datasets: [{ label: spec.key, data: model.data }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    }));
  });
}
