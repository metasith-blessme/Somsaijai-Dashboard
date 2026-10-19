// Builds the B3 Oct26 change list from sheets.json (Daily Shop Report photos). Writes nothing in the repo.
// Usage: node build.js [--day12=hold|A10_B12|B12|both12]   (default hold = leave out both 12 Oct sheets)
// Booking follows B3 Sep26: revenue = Total sales, cash/scan = Closing summary, exp = Total expense,
// Volcano X -> X column, Orange Premium -> or_100 (separate), everything else (blended, mix, sticky rice,
// pear, grape, pomegranate, cold-pressed juice) counts only in Total Cups and is listed in the note.
const fs = require('fs');
const S = JSON.parse(fs.readFileSync(__dirname + '/sheets.json', 'utf8'));
const mode = (process.argv.find(a => a.startsWith('--day12=')) || '--day12=hold').split('=')[1];
if (!['hold', 'A10_B12', 'B12', 'both12'].includes(mode)) throw new Error('bad --day12 ' + mode);
const MAP = { 'Orange': 'or', 'Volcano Orange': 'or', 'Orange Premium': 'or_100', 'Watermelon': 'wm', 'Volcano Watermelon': 'wm',
  'Mango': 'mg', 'Volcano Mango': 'mg', 'Coconut': 'co', 'Apple': 'ap', 'Volcano Apple': 'ap', 'Guava': 'guava', 'Volcano Guava': 'guava',
  'Pineapple': 'pineapple', 'Volcano Pineapple': 'pineapple' };
const EXTRA = ['Mangosteen Blended', 'Mangosteen Lychee Blended', 'Rambutan Blended', 'Volcano Mix Fruit', 'Mango Sticky Rice',
  'Mango Sticky Rice (180)', 'Cold Pressed Mango Juice', 'Pear', 'Pear (80)', 'Grape', 'Pomegranate', 'Apple & Pear'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function rowFor(keys, dd) {
  const ds = keys.map(k => S.days[k]);
  const cups = {}, extras = {}; let tot = 0, items = 0;
  for (const d of ds) for (const [n, p, q] of d.items) {
    items += p * q; tot += q;
    if (MAP[n]) cups[MAP[n]] = (cups[MAP[n]] || 0) + q;
    else if (EXTRA.includes(n)) extras[n] = (extras[n] || 0) + q;
    else throw new Error('unmapped item ' + n + ' on ' + keys);
  }
  const sum = f => ds.reduce((a, d) => a + d[f], 0);
  const r = { branch: 'B3', date: `${dd}/10/2026`, day: DAYS[new Date(Date.UTC(2026, 9, +dd)).getUTCDay()],
    revenue: sum('total'), cash: sum('cash'), scan: sum('scan'), exp: sum('exp') };
  for (const k of ['or', 'or_100', 'wm', 'mg', 'co', 'ap', 'guava', 'pineapple']) r[k] = cups[k] || 0;
  r.tot = tot;
  const diff = items - r.revenue;
  const nonIce = ds.flatMap(d => d.exp_items).filter(e => !/^ice/i.test(e[0]));
  r.note = `Parn LINE photo ${ds.map(d => d.src.slice(0, 12)).join(' + ')} (B3 Daily Shop Report${keys.length > 1 ? ', 2 sheets' : ''}), hand-transcribed 2026-10-18` +
    (nonIce.length ? ` | exp incl. ${nonIce.map(e => e[0] + ' ' + e[1]).join(', ')}` : '') +
    (Object.keys(extras).length ? ` | not in fruit columns: ${Object.entries(extras).map(([k, v]) => k + ' ' + v).join(', ')}` : '') +
    (diff ? ` | CHECK: items ${items} vs total sales ${r.revenue} (${diff > 0 ? '+' : ''}${diff})` : '');
  return r;
}
const plan = [];
for (const k of Object.keys(S.days).sort()) {
  if (S.days[k].already_live || k.startsWith('12')) continue;
  plan.push([[k], k]);
}
if (mode === 'A10_B12') plan.push([['12A'], '10'], [['12B'], '12']);
if (mode === 'B12') plan.push([['12B'], '12']);
if (mode === 'both12') plan.push([['12A', '12B'], '12']);
const rows = plan.map(([keys, dd]) => rowFor(keys, dd)).sort((a, b) => a.date.localeCompare(b.date));
const out = { batch_id: `manual_B3_Oct26_parn_photos_day12-${mode}`, month: 'Oct26', rows };
fs.writeFileSync(__dirname + '/b3_oct26_sales_change_list.json', JSON.stringify(out, null, 2));
const rev = rows.reduce((a, r) => a + r.revenue, 0);
console.log(`mode ${mode}: ${rows.length} rows, revenue ${rev}, exp ${rows.reduce((a, r) => a + r.exp, 0)}`);
console.log(rows.map(r => `${r.date} ${r.revenue} cups ${r.tot}`).join('\n'));
