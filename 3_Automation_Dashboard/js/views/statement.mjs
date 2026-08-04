import { baht } from '../format.mjs';

// The month's profit & loss table: one column per visible branch plus a total.
// Kept apart from the settlement card because they answer different questions —
// settlement is "what do I pay out", the statement is "where did it go".
const statementRow = (label, key, model, negative = false) => `
  <tr${negative ? ' class="row-cost"' : ''}>
    <td>${label}</td>
    ${model.branches.map((b) => `<td class="num">${negative ? `(${baht(b[key]).slice(1)})` : baht(b[key])}</td>`).join('')}
    <td class="num"><b>${negative ? `(${baht(model.totals[key]).slice(1)})` : baht(model.totals[key])}</b></td>
  </tr>
`;

export function renderStatement(model) {
  return `
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
  `;
}
