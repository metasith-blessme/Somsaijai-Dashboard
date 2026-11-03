// Plain-English building blocks for messages to Parn and Ming.
const { observedNumber } = require('./fields');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function money(n) {
  return n == null ? '?' : Number(n).toLocaleString('en-US');
}

/** "30/10/2026" -> "30 Oct 2026". Anything else is returned as written. */
function day(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ''));
  if (!m) return value || 'date?';
  return `${Number(m[1])} ${MONTHS[Number(m[2]) - 1]} ${m[3]}`;
}

/** "30 Oct" for short places such as button text. */
function shortDay(value) {
  return day(value).replace(/ \d{4}$/, '');
}

function less(diff) {
  return diff > 0 ? 'less' : 'more';
}

function alreadyText(who) {
  const name = (who && who.name) || (who && who.userId ? `…${String(who.userId).slice(-6)}` : 'someone');
  return who && (who.decision === 'reject' || who.decision === 'stock_reject')
    ? `Already rejected by ${name}. Nothing changed.`
    : `Already approved by ${name}. Nothing changed.`;
}

/** Why a sheet was not booked, in words, leaving out what a flag already says. */
const HELD = [
  [/cash \+ scan does not equal/, (r, record) => {
    const fin = record.financials || {};
    const gap = observedNumber(fin.total_sales) - observedNumber(fin.cash_sales) - observedNumber(fin.scan_sales);
    if (!Number.isFinite(gap)) return 'Net cash + Scan does not match the Total';
    const ice = observedNumber(record.other && record.other.ice);
    return `Net cash + Scan is ฿${money(Math.abs(gap))} ${less(gap)} than the Total${gap === ice ? ' (same as Ice)' : ''}`;
  }],
  [/line amounts do not add up to the written total/, () => 'the items do not add up to the Total'],
  [/total minus expense/, () => 'the net does not match'],
  [/qty times price|cash tally/, () => 'an item row does not add up'],
  [/note arithmetic|note starts from/, () => 'the note does not match'],
  [/branch was not read/, () => 'no branch'],
  [/date was not read/, () => 'no date'],
  [/revenue was not read/, () => 'no Total'],
  [/January–March/, (r, record) => (record.issues || []).some(i => i.field === 'date_age') ? null : 'Jan to Mar 2026 is closed'],
  [/was not open yet/, (r, record) => (record.issues || []).some(i => i.field === 'date_age') ? null : r.replace(/ was not open yet on .*/, ' was not open yet on that date')],
  [/two or more sales photos/, () => 'two sheets for the same day, so neither was booked'],
  [/more than \d+ days old|in the future/, () => null],
  [/second reading|Gemini|timed out|first reading failed/, () => null],
];

function heldWords(reasons, record) {
  const out = [];
  for (const reason of reasons || []) {
    const hit = HELD.find(([re]) => re.test(reason));
    const text = hit ? hit[1](reason, record) : String(reason).slice(0, 80);
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

module.exports = { money, day, shortDay, less, alreadyText, heldWords, MONTHS };
