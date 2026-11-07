// Parn's month-end costs, typed in LINE: "cost B1 Nov 12000 rent".
// Each one becomes one Daily_Expenses row on the last day of that month, so the
// existing P&L (profit = sales - costs) picks it up with no new data path.
const { KEYWORDS } = require('./adapter');
const { MONTHS, money } = require('./words');

const COST_RE = /^cost\s+(b[1-4])\s+([a-z]{3})(?:\s*'?(\d{2}|\d{4}))?\s+([\d,]+(?:\.\d{1,2})?)\s+(.{1,80})$/i;
const USAGE = 'Type: cost B1 Nov 12000 rent\n(branch, month, amount in baht, what it is)';

function isCostCommand(text) {
  return /^cost\b/i.test(String(text || '').trim());
}

function bangkokYear(now) {
  return new Date(now + 7 * 3600 * 1000).getUTCFullYear();
}

/** The expense row for one cost line, or { error } with what to type instead. */
function parseCost(text, now) {
  const m = COST_RE.exec(String(text || '').trim().replace(/\s+/g, ' '));
  if (!m) return { error: USAGE };
  const mi = MONTHS.findIndex(name => name.toLowerCase() === m[2].toLowerCase());
  if (mi < 0) return { error: `"${m[2]}" is not a month. ${USAGE}` };
  const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : bangkokYear(now);
  const amt = Number(m[4].replace(/,/g, ''));
  if (!(amt > 0)) return { error: `The amount must be more than 0. ${USAGE}` };
  const what = m[5].trim();
  const hit = KEYWORDS.find(k => k.test.test(what));
  const last = new Date(Date.UTC(year, mi + 1, 0)).getUTCDate();
  const branch = m[1].toUpperCase();
  const month = `${MONTHS[mi]}${String(year).slice(-2)}`;
  return {
    row: {
      idx: `cost-${branch}-${month}-${what.toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '-')}-${amt}`,
      branch,
      date: `${String(last).padStart(2, '0')}/${String(mi + 1).padStart(2, '0')}/${year}`,
      month,
      bucket: hit ? hit.bucket : 'OPEX',
      cat: hit ? hit.cat : 'Other OPEX',
      desc: `Monthly cost from Parn: ${what}`,
      amt,
    },
  };
}

function costSaved(row) {
  return `Cost added: ${row.branch} ${row.month.slice(0, 3)} ${row.cat} ฿${money(row.amt)}. Profit on the dashboard now takes it off.`;
}

module.exports = { isCostCommand, parseCost, costSaved, USAGE };
