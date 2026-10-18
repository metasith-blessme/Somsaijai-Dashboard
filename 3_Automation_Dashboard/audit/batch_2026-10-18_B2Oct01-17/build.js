// Builds the B2 Oct 1-17 change list + review tables from sheets.json. Writes nothing in the repo.
const fs = require('fs');
const S = JSON.parse(fs.readFileSync(__dirname + '/sheets.json', 'utf8'));
const MAP = { 'Orange': 'or', 'Orange no ice': 'or', 'Watermelon': 'wm', 'Volcano Water': 'wm', 'Water M': 'wm', 'Melon (109)': 'wm',
  'Water (109)': 'wm', 'Watermelon no ice': 'wm', 'Apple': 'ap', 'Mango': 'mg', 'Coconut': 'co', 'Pineapple': 'pineapple',
  'Guava': 'guava', 'Volcano Guava': 'guava', 'Apple no ice': 'ap', 'Grape': null, 'Grape (120)': null, 'Pear': null, 'Pomegranate': null, 'Pome no ice': null };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmt = n => Number(n).toLocaleString('en-US');
const rows = [], review = [];
for (const dd of Object.keys(S.days).sort()) { const d = S.days[dd];
  const date = `${dd}/10/2026`;
  const day = DAYS[new Date(Date.UTC(2026, 9, +dd)).getUTCDay()];
  let cashC = 0, scanC = 0; const cups = {}; let tot = 0; let or100 = 0; const extras = {};
  for (const [name, price, c, s] of d.items) {
    if (!(name in MAP)) throw new Error('unmapped ' + name);
    cashC += price * c; scanC += price * s; tot += c + s;
    const code = MAP[name];
    if (code) cups[code] = (cups[code] || 0) + c + s; else extras[name] = (extras[name] || 0) + c + s;
    if (name === 'Orange no ice') or100 += c + s;
  }
  const exp = d.ice + d.other;
  const flags = [];
  if (d.cash + d.scan !== d.grand) flags.push(`cash+QR ${fmt(d.cash + d.scan)} != grand ${fmt(d.grand)}`);
  if (cashC !== d.cash) flags.push(`cash items ${fmt(cashC)} vs written ${fmt(d.cash)} (${cashC - d.cash > 0 ? '+' : ''}${fmt(cashC - d.cash)})`);
  if (scanC !== d.scan) flags.push(`QR items ${fmt(scanC)} vs written ${fmt(d.scan)} (${scanC - d.scan > 0 ? '+' : ''}${fmt(scanC - d.scan)})`);
  const row = { branch: 'B2', date, day, revenue: d.grand, cash: d.cash, scan: d.scan, exp };
  for (const k of ['or', 'wm', 'mg', 'co', 'ap', 'guava', 'pineapple']) row[k] = cups[k] || 0;
  if (or100) row.or_100 = or100;
  row.tot = tot;
  const extraTxt = Object.entries(extras).map(([k, v]) => `${k} ${v}`).join(', ');
  row.note = `Parn LINE photo ${S.src[dd]} (B2 Daily Sales Record ${dd}/10/26), hand-transcribed 2026-10-18` +
    (d.w_cash !== d.cash ? ` | sheet totals are after ice (cash ${d.w_cash}, grand ${d.w_grand}); booked before ice, ice in Expenses like B1` : '') + (extraTxt ? ` | not in fruit columns: ${extraTxt}` : '') + (flags.length ? ' | CHECK: ' + flags.join('; ') : '');
  rows.push(row);
  review.push({ dd, date, day, d, cashC, scanC, tot, exp, flags, cups, extras, or100 });
}
const cl = { batch_id: 'manual_B2_Oct26_01-17_parn_photos', month: 'Oct26', rows };
fs.writeFileSync(__dirname + '/b2_oct26_sales_change_list.json', JSON.stringify(cl, null, 2));

// review markdown
let md = `# B2 Daily Sales Record, 1-17 Oct 2026: review before publish\n\nBuilt 2026-10-18 from Parn's 17 LINE photos. Nothing published or committed.\n` +
  `Cash/revenue are booked **before ice** (ice goes to Expenses), same as B1. Where staff wrote totals after ice, the before-ice figure is used. Cup counts come from the tallies.\n\n## Compact table\n\n` +
  `| Date | Cash | QR | Grand total | Expenses | Flag |\n|---|---:|---:|---:|---:|---|\n`;
let T = { cash: 0, scan: 0, grand: 0, exp: 0 };
for (const r of review) {
  T.cash += r.d.cash; T.scan += r.d.scan; T.grand += r.d.grand; T.exp += r.exp;
  const short = r.flags.length ? r.flags.map(f => f.replace(/ items .* \((.*)\)/, ' off by $1').replace(/^cash /, 'cash ').replace(/^QR /, 'QR ')).join('; ') : 'OK';
  md += `| ${r.dd} Oct (${r.day}) | ${fmt(r.d.cash)} | ${fmt(r.d.scan)} | ${fmt(r.d.grand)} | ${fmt(r.exp)}${r.d.other ? ` (ice ${r.d.ice} + other ${r.d.other})` : ''} | ${short} |\n`;
}
md += `| **Total** | **${fmt(T.cash)}** | **${fmt(T.scan)}** | **${fmt(T.grand)}** | **${fmt(T.exp)}** | |\n\n`;
md += `## Per-day detail\n\nColumns: product, price, cash qty, QR qty, cash ฿, QR ฿.\n\n`;
for (const r of review) {
  md += `### ${r.dd} Oct 2026 (${r.day}), photo ${S.src[r.dd]}\n\n| Product | Price | Cash qty | QR qty | Cash ฿ | QR ฿ |\n|---|---:|---:|---:|---:|---:|\n`;
  for (const [n, p, c, s] of r.d.items) md += `| ${n} | ${p} | ${c} | ${s} | ${fmt(p * c)} | ${fmt(p * s)} |\n`;
  md += `| **Items total** | | | | **${fmt(r.cashC)}** | **${fmt(r.scanC)}** |\n| **Written on sheet** | | | | **${fmt(r.d.cash)}** | **${fmt(r.d.scan)}** |\n\n`;
  md += `- Grand total written: ${fmt(r.d.grand)} (items total ${fmt(r.cashC + r.scanC)})\n- Expenses: ice ${r.d.ice}${r.d.other ? `, ${r.d.other_desc}` : ''} = ${fmt(r.exp)}\n`;
  md += `- Cups to book: or ${r.cups.or || 0}${r.or100 ? ` (incl. ${r.or100} orange no-ice as Orange (100))` : ''}, wm ${r.cups.wm || 0}, ap ${r.cups.ap || 0}, mg ${r.cups.mg || 0}, co ${r.cups.co || 0}, pineapple ${r.cups.pineapple || 0}, guava ${r.cups.guava || 0}; total cups ${r.tot}` +
    (Object.keys(r.extras).length ? `; extras (no column): ${Object.entries(r.extras).map(([k, v]) => k + ' ' + v).join(', ')}` : '') + '\n';
  md += `- Result: ${r.flags.length ? '**' + r.flags.join('; ') + '**' : 'all math checks pass'}\n`;
  for (const n of r.d.notes) md += `- Note: ${n}\n`;
  md += '\n';
}
fs.writeFileSync(__dirname + '/review_body.md', md);
console.log(md.split('## Per-day')[0]);
