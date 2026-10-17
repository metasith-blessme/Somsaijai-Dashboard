const { observedNumber } = require('./fields');
const { classifyItem } = require('./forms');
const { monthTag, weekday, before, memoMonthConflict } = require('./dates');
const { redactText } = require('./redact');
const { OPENED } = require('./normalize');

const KEYWORDS = [
  { bucket: 'COGS', cat: 'Durain', test: /ทุเรียน|durian|durain/i },
  { bucket: 'COGS', cat: 'Sticky Rice', test: /ข้าวเหนียว|sticky\s*rice/i },
  { bucket: 'COGS', cat: 'Orange', test: /ส้ม|orange/i },
  { bucket: 'COGS', cat: 'Watermelon', test: /แตงโม|watermelon/i },
  { bucket: 'COGS', cat: 'Mango', test: /มะม่วง|mango/i },
  { bucket: 'COGS', cat: 'Apple', test: /แอปเปิ้ล|แอปเปิล|apple/i },
  { bucket: 'COGS', cat: 'Coconut', test: /มะพร้าว(?!อ่อน)|coconut/i },
  { bucket: 'COGS', cat: 'Guava', test: /ฝรั่ง|guava/i },
  { bucket: 'COGS', cat: 'Pineapple', test: /สับปะรด|pineapple/i },
  { bucket: 'COGS', cat: 'Young Coco', test: /young\s*coco|มะพร้าวอ่อน/i },
  { bucket: 'COGS', cat: 'Milk/Conden', test: /นมข้น|condensed/i },
  { bucket: 'COGS', cat: 'Packaging', test: /ฝา|แก้ว|หลอด|ถุง|packag/i },
  { bucket: 'COGS', cat: 'Ice', test: /น้ำแข็ง|\bice\b/i },
  { bucket: 'COGS', cat: 'Transportation', test: /ค่าส่ง|ขนส่ง|lalamove|freight/i },
  { bucket: 'OPEX', cat: 'Rental', test: /ค่าเช่า|rent/i },
  { bucket: 'OPEX', cat: 'Salary', test: /เงินเดือน|salary|ค่าแรง/i },
  { bucket: 'OPEX', cat: 'Utilities', test: /ค่าน้ำ|ค่าไฟ|utilities/i },
];

function menuCode(itemRaw) {
  return classifyItem(itemRaw).code;
}

function hold(held, entry) { held.push(entry); }

function salesRow(record, review, held) {
  const branch = record.branch && record.branch.state === 'observed' ? record.branch.value : null;
  const date = record.date && record.date.state === 'observed' ? record.date.value : null;
  const revenue = observedNumber(record.financials && record.financials.total_sales);
  const why = [];
  if (record.document_type === 'stock_report') {
    why.push('stock counts are kept in the review and are not booked as sales');
  }
  if (!branch) why.push('branch was not read');
  if (!date) why.push('date was not read');
  if (revenue == null && record.document_type !== 'stock_report') why.push('revenue was not read');
  if (date && before(date, '2026-04-01')) why.push('January–March is closed; this bot will not add rows there');
  if (branch && date && OPENED[branch] && before(date, OPENED[branch])) why.push(`${branch} was not open yet on ${date}`);
  const channel = (review.checks || []).find(c => c.record_id === record.record_id && c.rule === 'channels');
  if (channel && channel.status === 'fail') why.push('cash + scan does not equal the written total');
  for (const check of review.checks || []) {
    if (check.record_id === record.record_id && check.status === 'fail' && check.rule !== 'channels') why.push(check.reason);
  }
  for (const issue of record.issues || []) {
    if (issue.field === 'total_sales' || issue.field === 'date' || issue.field === 'branch' || issue.field === 'second_reading' || issue.field === 'extraction') {
      why.push(issue.issue);
    }
  }
  if (why.length) {
    hold(held, { source_id: record.record_id, branch, date, reasons: [...new Set(why)] });
    return null;
  }
  if (record.document_type !== 'sales_report' && record.document_type !== 'closing_cash') {
    hold(held, { source_id: record.record_id, branch, date, reasons: [`${record.document_type} is not a sales row`] });
    return null;
  }

  const cashIssue = (record.issues || []).some(i => i.field === 'cash_sales');
  const scanIssue = (record.issues || []).some(i => i.field === 'scan_sales');
  const cash = cashIssue ? null : observedNumber(record.financials.cash_sales);
  const scan = scanIssue ? null : observedNumber(record.financials.scan_sales);
  const row = {
    branch, date, day: weekday(date), revenue,
    note: `LINE ${review.batch_id} sha256:${(record.source_ids[0] && review.sources.find(s => s.source_id === record.source_ids[0])?.sha256 || '').slice(0, 12)}`,
  };
  // Empty when unknown. Never substitute revenue - cash.
  if (cash != null) row.cash = cash;
  if (scan != null) row.scan = scan;
  const exp = observedNumber(record.financials.total_expense);
  if (exp != null) row.exp = exp;

  const cups = {};
  let cupsUncertain = false;
  for (const item of record.sales_items || []) {
    if (item.struck) continue;
    const code = menuCode(item.item_raw);
    const q = observedNumber(item.qty);
    if (!code) {
      if (q != null || observedNumber(item.amount) != null) cupsUncertain = true;
      continue;
    }
    if (item.uncertain || q == null) { cupsUncertain = true; continue; }
    cups[code] = (cups[code] || 0) + q;
  }
  // Premium orange is a subset of orange in the books. Two separate rows do not
  // say which one already includes the other, so the counts stay in the review.
  if (cups.or && cups.or_100) cupsUncertain = true;
  const tot = observedNumber(record.financials && record.financials.total_cups);
  if (!cupsUncertain) {
    for (const [code, value] of Object.entries(cups)) row[code] = value;
    if (tot != null) row.tot = tot;
  } else {
    row.note += ' | some cup counts were uncertain and were not written';
  }
  return { month: monthTag(date), row };
}

