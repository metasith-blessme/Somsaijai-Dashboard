/**
 * The Thai note staff get when a sheet could not be read in full.
 * One note per photo set, sent with the photo's reply token (free).
 * Ming's and Parn's card is unchanged.
 */
const { bookableNumber } = require('./fields');
const { money } = require('./words');

const OPEN = ['missing', 'illegible', 'ambiguous'];
const isSales = r => r && (r.document_type === 'sales_report' || r.document_type === 'closing_cash');

function moneyGap(label, field) {
  if (!field || field.state === 'observed' || field.state === 'derived') return null;
  if (field.state === 'ambiguous') {
    const seen = [bookableNumber(field), ...(field.alternatives || [])]
      .filter(v => typeof v === 'number' && isFinite(v));
    const uniq = [...new Set(seen)];
    if (uniq.length >= 2) return `${label} อ่านได้ ${uniq.slice(0, 3).map(money).join(' หรือ ')}`;
    return label;
  }
  return OPEN.includes(field.state) ? label : null;
}

function unreadItemRows(record) {
  return (record.sales_items || []).filter(i => i && !i.struck
    && ((i.qty && ['illegible', 'ambiguous'].includes(i.qty.state)) || (i.amount && ['illegible', 'ambiguous'].includes(i.amount.state)))).length;
}

function unreadStockRows(record) {
  return (record.stock_items || []).filter(r => r && (r.uncertain || (r.qty && ['illegible', 'ambiguous'].includes(r.qty.state)))).length;
}

function sheetName(record, n) {
  const branch = record.branch && record.branch.state === 'observed' ? record.branch.value : record.branch_hint;
  const m = /^(\d{2})\/(\d{2})\/\d{4}$/.exec(String(record.date && record.date.state === 'observed' ? record.date.value : ''));
  const date = m ? `${Number(m[1])}/${Number(m[2])}` : null;
  const kind = record.document_type === 'stock_report' ? 'ใบสต็อก' : 'ใบยอด';
  const bits = [kind, branch, date].filter(Boolean);
  return bits.length > 1 ? bits.join(' ') : `${kind} รูปที่ ${n}`;
}

/** What could not be read on one sheet, in staff words. Empty when it read cleanly. */
function gapsOf(record) {
  if (record.document_type === 'unreadable') return { whole: true, gaps: [] };
  const gaps = [];
  const blurry = /poor|low|blur|illegible|cut|crop/i.test(String(record.image_quality || ''));
  if ((!record.branch || record.branch.state !== 'observed') && !record.branch_hint) gaps.push('สาขา');
  if (!record.date || record.date.state !== 'observed') gaps.push('วันที่');
  if (isSales(record)) {
    const fin = record.financials || {};
    const shop = record.form_template === 'daily_shop_report';
    for (const [label, field] of [
      ['ยอดรวม (Total)', fin.total_sales],
      [shop ? 'เงินสดสุทธิ (Net cash)' : 'เงินสด (Cash)', fin.cash_sales],
      ['สแกน (Scan)', fin.scan_sales],
    ]) {
      const gap = moneyGap(label, field);
      if (gap) gaps.push(gap);
    }
    const ice = record.other && record.other.ice;
    if (shop && ice && ['illegible', 'ambiguous'].includes(ice.state)) gaps.push(moneyGap('ค่าน้ำแข็ง (Ice)', ice));
    const rows = unreadItemRows(record);
    if (rows) gaps.push(`รายการสินค้า ${rows} แถว`);
  } else if (record.document_type === 'stock_report') {
    const rows = unreadStockRows(record);
    if (rows) gaps.push(`จำนวนสต็อก ${rows} แถว`);
  } else {
    return { whole: false, gaps: [] };
  }
  return { whole: false, blurry, gaps };
}

function unreadFieldsNote(review) {
  const blocks = [];
  let n = 0;
  for (const record of (review && review.records) || []) {
    n += 1;
    const { whole, blurry, gaps } = gapsOf(record);
    if (whole) { blocks.push(`รูปที่ ${n} อ่านไม่ได้เลย`); continue; }
    if (!gaps.length) continue;
    const head = `${sheetName(record, n)} อ่านไม่ชัด ${gaps.join(', ')}`;
    blocks.push(blurry ? `${head} (รูปเบลอหรือถ่ายไม่ครบแผ่น)` : head);
  }
  if (!blocks.length) return '';
  return [
    ...blocks,
    'รบกวนถ่ายรูปใหม่ให้ชัดและเห็นครบทั้งแผ่น แล้วส่งอีกครั้ง หรือพิมพ์ตัวเลขช่องนั้นส่งมาในแชทนี้ได้เลย',
  ].join('\n');
}

module.exports = { unreadFieldsNote, gapsOf };
