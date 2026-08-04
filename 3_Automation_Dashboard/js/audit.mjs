import { flattenSales } from './data.mjs';
import { baht, pct, formatDate } from './format.mjs';

// The anti-cheat check: every daily entry carries a theoretical revenue derived
// from cups sold and price. Actual takings that drift from it are flagged at
// extraction time. This surfaces that reconciliation instead of burying it.
export function buildAuditModel({ data, branch = 'all', month = 'all' }) {
  const rows = flattenSales(data).rows.filter(
    (r) => (month === 'all' || r.month === month) && (branch === 'all' || r.branch === branch)
  );

  let actual = 0;
  let theoretical = 0;
  const flagged = [];

  rows.forEach((r) => {
    const audit = r.raw.audit || {};
    const th = Number(audit.theoretical_rev) || 0;
    actual += r.rev;
    theoretical += th;
    if (audit.is_flagged) {
      flagged.push({
        branch: r.branch,
        date: r.date,
        dateLabel: formatDate(r.date),
        rev: r.rev,
        theoretical: th,
        diff: r.rev - th,
        cups: r.cups
      });
    }
  });

  // Largest absolute discrepancy first — that is the day worth opening.
  flagged.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return {
    branch,
    month,
    days: rows.length,
    actual,
    theoretical,
    diff: actual - theoretical,
    variancePct: theoretical > 0 ? ((actual - theoretical) / theoretical) * 100 : 0,
    flagged
  };
}

export function renderAudit(model) {
  if (model.days === 0) {
    return `
      <section class="card card-empty">
        <div class="label">Audit reconciliation</div>
        <p>No entries in this period to reconcile.</p>
      </section>
    `;
  }

  const rows = model.flagged.map((f) => `
    <tr class="row-flagged">
      <td>${f.dateLabel}</td>
      <td>${f.branch}</td>
      <td class="num">${baht(f.rev)}</td>
      <td class="num">${baht(f.theoretical)}</td>
      <td class="num">${f.diff >= 0 ? '+' : ''}${baht(f.diff)}</td>
    </tr>
  `).join('');

  const tile = (label, value, cls = '') =>
    `<div class="tile"><div class="tile-label">${label}</div><div class="tile-value ${cls}">${value}</div></div>`;

  return `
    <section class="card">
      <div class="label">Audit reconciliation · ${model.days} day${model.days === 1 ? '' : 's'}</div>
      <div class="tiles">
        ${tile('Actual revenue', baht(model.actual))}
        ${tile('Theoretical', baht(model.theoretical))}
        ${tile('Variance', `${model.diff >= 0 ? '+' : ''}${baht(model.diff)}`, model.diff < 0 ? 'neg' : '')}
        ${tile('Variance %', pct(model.variancePct, 1))}
        ${tile('Flagged days', String(model.flagged.length), model.flagged.length ? 'neg' : 'pos')}
      </div>
      ${model.flagged.length ? `
        <table class="statement">
          <thead>
            <tr><th>Date</th><th>Br</th><th class="num">Actual</th><th class="num">Theoretical</th><th class="num">Diff</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<p class="all-clear">✓ Every day reconciles within tolerance.</p>'}
    </section>
  `;
}
