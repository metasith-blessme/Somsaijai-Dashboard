// Plain-English building blocks for messages to Parn and Ming.

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

/** Why a sheet cannot be booked: the bot does not know which branch or day it is. */
const HELD = [
  [/branch was not read/, () => 'no branch'],
  [/date was not read/, () => 'no date'],
  [/revenue was not read/, () => 'no Total'],
  [/January–March/, () => 'the date is in Jan to Mar 2026, which is closed'],
  [/was not open yet/, r => r.replace(/ was not open yet on .*/, ' was not open yet on that date')],
];

function misreadYear(record) {
  return Boolean(record && (record.issues || []).some(i => i.field === 'date_age'));
}

function heldWords(reasons, record) {
  const out = [];
  for (const reason of reasons || []) {
    // A misread year lands in a closed or not-yet-open month; the card already says check the year.
    if (misreadYear(record) && /January–March|was not open yet/.test(reason)) {
      if (!out.includes('the date looks wrong')) out.push('the date looks wrong');
      continue;
    }
    const hit = HELD.find(([re]) => re.test(reason));
    const text = hit ? hit[1](reason) : String(reason).slice(0, 80);
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

module.exports = { money, day, shortDay, less, alreadyText, heldWords, MONTHS };
