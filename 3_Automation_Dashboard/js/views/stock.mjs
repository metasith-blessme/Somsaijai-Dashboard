import { BRANCHES, flattenSales, seriesFor } from '../data.mjs';
import { baht } from '../format.mjs';
import { THRESHOLDS } from '../alerts.mjs';

// Only these have daily usage recorded, so only these support a real burn rate.
// `uyco` (young coconut) exists in the schema but is zero across every branch,
// so it is omitted rather than rendered as a permanently empty row.
export const MEASURED_ITEMS = [
  { label: 'Orange', columns: ['uo'], unit: 'basket' },
  { label: 'Watermelon', columns: ['uw'], unit: 'whole' },
  { label: 'Mango', columns: ['umg'], unit: 'kg' },
  { label: 'Apple', columns: ['uap'], unit: 'whole' },
  { label: 'Guava', columns: ['uguava'], unit: 'kg' },
  { label: 'Pineapple', columns: ['upine'], unit: 'whole' },
  { label: 'Coconut meat', columns: ['uco_meat'], unit: 'unit' },
  { label: 'Coconut water', columns: ['uco_water', 'uco_raw'], unit: 'unit' },
  { label: 'Milk / Condensed', columns: ['uco_conden'], unit: 'unit' }
];

// Sold in reality but absent from the schema entirely — no usage column, no cup
// count, no price. Named on screen so their absence is visible, not silent.
export const UNTRACKED_PRODUCTS = ['Mangosteen', 'Mangosteen & Lychee', 'Rambutan'];

const MEASURED_LABELS = MEASURED_ITEMS.map((i) => i.label);

function rateOver(series, columns, asOf, days) {
  const start = asOf.getTime() - (days * 86400000);
  const window = series.filter((r) => {
    const t = r.date.getTime();
    return t <= asOf.getTime() && t > start;
  });
  if (window.length === 0) return 0;
  const total = window.reduce(
    (s, r) => s + columns.reduce((c, col) => c + (Number(r.raw[col]) || 0), 0),
    0
  );
  return total / window.length;
}

export function buildStockModel({ data, asOf }) {
  const { rows } = flattenSales(data);

  const measured = MEASURED_ITEMS.map((item) => {
    const perBranch = {};
    BRANCHES.forEach((branch) => {
      const series = seriesFor(rows, branch);
      const rate30 = rateOver(series, item.columns, asOf, THRESHOLDS.TRAILING_WINDOW_DAYS);
      const rate7 = rateOver(series, item.columns, asOf, THRESHOLDS.RECENT_WINDOW_DAYS);
      const trend = rate30 > 0 ? ((rate7 - rate30) / rate30) * 100 : 0;
      perBranch[branch] = { rate30, rate7, trend };
    });
    return { ...item, perBranch };
  });

  const spendByCat = {};
  (data.expenses || [])
    .filter((e) => e.bucket === 'COGS')
    .forEach((e) => {
      const cat = e.cat || 'Other';
      if (MEASURED_LABELS.includes(cat)) return;
      spendByCat[cat] = (spendByCat[cat] || 0) + (Number(e.amt) || 0);
    });

  const spendOnly = Object.entries(spendByCat)
    .map(([cat, amount]) => ({ cat, amount }))
    .sort((a, b) => b.amount - a.amount);

  return { measured, spendOnly, untracked: UNTRACKED_PRODUCTS };
}

const trendChip = (trend) => {
  if (!trend) return '<span class="muted">—</span>';
  const up = trend > 0;
  const strong = Math.abs(trend) >= THRESHOLDS.USAGE_DEVIATION_PCT;
  return `<span class="chip ${strong ? (up ? 'chip-up' : 'chip-down') : 'chip-flat'}">${up ? '▲' : '▼'} ${Math.abs(trend).toFixed(0)}%</span>`;
};

export function renderStock(model) {
  const measuredRows = model.measured.map((m) => `
    <tr>
      <td>${m.label} <span class="muted">${m.unit}/day</span></td>
      ${BRANCHES.map((b) => `
        <td class="num">${m.perBranch[b].rate30.toFixed(1)} ${trendChip(m.perBranch[b].trend)}</td>
      `).join('')}
    </tr>
  `).join('');

  const spendRows = model.spendOnly.map((s) => `
    <tr><td>${s.cat}</td><td class="num">${baht(s.amount)}</td></tr>
  `).join('');

  return `
    <section class="card">
      <div class="label">Measured usage · 30-day daily rate, 7-day trend</div>
      <table class="statement">
        <thead><tr><th>Item</th>${BRANCHES.map((b) => `<th class="num">${b}</th>`).join('')}</tr></thead>
        <tbody>${measuredRows}</tbody>
      </table>
    </section>

    <section class="card">
      <div class="label">Spend only — no usage tracked</div>
      <p class="muted">
        These are purchased but not counted daily, so no burn rate exists for them.
        Figures are total spend to date.
      </p>
      <table class="statement"><tbody>${spendRows}</tbody></table>
    </section>

    <section class="card card-gap">
      <div class="label">Sold but not tracked</div>
      <p class="muted">
        ${model.untracked.join(', ')} — these are purchased and sold but have no usage
        column, cup count, or price in the data, so they appear in no figure on this page.
      </p>
    </section>
  `;
}
