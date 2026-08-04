import { BRANCHES, flattenSales } from '../data.mjs';
import { baht, formatDate } from '../format.mjs';
import { buildAuditModel, renderAudit } from '../audit.mjs';

export function buildLogModel({ data, branch, month }) {
  const { rows } = flattenSales(data);
  const months = [...new Set(rows.map((r) => r.month))];

  const filtered = rows.filter(
    (r) => (branch === 'all' || r.branch === branch) && (month === 'all' || r.month === month)
  );

  return {
    branch,
    month,
    months,
    audit: buildAuditModel({ data, branch, month }),
    rows: filtered.map((r) => ({
      branch: r.branch,
      date: r.date,
      dateLabel: formatDate(r.date),
      rev: r.rev,
      cash: Number(r.raw.cash) || 0,
      scan: Number(r.raw.scan) || 0,
      exp: Number(r.raw.exp) || 0,
      cups: r.cups,
      flagged: !!(r.raw.audit && r.raw.audit.is_flagged),
      revDiff: (r.raw.audit && Number(r.raw.audit.rev_diff)) || 0
    }))
  };
}

export function renderLog(model) {
  if (model.rows.length === 0) {
    return renderAudit(model.audit)
      + `<div class="card card-empty"><p>No entries for ${model.branch} in ${model.month}.</p></div>`;
  }

  const sum = (key) => model.rows.reduce((s, r) => s + r[key], 0);

  const body = model.rows.map((r) => `
    <tr${r.flagged ? ' class="row-flagged"' : ''}>
      <td>${r.dateLabel}</td>
      <td>${r.branch}</td>
      <td class="num">${baht(r.rev)}</td>
      <td class="num">${baht(r.cash)}</td>
      <td class="num">${baht(r.scan)}</td>
      <td class="num">${r.cups}</td>
      <td class="num">${r.flagged ? `⚠ ${baht(r.revDiff)}` : '✓'}</td>
    </tr>
  `).join('');

  return renderAudit(model.audit) + `
    <section class="card">
      <div class="label">Daily operations log · ${model.branch} · ${model.month} · ${model.rows.length} entries</div>
      <table class="statement">
        <thead>
          <tr><th>Date</th><th>Br</th><th class="num">Revenue</th><th class="num">Cash</th><th class="num">Scan</th><th class="num">Cups</th><th class="num">Audit</th></tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr class="row-payout">
            <td colspan="2"><b>Total</b></td>
            <td class="num"><b>${baht(sum('rev'))}</b></td>
            <td class="num"><b>${baht(sum('cash'))}</b></td>
            <td class="num"><b>${baht(sum('scan'))}</b></td>
            <td class="num"><b>${sum('cups').toLocaleString('en-US')}</b></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>
  `;
}
