const crypto = require('crypto');
const { observedNumber } = require('./fields');
const { buildChangePlan } = require('./adapter');
const { classifyItem, handwritingFlags } = require('./forms');
const { money, day, shortDay, less, heldWords } = require('./words');

const MAX_FLAGS = 5;

function reviewToken(batchId, secret) {
  return crypto.createHmac('sha256', secret).update(`review:${batchId}`).digest('hex');
}

const isSales = record => record && (record.document_type === 'sales_report' || record.document_type === 'closing_cash');
const num = field => observedNumber(field);

function amountText(field) {
  if (!field || field.state === 'missing') return null;
  if (num(field) != null) return money(num(field));
  const alt = (field.alternatives || []).filter(v => v != null);
  return alt.length ? `${alt.map(money).join(' or ')}?` : 'unclear';
}

/** "Orange Cup (Regular) [or]" -> "Orange Cup (Regular)". */
function itemName(raw) {
  return String(raw || 'Item').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim() || 'Item';
}

/** Cups on a row: the total column, or cash + scan tallies when that is blank. */
function cupsOf(item) {
  const qty = num(item.qty);
  if (qty != null) return qty;
  const cash = num(item.cash_qty);
  const scan = num(item.scan_qty);
  return cash == null && scan == null ? null : (cash || 0) + (scan || 0);
}

function unreadRows(record) {
  return (record.sales_items || []).filter(i => i && !i.struck && cupsOf(i) == null && num(i.amount) == null
    && ((i.qty && ['illegible', 'ambiguous'].includes(i.qty.state)) || (i.amount && ['illegible', 'ambiguous'].includes(i.amount.state)))).length;
}

/** One line per product that sold: cups and baht, with a hand-changed price. */
function itemLines(record) {
  const lines = [];
  for (const item of record.sales_items || []) {
    if (!item || item.struck) continue;
    const qty = cupsOf(item);
    const amount = num(item.amount);
    if (qty == null && amount == null) continue;
    const bits = [`${itemName(item.item_raw)}${item.handwritten ? ' (written in)' : ''}`];
    bits.push(qty != null ? `${qty}` : 'qty?');
    if (amount != null) bits.push(`฿${money(amount)}`);
    let line = bits.join(' · ');
    if (item.price_overridden_from != null && item.price_overridden_to != null) {
      line += ` (price ${item.price_overridden_from}→${item.price_overridden_to})`;
    }
    if (item.uncertain) line += ' (unclear)';
    lines.push(line);
  }
  return lines;
}

function checkFor(review, record, rule) {
  return (review.checks || []).find(c => c.record_id === record.record_id && c.rule === rule);
}

/** Cups and baht from the item rows, set against the written Total. */
function itemsLine(review, record) {
  const items = (record.sales_items || []).filter(i => i && !i.struck);
  const cups = items.map(cupsOf).filter(n => n != null).reduce((a, b) => a + b, 0);
  const check = checkFor(review, record, 'line_sum');
  if (!check || check.status === 'not_testable') return { line: cups ? `Items: ${cups} cups` : null, flag: null };
  const head = `Items: ${cups} cups · ฿${money(check.expected)}`;
  if (check.status === 'pass') return { line: `${head} ✓ matches Total`, flag: null };
  return {
    line: head,
    flag: `Items add to ฿${money(check.expected)}, ฿${money(Math.abs(check.difference))} ${less(check.difference)} than the Total`,
  };
}

/**
 * The closing box as written, and Net cash + Scan (+ Ice) against Total as
 * information only. Booking still follows the channels check in validate.js.
 */
function closingLines(record) {
  const fin = record.financials || {};
  const ice = record.other && record.other.ice;
  const parts = [];
  const cash = amountText(fin.cash_sales);
  const scan = amountText(fin.scan_sales);
  const iceText = amountText(ice);
  const change = amountText(fin.opening_cash);
  if (cash) parts.push(`${netCashForm(record) ? 'Net cash' : 'Cash'} ${cash}`);
  if (scan) parts.push(`Scan ${scan}`);
  if (iceText) parts.push(`Ice ${iceText}`);
  if (change) parts.push(`Change ${change}`);
  const lines = parts.length ? [parts.join(' · ')] : [];
  return lines;
}

