import { loadAll } from './data.mjs';
import { renderControls, monthsFrom, daysFrom, resolveDay, ALL } from './controls.mjs';
import { buildDailyModel, renderDaily } from './views/daily.mjs';
import { buildMonthlyModel, renderMonthly } from './views/monthly.mjs';
import { buildStockModel, renderStock } from './views/stock.mjs';
import { buildLogModel, renderLog } from './views/log.mjs';
import { buildChartModels, mountCharts } from './charts.mjs';

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

export function renderView({ name, data, reports, today, branch, month, day }) {
  return safeRender(name, () => {
    if (!data) {
      return `<div class="card card-empty"><p>No data loaded. Run <code>npm run update-dashboard</code>.</p></div>`;
    }
    if (name === 'daily') return renderDaily(buildDailyModel({ data, reports, today, branch, month, day }));
    if (name === 'monthly') {
      return renderMonthly(buildMonthlyModel({
        reports, month, branch, previousMonth: previousMonthKey(month)
      }));
    }
    if (name === 'stock') return renderStock(buildStockModel({ data, asOf: today, branch, month }));
    return renderLog(buildLogModel({ data, branch, month }));
  });
}

// The controls are rendered OUTSIDE safeRender's view call on purpose: if a
// view throws, the owner must still be able to switch to a month or branch
// that works instead of being stranded on the broken one.
export function renderPage({ name, data, reports, today, branch, month, day = null, errors = [] }) {
  const banner = errors.length
    ? `<div class="card card-error"><div class="label">Data problems</div><ul>${errors.map((e) => `<li>${e}</li>`).join('')}</ul></div>`
    : '';
  const days = daysFrom(data, month, branch);
  const controls = safeRender('controls', () =>
    renderControls({
      months: monthsFrom(data), month, branch,
      days, day: resolveDay(days, day), showDay: name === 'daily'
    })
  );
  return banner + controls + renderView({ name, data, reports, today, branch, month, day });
}

export async function start(root, deps = {}) {
  const doc = deps.document || document;
  const { data, reports, errors } = await loadAll(deps.fetchFn);
  const today = deps.today || new Date();

  const months = monthsFrom(data);
  // Open on the most recent month rather than the full year: that is the
  // number the owner is usually checking.
  const state = {
    month: months.length ? months[months.length - 1] : ALL,
    branch: ALL,
    day: null
  };

  const paint = () => {
    const name = viewFromHash(window.location.hash);
    // Keep the chosen day only while it still exists in the current month and
    // branch; otherwise snap to the newest day that does.
    state.day = resolveDay(daysFrom(data, state.month, state.branch), state.day);
    root.innerHTML = renderPage({
      name, data, reports, today,
      branch: state.branch, month: state.month, day: state.day, errors
    });
    doc.querySelectorAll('[data-view]').forEach((el) => {
      el.classList.toggle('active', el.getAttribute('data-view') === name);
    });

    // Charts only exist on the monthly view, and only if Chart.js loaded.
    // A missing library must degrade to tables, not blank the page.
    const ChartCtor = deps.Chart || window.Chart;
    if (name === 'monthly' && data && ChartCtor) {
      try {
        mountCharts(
          buildChartModels({ data, month: state.month, branch: state.branch }),
          ChartCtor,
          doc
        );
      } catch (err) {
        console.error('[charts] mount failed', err);
      }
    }
  };

  // One delegated listener on the container, so it survives every repaint
  // instead of needing rebinding after each innerHTML assignment.
  root.addEventListener('change', (event) => {
    const control = event.target && event.target.getAttribute
      ? event.target.getAttribute('data-control')
      : null;
    if (control !== 'month' && control !== 'branch' && control !== 'day') return;
    state[control] = control === 'day' ? Number(event.target.value) : event.target.value;
    paint();
  });

  window.addEventListener('hashchange', paint);
  paint();
}