function expenseRows(doc, review, held) {
  const branch = doc.branch && doc.branch.state === 'observed' ? doc.branch.value : null;
  const date = doc.payment_date && doc.payment_date.state === 'observed' ? doc.payment_date.value : null;
  const amount = observedNumber(doc.payment_amount);
  const memo = (doc.memo_lines || []).join('\n');
  const reasons = [];
  if (!branch) reasons.push('paying branch was not read');
  if (!date) reasons.push('payment date was not read');
  if (amount == null) reasons.push('payment amount was not read');
  const status = doc.payment_status_raw || '';
  if (/ยกเลิก|ไม่สำเร็จ|cancel|fail/i.test(status)) reasons.push('transfer is not a completed payment');
  else if (!/สำเร็จ|success/i.test(status)) reasons.push('transfer status was not read as successful');
  if (memoMonthConflict(memo, date)) reasons.push('the memo names a different month than the payment date');
  if (/แบ่งกำไร|profit share|dividend/i.test(memo)) reasons.push('profit distribution is not an operating expense');
  const hits = KEYWORDS.filter(k => k.test.test(memo));
  const uniqueCats = [...new Set(hits.map(h => h.cat))];
  if (!reasons.length && uniqueCats.length === 0) reasons.push('the memo does not say what was bought');
  if (!reasons.length && uniqueCats.length > 1) {
    const items = (doc.items || []).filter(item => item && typeof item.line_amount === 'number' && item.item_raw);
    const check = (review.checks || []).find(c => c.record_id === doc.source_id && c.rule === 'slip_allocation');
    if (!items.length || !check || check.status !== 'pass') {
      reasons.push('mixed purchase has no line amounts that add up to the payment');
    } else {
      const split = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemHits = KEYWORDS.filter(k => k.test.test(String(item.item_raw)));
        if (itemHits.length !== 1) {
          hold(held, { source_id: doc.source_id, branch, date, reasons: [`could not classify a line on this mixed slip`] });
          return [];
        }
        split.push({
          idx: `${doc.sha256.slice(0, 8)}-${i + 1}`,
          branch, date,
          bucket: itemHits[0].bucket,
          cat: itemHits[0].cat,
          desc: redactText(`${review.batch_id} ${item.item_raw}`).slice(0, 180),
          amt: item.line_amount,
        });
      }
      return split;
    }
  }
  if (reasons.length) {
    hold(held, { source_id: doc.source_id, branch, date, reasons: [...new Set(reasons)] });
    return [];
  }
  const hit = hits[0];
  return [{
    idx: doc.sha256.slice(0, 12),
    branch, date,
    bucket: hit.bucket,
    cat: hit.cat,
    desc: redactText(`${review.batch_id} ${(doc.memo_lines || []).join(' / ')}`).slice(0, 180),
    amt: amount,
  }];
}

/**
 * Turn a review artifact into safe-importer change lists.
 * Rows that are still uncertain are returned in `held` and are not imported.
 */
function buildChangePlan(review) {
  const held = [];
  const grouped = new Map();
  for (const record of review.records || []) {
    const built = salesRow(record, review, held);
    if (!built) continue;
    const key = built.row.branch + '|' + built.row.date;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ record, built });
  }
  const sales = [];
  for (const items of grouped.values()) {
    if (items.length === 1) {
      sales.push(items[0].built);
      continue;
    }
    for (const item of items) {
      hold(held, {
        source_id: item.record.record_id,
        branch: item.built.row.branch,
        date: item.built.row.date,
        reasons: ['two or more sales photos for the same branch and date — none of them were imported'],
      });
    }
  }
  const expenseRowsFlat = [];
  for (const doc of review.expense_documents || []) {
    expenseRowsFlat.push(...expenseRows(doc, review, held));
  }
  const byMonth = new Map();
  for (const item of sales) {
    if (!byMonth.has(item.month)) byMonth.set(item.month, []);
    byMonth.get(item.month).push(item.row);
  }
  const salesLists = [...byMonth.entries()].map(([month, rows]) => ({
    batch_id: review.batch_id,
    month,
    rows,
  }));
  const expenseList = expenseRowsFlat.length ? { batch_id: review.batch_id, rows: expenseRowsFlat } : null;
  return { salesLists, expenseList, held };
}

module.exports = { buildChangePlan, menuCode };