const netCashForm = record => record.form_template === 'daily_shop_report';

/**
 * Parn's rule (3 Nov 2026): on the Daily Shop Report the Total is Net cash + Scan - Ice.
 * The Daily Sales Record has gross Cash, so there Total is Cash + Scan. Display and flag only;
 * what gets booked still follows validate.js and adapter.js.
 */
function totalCheck(record) {
  if (!netCashForm(record)) return plainTotalCheck(record);
  const fin = record.financials || {};
  const c = num(fin.cash_sales);
  const s = num(fin.scan_sales);
  const t = num(fin.total_sales);
  if (c == null || s == null) return { line: null, flag: null };
  const ice = num(record.other && record.other.ice) || 0;
  const x = c + s - ice;
  const line = `Total check: Net cash + Scan - Ice = ${money(x)}${t === x ? ' ✓' : ''}`;
  const flag = t != null && t !== x ? `Written total ${money(t)} should be ${money(x)} (Net cash + Scan - Ice)` : null;
  return { line, flag };
}

function plainTotalCheck(record) {
  const fin = record.financials || {};
  const c = num(fin.cash_sales);
  const s = num(fin.scan_sales);
  const t = num(fin.total_sales);
  if (c == null || s == null) return { line: null, flag: null };
  return {
    line: `Total check: Cash + Scan = ${money(c + s)}${t === c + s ? ' ✓' : ''}`,
    flag: t != null && t !== c + s ? `Written total ${money(t)} should be ${money(c + s)} (Cash + Scan)` : null,
  };
}

function mismatchFlags(review, record) {
  const flags = [];
  for (const check of review.checks || []) {
    if (check.record_id !== record.record_id || check.status !== 'fail') continue;
    if (check.rule === 'net') flags.push(`Total minus expenses is ฿${money(check.expected)}, the sheet says ฿${money(check.observed)}`);
    if (check.rule === 'row_amount') flags.push(`${itemName(check.item)}: qty × price is ฿${money(check.expected)}, the sheet says ฿${money(check.observed)}`);
    if (check.rule === 'row_qty') flags.push(`${itemName(check.item)}: cash + scan cups is ${check.expected}, the sheet says ${check.observed}`);
    if (check.rule === 'note_equation') flags.push(`Note math is off: ${String(check.reason).split(': ').slice(1).join(': ')}`);
    if (check.rule === 'note_vs_payment') flags.push(`Note starts from ${money(check.observed)}, not the cash or the Total`);
  }
  return flags;
}

function handwritingLines(record) {
  const rows = [];
  const labels = [];
  const flavors = [];
  const noQty = [];
  for (const item of record.sales_items || []) {
    if (item && item.handwritten && !item.struck && cupsOf(item) == null && num(item.amount) == null) noQty.push(itemName(item.item_raw));
    for (const flag of handwritingFlags(item)) {
      const name = itemName(item.item_raw);
      if (flag.kind === 'row_shift' && item.struck) rows.push(name);
      if (flag.kind === 'label_shift') labels.push(`${name} (was ${item.label_crossed_out})`);
      if (flag.kind === 'flavor_shift') flavors.push(name);
    }
  }
  const out = [];
  if (noQty.length) out.push(`Written in with no qty: ${noQty.join(', ')}`);
  if (rows.length) out.push(`Crossed out by hand: ${rows.join(', ')}`);
  if (labels.length) out.push(`Product name changed by hand: ${labels.join(', ')}`);
  if (flavors.length) out.push(`Extra flavour written in: ${flavors.join(', ')}`);
  return out;
}

const UNCLEAR = [
  [/rotat/i, null],
  [/staff name/i, 'staff name'],
  [/opening cash/i, 'change'],
  [/tally|cup count|total qty/i, 'cup counts'],
  [/expense/i, 'expenses'],
  [/cash total|extra mark/i, 'cash'],
];

