const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const THAI_MONTHS = {
  'ม.ค.': 1, 'มกราคม': 1, 'ก.พ.': 2, 'กุมภาพันธ์': 2, 'มี.ค.': 3, 'มีนาคม': 3,
  'เม.ย.': 4, 'เมษายน': 4, 'พ.ค.': 5, 'พฤษภาคม': 5, 'มิ.ย.': 6, 'มิถุนายน': 6,
  'ก.ค.': 7, 'กรกฎาคม': 7, 'ส.ค.': 8, 'สิงหาคม': 8, 'ก.ย.': 9, 'กันยายน': 9,
  'ต.ค.': 10, 'ตุลาคม': 10, 'พ.ย.': 11, 'พฤศจิกายน': 11, 'ธ.ค.': 12, 'ธันวาคม': 12,
};

function calendarOk(d, m, y) {
  if (!d || !m || !y || m < 1 || m > 12 || y < 2019 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function pad(n) { return String(n).padStart(2, '0'); }

const DATE_AGE_DAYS = 60;

/**
 * Normalize a written date.
 * A Buddhist year (>= 2400) becomes Gregorian by subtracting 543.
 * A two-digit year is 20xx (1/10/26 is 01/10/2026). An impossible day stays null.
 */
function normalizeDate(raw) {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return { raw_text: null, value: null, state: 'missing' };
  const numeric = text.match(/(\d{1,2})\s*[./\-]\s*(\d{1,2})\s*[./\-]\s*(\d{2,4})/);
  if (!numeric) return { raw_text: text, value: null, state: 'ambiguous', reason: 'date was not a calendar day' };
  const d = Number(numeric[1]);
  const m = Number(numeric[2]);
  let y = Number(numeric[3]);
  if (numeric[3].length === 2) y += 2000;
  if (y >= 2400) y -= 543;
  if (!calendarOk(d, m, y)) {
    return { raw_text: text, value: null, state: 'illegible', reason: 'impossible calendar date' };
  }
  return { raw_text: text, value: `${pad(d)}/${pad(m)}/${y}`, state: 'observed' };
}

function todayStamp(now) {
  const date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = type => Number(parts.find(part => part.type === type).value);
  return Date.UTC(pick('year'), pick('month') - 1, pick('day'));
}

/** A usable date that is in the future, or more than 60 days old, still needs a look. */
function dateAgeIssue(ddmmyyyy, now) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  if (!match) return null;
  const day = Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const age = Math.round((todayStamp(now) - day) / 86400000);
  if (age < 0) return `date ${ddmmyyyy} is in the future`;
  if (age > DATE_AGE_DAYS) return `date ${ddmmyyyy} is more than ${DATE_AGE_DAYS} days old`;
  return null;
}

function monthTag(ddmmyyyy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  if (!m) return null;
  return MONTHS[Number(m[2]) - 1] + m[3].slice(2);
}

function weekday(ddmmyyyy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  if (!m) return '';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dt = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return names[dt.getUTCDay()];
}

function before(ddmmyyyy, isoDay) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy || '');
  if (!m) return false;
  const stamp = `${m[3]}-${m[2]}-${m[1]}`;
  return stamp < isoDay;
}

/** If the memo names a month and it is not the payment month, return that name. */
function memoMonthConflict(memoText, paymentDate) {
  const tag = monthTag(paymentDate);
  if (!tag || !memoText) return null;
  const payMonth = Number(/^(\d{2})\/(\d{2})\//.exec(paymentDate)[2]);
  for (const [name, num] of Object.entries(THAI_MONTHS)) {
    if (memoText.includes(name) && num !== payMonth) return name;
  }
  return null;
}

module.exports = { normalizeDate, monthTag, weekday, before, memoMonthConflict, calendarOk, dateAgeIssue, DATE_AGE_DAYS };
