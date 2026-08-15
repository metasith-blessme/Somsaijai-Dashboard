// Monthly sheets do not share a layout: Jan-Jun put the header on row 2 (after a title and a
// blank), Jul puts it on row 1. Any hardcoded slice() silently eats real trading days.
// Find the header row, then take everything after it that parses as a date.
const XLSX = require('xlsx');

const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function parseDate(raw) {
  const m = String(raw ?? '').trim().match(DATE_RE);
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return { day: d, month: mo, year: y, key: `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

// At least three layouts exist in these workbooks: title/blank/header (Jan-Jun),
// title/header (Jul), and title/blank/data-with-no-header-at-all (B2 Mar26).
// So do not hunt for a header at all — take every row whose first cell is a date.
// Column order is stable across all of them.
// "Looks like a trading row" = several numeric cells. A title or header row has none, so an
// unstarted month reads as empty (correct) while a real data row we failed to date-parse
// trips the guard (also correct).
const DATA_LIKE_NUMERIC_CELLS = 3;
const looksLikeData = (r) => (r ?? []).filter((c) => typeof c === 'number').length >= DATA_LIKE_NUMERIC_CELLS;

// Returns [{ date, revenue, cash, scan, expenses, raw }] for real trading days only.
function dailyRows(sheet) {
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const out = [];
  for (const r of rows) {
    const date = parseDate(r[0]);
    if (!date) continue; // drops title, header, AVG/DAY, TOTAL and blank rows
    out.push({
      date,
      revenue: Number(r[2]) || 0,
      cash: Number(r[3]) || 0,
      expenses: Number(r[4]) || 0,
      scan: Number(r[6]) || 0,
      raw: r,
    });
  }
  // Data-shaped rows that produced no date mean the date format moved.
  // Fail loudly rather than quietly report a trading month as empty.
  if (!out.length && rows.some(looksLikeData)) {
    throw new Error('sheet has data rows but no parseable DD/MM/YYYY dates — layout changed');
  }
  return out;
}

module.exports = { dailyRows, parseDate };

if (require.main === module) {
  const assert = require('assert');
  // Layout A: title, blank, header (Jan-Jun).
  const a = XLSX.utils.aoa_to_sheet([
    ['title'], [], ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)', 'Expenses (฿)', 'CE', 'Scan/Transfer (฿)'],
    ['01/01/2026', 'Thu', 100, 60, 5, null, 40], ['AVG/DAY', '', 999],
  ]);
  // Layout B: title, header (Jul).
  const b = XLSX.utils.aoa_to_sheet([
    ['title'], ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)', 'Expenses (฿)', 'CE', 'Scan/Transfer (฿)'],
    ['01/07/2026', 'Wed', 200, 120, 10, null, 80],
  ]);
  assert.strictEqual(dailyRows(a).length, 1, 'layout A: one trading day, AVG/DAY excluded');
  assert.strictEqual(dailyRows(b).length, 1, 'layout B: header on row 1 must still be found');
  assert.strictEqual(dailyRows(b)[0].date.day, 1, 'layout B: 1 July must not be eaten');
  assert.strictEqual(dailyRows(a)[0].scan, 40);
  assert.strictEqual(dailyRows(b)[0].revenue, 200);
  // Layout C: title, blank, then data with no header row at all (B2 Mar26).
  const c = XLSX.utils.aoa_to_sheet([['title'], [], ['01/03/2026', 'Sun', 300, 180, 15, null, 120]]);
  assert.strictEqual(dailyRows(c).length, 1, 'layout C: headerless data must still be read');
  assert.strictEqual(dailyRows(c)[0].revenue, 300);
  // Unstarted month: title + header, no trading rows. Empty is the right answer, no throw.
  const empty = XLSX.utils.aoa_to_sheet([
    ['Som Sai Jai - August 2026'], [], ['Date', 'Day', 'Revenue (฿)', 'Cash (฿)'],
  ]);
  assert.strictEqual(dailyRows(empty).length, 0, 'unstarted month is empty, not an error');
  assert.strictEqual(dailyRows(XLSX.utils.aoa_to_sheet([[''], ['']])).length, 0);
  // Real data rows we failed to date-parse means the format moved — must not read as zero days.
  assert.throws(() => dailyRows(XLSX.utils.aoa_to_sheet([
    ['title'], ['2026-01-01', 'Thu', 100, 60, 5, 0, 40],
  ])), /layout changed/, 'an unparseable date format must fail loudly');
  console.log('sheet_rows self-check passed');
}
