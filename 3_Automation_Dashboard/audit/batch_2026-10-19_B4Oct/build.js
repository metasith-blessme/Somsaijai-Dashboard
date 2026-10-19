// node build.js [--undated=hold|DD]   -> b4_oct26_sales_change_list.json + table.md
const fs = require('fs');
const S = require('./sheets.json').days;
const arg = (process.argv.find(a => a.startsWith('--undated=')) || '--undated=hold').split('=')[1];
const MAP = { 'Orange': 'or', 'Orange no ice': 'or', 'Watermelon': 'wm', 'Watermelon big': 'wm', 'Watermelon no ice': 'wm',
  'Apple': 'ap', 'Apple no ice': 'ap', 'Mango': 'mg', 'Mango no ice': 'mg', 'Guava': 'guava', 'Guava no ice': 'guava',
  'Pineapple': 'pineapple', 'Mangosteen': null, 'Mangosteen no ice': null, 'Grape': null, 'Pear': null, 'Pomegranate': null };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const rows = [], tab = [];
for (const key of Object.keys(S).sort()) {
  const d = S[key];
  let dd = key;
  if (key === 'UNDATED') { if (arg === 'hold') { tab.push({ key, d, held: true }); continue; } dd = arg.padStart(2, '0'); if (S[dd]) throw new Error('undated sheet cannot go on ' + dd + ': that date already has a sheet'); }
  const date = `${dd}/10/2026`, day = DAYS[new Date(Date.UTC(2026, 9, +dd)).getUTCDay()];
  let cashC = 0, scanC = 0, tot = 0, or100 = 0; const cups = {}, extras = {}, flags = [];
  for (const [name, price, c, s] of d.items) {
    if (!(name in MAP)) throw new Error('unmapped item ' + name + ' on ' + key);
    cashC += price * c; scanC += price * s; tot += c + s;
    const k = MAP[name]; if (k) cups[k] = (cups[k] || 0) + c + s; else extras[name] = (extras[name] || 0) + c + s;
    if (name === 'Orange no ice') or100 += c + s;
  }
  const cash = d.book_cash != null ? d.book_cash : (d.after_ice ? d.w_cash + d.ice : d.w_cash);          // before-ice cash
  const scan = d.w_scan, revenue = cash + scan;
  if (d.after_ice) flags.push(`sheet totals are after ice (cash ${d.w_cash}, grand ${d.w_grand}); ice ${d.ice} added back`);
  if (d.w_grand == null) flags.push(`no grand total written; cash ${d.w_cash} + QR ${d.w_scan} = ${revenue}`);
  else if (!d.after_ice && d.w_grand !== d.w_cash + d.w_scan && d.w_grand !== revenue) flags.push(`written grand ${d.w_grand} but cash ${d.w_cash} + QR ${d.w_scan} = ${d.w_cash + d.w_scan}; booked ${revenue}`);
  if (cashC !== cash) flags.push(`cash items ${cashC} vs ${d.book_cash != null ? "booked" : "written"} ${cash} (${cash - cashC > 0 ? '+' : ''}${cash - cashC})`);
  if (scanC !== scan) flags.push(`QR items ${scanC} vs written ${scan} (${scan - scanC > 0 ? '+' : ''}${scan - scanC})`);
  if (key === 'UNDATED') flags.push(`UNDATED sheet booked as ${date} on Parn's word`);
  if (d.branch_raw !== 'B-4' && d.branch_raw !== 'B4') flags.push(`branch written "${d.branch_raw ?? 'blank'}"`);
  if (d.ice_note) flags.push(d.ice_note);
  if (d.parn_decision) flags.push(d.parn_decision);
  if (d.price_assumed) flags.push('price assumed: ' + d.price_assumed);
  const exT = Object.entries(extras).map(([n, q]) => `${n} ${q}`).join(', ');
  const row = { branch: 'B4', date, day, revenue, cash, scan, exp: d.ice,
    or: cups.or || 0, wm: cups.wm || 0, mg: cups.mg || 0, ap: cups.ap || 0, guava: cups.guava || 0, pineapple: cups.pineapple || 0 };
  if (or100) row.or_100 = or100;
  row.tot = tot;
  row.note = `Parn photo ${d.src} (B4 Oct26 Daily Sales Record${key === 'UNDATED' ? ', undated sheet' : ''}) | before ice; ice ${d.ice} in Expenses` +
    (exT ? ` | not in fruit columns (in Total Cups only): ${exT}` : '') + (flags.length ? ' | CHECK: ' + flags.join('; ') : '');
  rows.push(row); tab.push({ key, date, day, d, cash, scan, revenue, cashC, scanC, tot, flags });
}
const sum = k => rows.reduce((t, r) => t + r[k], 0);
fs.writeFileSync('b4_oct26_sales_change_list.json', JSON.stringify({ batch_id: `manual_B4_Oct26_parn_photos_undated-${arg}`, month: 'Oct26', rows }, null, 2));
const f = n => n.toLocaleString('en-US');
let md = '| Date | Branch written | Cash (before ice) | QR | **Gross (book)** | Ice | Cups | Items vs written | Notes |\n|---|---|---:|---:|---:|---:|---:|---|---|\n';
for (const t of tab) {
  if (t.held) { { const d=t.d; let c=0,s2=0,q=0; for (const [,p,a,b] of d.items){c+=p*a;s2+=p*b;q+=a+b;} md += `| **UNDATED** | blank | ${f(d.w_cash)} | ${f(d.w_scan)} | *(${f(d.w_grand)} held)* | ${d.ice} | ${q} | ${c===d.w_cash&&s2===d.w_scan?'OK':'diff'} | no date/branch: Parn to say which day |\n`; } continue; }
  const dif = [t.cashC !== t.cash ? `cash ${t.cash - t.cashC > 0 ? '+' : ''}${t.cash - t.cashC}` : '', t.scanC !== t.scan ? `QR ${t.scan - t.scanC > 0 ? '+' : ''}${t.scan - t.scanC}` : ''].filter(Boolean).join(', ') || 'OK';
  const nt = t.flags.filter(x => !/^branch written|^cash items|^QR items/.test(x)).join('; ');
  md += `| ${t.key === 'UNDATED' ? 'UNDATED→' : ''}${t.date.slice(0, 2)} Oct (${t.day}) | ${t.d.branch_raw ?? 'blank'} | ${f(t.cash)} | ${f(t.scan)} | **${f(t.revenue)}** | ${t.d.ice} | ${t.tot} | ${dif} | ${nt} |\n`;
}
md += `| **Total** | | **${f(sum('cash'))}** | **${f(sum('scan'))}** | **${f(sum('revenue'))}** | **${f(sum('exp'))}** | **${f(sum('tot'))}** | | ${rows.length} days |\n`;
fs.writeFileSync('table.md', md);
console.log(`undated=${arg}: ${rows.length} rows, revenue ${sum('revenue')}, cash ${sum('cash')}, scan ${sum('scan')}, exp ${sum('exp')}, cups ${sum('tot')}`);