function issueFlags(record) {
  const flags = [];
  if (record.branch_hint && (!record.branch || record.branch.state !== 'observed')) {
    flags.push(`No branch on the sheet. The LINE group is ${record.branch_hint}`);
  }
  if (record.branch_hint && record.branch && record.branch.state === 'observed' && record.branch.value !== record.branch_hint) {
    flags.push(`Sheet says ${record.branch.value}, but the LINE group is ${record.branch_hint}`);
  }
  for (const issue of record.issues || []) {
    const text = String(issue.issue || '');
    if (issue.field === 'date_age' || /more than \d+ days old/.test(text)) flags.push(`Date reads ${day(record.date && record.date.value)}. Check the year`);
    else if (/in the future/.test(text)) flags.push(`Date reads ${day(record.date && record.date.value)}, which is in the future`);
    else if (issue.field === 'extraction') flags.push('Could not read the photo');
    else if (issue.field === 'second_reading') flags.push('Could not double-check the numbers');
    else if (/disagree|did not confirm/i.test(text)) {
      const detail = (text.match(/\((.+)\)/) || [])[1];
      flags.push(`Two readings disagree${detail ? ` (${detail})` : ''}`);
    }
  }
  const unclear = [];
  for (const text of record.model_uncertainties || []) {
    const hit = UNCLEAR.find(([re]) => re.test(text));
    const word = hit ? hit[1] : null;
    if (word && !unclear.includes(word)) unclear.push(word);
  }
  const rows = unreadRows(record);
  if (rows) unclear.push(`${rows} item row${rows > 1 ? 's' : ''}`);
  if (unclear.length) flags.push(`Hard to read: ${unclear.join(', ')}`);
  return flags;
}

/** One sheet: head, items, closing box, flags, and whether it books. */
function salesSection(review, record, held) {
  const fin = record.financials || {};
  const branch = record.branch && record.branch.state === 'observed' && record.branch.value ? record.branch.value : 'Branch?';
  const total = amountText(fin.total_sales);
  const head = `${branch} · ${day(record.date && record.date.value)} · Total ${total ? `฿${total}` : 'unclear'}`;
  const items = itemsLine(review, record);
  const check = totalCheck(record);
  const flags = check.flag ? [check.flag] : [];
  if (items.flag) flags.push(items.flag);
  flags.push(...mismatchFlags(review, record), ...handwritingLines(record), ...issueFlags(record));
  const iceField = record.other && record.other.ice;
  if (num(iceField) != null) flags.push(`Ice ฿${money(num(iceField))} is not booked as an expense`);
  const entry = held.find(h => h.source_id === record.record_id);
  const notBooked = entry ? heldWords(entry.reasons, record) : [];
  return {
    branch, date: record.date && record.date.value, total: num(fin.total_sales),
    lines: [head, ...itemLines(record), ...(items.line ? [items.line] : []), ...closingLines(record), ...(check.line ? [check.line] : [])],
    flags,
    notBooked: entry ? notBooked : null,
    checkFirst: Boolean(check.flag || items.flag || mismatchFlags(review, record).length),
  };
}

function actionText(sections, booked, expenses) {
  if (booked.length) {
    const parts = booked.map(s => `${s.branch} ${shortDay(s.date)} ฿${money(s.total)}`);
    if (expenses.length) parts.push(`${expenses.length} expense${expenses.length > 1 ? 's' : ''}`);
    const lead = booked.some(s => s.checkFirst) ? 'Check the ⚠ lines. Approve books the written Total' : 'Approve books';
    let text = `${lead} ${parts.join(' and ')}. Reject asks staff to resend.`;
    if (text.length > 160) text = `${lead} ${booked.length} days. Reject asks staff to resend.`;
    return text;
  }
  if (expenses.length) return `Approve books ${expenses.length} expense${expenses.length > 1 ? 's' : ''}. Reject drops ${expenses.length > 1 ? 'them' : 'it'}.`;
  if (sections.length) return 'This cannot be booked (see ✗). Tap Reject and ask staff to send the photo again.';
  return 'Nothing to book here. Tap Reject to clear it.';
}

