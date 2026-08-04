import { loadAll } from './data.js';
import { buildDailyModel, renderDaily } from './views/daily.js';
import { buildMonthlyModel, renderMonthly } from './views/monthly.js';
import { buildStockModel, renderStock } from './views/stock.js';
import { buildLogModel, renderLog } from './views/log.js';
import { buildChartModels, mountCharts } from './charts.js';

export const VIEWS = ['daily', 'monthly', 'stock', 'log'];

export function viewFromHash(hash) {
  const name = String(hash || '').replace(/^#/, '');
  return VIEWS.includes(name) ? name : 'daily';
}

// A view that throws must not take down the page. It renders an error card
// naming itself and showing the real message, and every other view keeps working.
export function safeRender(name, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[${name}] render failed`, err);
    return `
      <div class="card card-error">
        <div class="label">Error rendering the ${name} view</div>
        <p>${String(err && err.message ? err.message : err)}</p>
        <p class="muted">The other views still work. This is a bug — the message above says where to look.</p>
      </div>
    `;
  }
}

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function previousMonthKey(month) {
  const m = /^([A-Za-z]{3})(\d{2})$/.exec(String(month || ''));
  if (!m) return null;
  const idx = MONTH_ORDER.indexOf(m[1]);
  if (idx < 0) return null;
  return idx === 0 ? `Dec${String(Number(m[2]) - 1).padStart(2, '0')}` : `${MONTH_ORDER[idx - 1]}${m[2]}`;
}

export function renderView({ name, data, reports, today, branch, month }) {
  return safeRender(name, () => {
    if (!data) {
      return `<div class="card card-empty"><p>No data loaded. Run <code>npm run update-dashboard</code>.</p></div>`;
    }
    if (name === 'daily') return renderDaily(buildDailyModel({ data, reports, today }));
    if (name === 'monthly') {
      return renderMonthly(buildMonthlyModel({ reports, month, previousMonth: previousMonthKey(month) }));
    }
    if (name === 'stock') return renderStock(buildStockModel({ data, asOf: today }));
    return renderLog(buildLogModel({ data, branch, month }));
  });
}

export async function start(root, deps = {}) {
  const doc = deps.document || document;
  const { data, reports, errors } = await loadAll(deps.fetchFn);
  const today = deps.today || new Date();

  const banner = errors.length
    ? `<div class="card card-error"><div class="label">Data problems</div><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>`
    : '';

  let month = 'Jul26';
  if (reports) {
    const keys = Object.keys(reports).filter((k) => k !== 'all');
    if (keys.length) month = keys[keys.length - 1];
  }

  const paint = () => {
    const name = viewFromHash(window.location.hash);
    root.innerHTML = banner + renderView({ name, data, reports, today, branch: 'all', month });
    doc.querySelectorAll('[data-view]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-view') === name);
    });

    // Charts only exist on the monthly view, and only if Chart.js loaded.
    // A missing library must degrade to tables, not blank the page.
    const ChartCtor = deps.Chart || window.Chart;
    if (name === 'monthly' && data && ChartCtor) {
      try {
        mountCharts(buildChartModels({ data, month }), ChartCtor, doc);
      } catch (err) {
        console.error('[charts] mount failed', err);
      }
    }
  };

  window.addEventListener('hashchange', paint);
  paint();
}