function formatSummary(review, { publicUrl, channelSecret } = {}) {
  const plan = buildChangePlan(review);
  const booked = new Set();
  for (const list of plan.salesLists) for (const row of list.rows) booked.add(`${row.branch}|${row.date}`);
  const sections = (review.records || []).filter(isSales).map(record => salesSection(review, record, plan.held));
  const out = [];
  for (const s of sections) {
    if (out.length) out.push('');
    out.push(...s.lines);
    for (const flag of s.flags.slice(0, MAX_FLAGS)) out.push(`⚠ ${flag}`);
    if (s.flags.length > MAX_FLAGS) out.push(`⚠ ${s.flags.length - MAX_FLAGS} more on the details page`);
    if (s.notBooked && s.notBooked.length) out.push(`✗ Cannot book: ${s.notBooked.join('; ')}`);
  }
  const expenses = (plan.expenseList && plan.expenseList.rows) || [];
  for (const row of expenses) out.push(`Expense · ${row.branch} · ${day(row.date)} · ${row.cat} ฿${money(row.amt)}`);
  for (const h of plan.held.filter(h => !(review.records || []).some(r => r.record_id === h.source_id))) {
    out.push(`✗ Slip not booked: ${heldWords(h.reasons).join('; ') || 'unclear'}`);
  }
  const stockPhotos = (review.records || []).filter(r => r.document_type === 'stock_report').length;
  if (stockPhotos) out.push(`Also got ${stockPhotos} stock photo${stockPhotos > 1 ? 's' : ''}. ${stockPhotos > 1 ? 'They are' : 'It is'} in tonight's stock list.`);
  if (!out.length) out.push('No sales sheet found in these photos.');
  const bookedSections = sections.filter(s => !s.notBooked && booked.has(`${s.branch}|${s.date}`));
  let url = null;
  if (publicUrl && channelSecret) {
    url = `${publicUrl}/api/review?batch=${encodeURIComponent(review.batch_id)}&token=${reviewToken(review.batch_id, channelSecret)}`;
    out.push(`Details: ${url}`);
  }
  const text = out.join('\n').slice(0, 4800);
  const first = sections[0];
  const alt = first ? `${first.branch} ${shortDay(first.date)} · ฿${money(first.total)} to check` : 'Photos to check';
  const messages = [
    { type: 'text', text },
    {
      type: 'template',
      altText: alt.slice(0, 400),
      template: {
        type: 'buttons',
        text: actionText(sections, bookedSections, expenses).slice(0, 160),
        actions: [
          { type: 'postback', label: 'Approve', data: `action=approve&batch=${review.batch_id}`, displayText: 'Approve' },
          { type: 'postback', label: 'Reject', data: `action=reject&batch=${review.batch_id}`, displayText: 'Reject' },
        ],
      },
    },
  ];
  return { text, messages, plan, url, details: detailLines(review, sections) };
}

/** Everything the card leaves out, for the details page. */
function detailLines(review, sections) {
  const lines = [];
  for (const s of sections) if (s.flags.length > MAX_FLAGS) lines.push(...s.flags.slice(MAX_FLAGS).map(f => `⚠ ${f}`));
  const unmapped = [];
  for (const record of (review.records || []).filter(isSales)) {
    for (const item of record.sales_items || []) {
      if (item && item.item_raw && !item.struck && (num(item.qty) || num(item.amount))
        && !classifyItem(item.item_raw).code && !unmapped.includes(itemName(item.item_raw))) unmapped.push(itemName(item.item_raw));
    }
  }
  if (unmapped.length) lines.push(`No dashboard column (sales still count in the Total): ${unmapped.join(', ')}`);
  return lines;
}

function parsePostback(data) {
  const params = new URLSearchParams(String(data || ''));
  return { action: params.get('action'), batch: params.get('batch') };
}

module.exports = { formatSummary, parsePostback, reviewToken, baht: money, observedNumber };
