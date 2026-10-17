const { observedNumber } = require('./fields');

const ALBUM_HELP_TH = 'ส่งรูปในแชทนี้โดยตรง ไม่ต้องใส่ในอัลบั้ม บอทไม่เห็นรูปที่อยู่ในอัลบั้มกลุ่ม';

const MIXED = /volcano|blend|mixed|sticky\s*rice|ข้าวเหนียว|มังคุด|mangosteen|เงาะ|rambutan|ลิ้นจี่|lychee|ทับทิม|pomegranate|องุ่น|grape/i;

const CUPS = [
  { code: 'or_100', test: /ส้ม\s*100|premium\s*orange|orange\s*premium|orange\s*100|100%/i },
  { code: 'yco', test: /young\s*coco|มะพร้าวอ่อน/i },
  { code: 'or', test: /ส้ม|(?<!premium\s)(?<!volcano\s)orange/i },
  { code: 'wm', test: /แตงโม|watermelon/i },
  { code: 'mg', test: /มะม่วง|mango/i },
  { code: 'co', test: /มะพร้าว|coconut/i },
  { code: 'ap', test: /แอปเปิ้ล|แอปเปิล|(?<!pine)apple/i },
  { code: 'guava', test: /ฝรั่ง|guava/i },
  { code: 'pineapple', test: /สับปะรด|pineapple/i },
];

function classifyItem(itemRaw) {
  const text = String(itemRaw || '').trim();
  if (!text) return { code: null, reason: 'blank' };
  if (/ขวด|bottle/i.test(text)) return { code: null, reason: 'bottle' };
  if (/volcano/i.test(text)) return { code: null, reason: 'not_a_single_cup' };
  // These three printed drinks have their own cup columns, including the "Blended" names.
  if (/mangosteen.*lychee|lychee.*mangosteen|มังคุด.*ลิ้นจี่|ลิ้นจี่.*มังคุด/i.test(text)) {
    return { code: 'mangosteen_lychee', reason: 'mapped' };
  }
  if (/mangosteen|มังคุด/i.test(text)) return { code: 'mangosteen', reason: 'mapped' };
  if (/rambutan|เงาะ/i.test(text)) return { code: 'rambutan', reason: 'mapped' };
  if (MIXED.test(text)) return { code: null, reason: 'not_a_single_cup' };
  for (const row of CUPS) {
    if (row.test.test(text)) return { code: row.code, reason: 'mapped' };
  }
  return { code: null, reason: 'no_column' };
}

function formTemplate(extraction) {
  const named = extraction && extraction.form_template;
  if (named === 'daily_shop_report' || named === 'daily_sales_record') return named;
  const title = String((extraction && (extraction.title_raw || extraction.form_title)) || '');
  if (/daily\s*shop\s*report/i.test(title)) return 'daily_shop_report';
  if (/daily\s*sales\s*record/i.test(title)) return 'daily_sales_record';
  return null;
}

function moneyText(field) {
  if (!field || field.state === 'missing') return 'ไม่มีช่อง';
  if (field.state !== 'observed') {
    const alt = (field.alternatives || []).length ? ` (${field.alternatives.join(' / ')})` : '';
    const raw = field.raw_text ? ` เขียนว่า ${field.raw_text}` : '';
    return `ไม่ชัด${raw}${alt}`;
  }
  return String(field.value);
}

function itemLine(item) {
  const kind = classifyItem(item.item_raw);
  const name = item.item_raw || '(ไม่มีชื่อ)';
  const where = kind.code ? kind.code : 'ไม่มีช่องในตาราง';
  const bits = [name];
  if (item.price_overridden_from != null || item.price_overridden_to != null) {
    bits.push(`ราคา ${item.price_overridden_from ?? '?'} ขีดเป็น ${item.price_overridden_to ?? item.price_written ?? '?'}`);
  } else if (item.price_written != null && item.price_written !== '') {
    bits.push(`ราคา ${item.price_written}`);
  }
  const cash = observedNumber(item.cash_qty);
  const scan = observedNumber(item.scan_qty);
  const qty = observedNumber(item.qty);
  const amount = observedNumber(item.amount);
  if (cash != null || scan != null) bits.push(`สด ${cash == null ? '?' : cash} สแกน ${scan == null ? '?' : scan}`);
  if (qty != null) bits.push(`รวม ${qty}`);
  else if (item.qty && item.qty.state && item.qty.state !== 'missing') bits.push('รวมไม่ชัด');
  if (amount != null) bits.push(`บาท ${amount}`);
  if (item.struck) bits.push('ขีดฆ่า');
  if (item.uncertain) bits.push('ตัวเลขไม่ชัวร์');
  bits.push(`→ ${where}`);
  return bits.join(' ');
}

function reportLines(record) {
  if (!record || (record.document_type !== 'sales_report' && record.document_type !== 'closing_cash')) return [];
  const lines = [];
  const formName = record.form_template === 'daily_shop_report'
    ? 'แบบ Daily Shop Report'
    : record.form_template === 'daily_sales_record'
      ? 'แบบ Daily Sales Record'
      : 'แบบฟอร์มที่ยังไม่ระบุชื่อ';
  lines.push(formName);
  if ((record.sales_items || []).some(item => handwritingFlags(item).length)) {
    lines.push('มีราคาหรือเมนูที่เขียนทับ ต้องตรวจก่อนอนุมัติ');
  }
  if (record.orientation && record.orientation !== 'upright') lines.push('รูปเอียง อ่านหลังหมุนให้หัวกระดาษอยู่บน');
  const staff = (record.staff_raw || []).filter(Boolean);
  if (staff.length) lines.push(`พนักงาน ${staff.join(', ')}`);
  else lines.push('ชื่อพนักงานบนกระดาษอ่านไม่ได้');
  if (record.branch_hint && (!record.branch || record.branch.state !== 'observed')) {
    lines.push(`กลุ่มไลน์ตั้งไว้เป็น ${record.branch_hint} แต่บนกระดาษไม่เขียนสาขา จึงยังไม่ใช้ค่านี้`);
  }
  if (record.branch_hint && record.branch && record.branch.state === 'observed' && record.branch.value !== record.branch_hint) {
    lines.push(`กระดาษเขียน ${record.branch.value} แต่กลุ่มไลน์ตั้งไว้เป็น ${record.branch_hint}`);
  }
  const fin = record.financials || {};
  lines.push(`เงินสด ${moneyText(fin.cash_sales)} สแกน ${moneyText(fin.scan_sales)} ยอดรวม ${moneyText(fin.total_sales)}`);
  if (fin.total_expense && fin.total_expense.state !== 'missing') lines.push(`ค่าใช้จ่ายรวม ${moneyText(fin.total_expense)}`);
  if (fin.net_sales && fin.net_sales.state !== 'missing') lines.push(`ยอดหลังหักตามช่องบนกระดาษ ${moneyText(fin.net_sales)}`);
  if (fin.opening_cash && fin.opening_cash.state !== 'missing') lines.push(`เงินเปิดกะ ${moneyText(fin.opening_cash)}`);
  if (fin.counted_cash && fin.counted_cash.state !== 'missing') lines.push(`เงินนับได้ ${moneyText(fin.counted_cash)}`);
  if (fin.expected_cash && fin.expected_cash.state !== 'missing') lines.push(`เงินที่ควรเหลือ ${moneyText(fin.expected_cash)}`);
  const ice = record.other && record.other.ice;
  if (ice && ice.state !== 'missing') lines.push(`น้ำแข็ง ${moneyText(ice)} บาท อยู่ในช่อง Other ยังไม่ลงเป็นค่าใช้จ่าย`);
  const other = record.other && record.other.other;
  if (other && other.state !== 'missing') lines.push(`อื่น ๆ ${moneyText(other)}`);
  for (const note of record.notes || []) lines.push(`โน้ต: ${note}`);
  const items = record.sales_items || [];
  if (items.length) {
    lines.push('รายการ:');
    for (const item of items.slice(0, 24)) lines.push(`- ${itemLine(item)}`);
    if (items.length > 24) lines.push(`- และอีก ${items.length - 24} แถว`);
  }
  for (const text of record.model_uncertainties || []) lines.push(`ไม่ชัด: ${text}`);
  return lines;
}

function rowQtyCheck(item) {
  const cash = observedNumber(item.cash_qty);
  const scan = observedNumber(item.scan_qty);
  const qty = observedNumber(item.qty);
  if (cash == null || scan == null || qty == null) {
    return { status: 'not_testable', reason: 'cash tally, scan tally, or total qty was not observed' };
  }
  const expected = cash + scan;
  const difference = qty - expected;
  return {
    status: difference === 0 ? 'pass' : 'fail',
    observed: qty,
    expected,
    difference,
    reason: difference === 0 ? 'cash tally + scan tally equals the written qty' : 'cash tally + scan tally does not equal the written qty',
  };
}

function rowAmountCheck(item) {
  const qty = observedNumber(item.qty);
  const amount = observedNumber(item.amount);
  const price = item.price_overridden_to != null ? Number(item.price_overridden_to) : (item.price_written != null ? Number(item.price_written) : null);
  if (qty == null || amount == null || price == null || !Number.isFinite(price)) {
    return { status: 'not_testable', reason: 'qty, price, or line amount was not observed' };
  }
  const expected = Math.round(qty * price * 100) / 100;
  const difference = Math.round((amount - expected) * 100) / 100;
  return {
    status: difference === 0 ? 'pass' : 'fail',
    observed: amount,
    expected,
    difference,
    reason: difference === 0 ? 'qty times price equals the written amount' : 'qty times price does not equal the written amount',
  };
}

const FLAVOR_TESTS = [
  { name: 'sticky rice', test: /sticky\s*rice|ข้าวเหนียว/i },
  { name: 'roseapple', test: /rose\s*apple|roseapple|ชมพู่/i },
  { name: 'pomegranate', test: /pomegranate|pomegra|(?<![a-z])pome\b|ทับทิม/i },
  { name: 'pineapple', test: /pineapple|สับปะรด/i },
  { name: 'watermelon', test: /watermelon|แตงโม/i },
  { name: 'mangosteen', test: /mangosteen|มังคุด/i },
  { name: 'lychee', test: /lychee|ลิ้นจี่/i },
  { name: 'rambutan', test: /rambutan|เงาะ/i },
  { name: 'orange', test: /orange|ส้ม/i },
  { name: 'mango', test: /mango(?!steen)|มะม่วง/i },
  { name: 'coconut', test: /coconut|มะพร้าว/i },
  { name: 'guava', test: /guava|ฝรั่ง/i },
  { name: 'grape', test: /grape|องุ่น/i },
  { name: 'apple', test: /(?<!pine)(?<!rose)apple|แอปเปิ้ล|แอปเปิล/i },
];

function flavorsIn(text) {
  const found = [];
  for (const flavor of FLAVOR_TESTS) {
    if (flavor.test.test(String(text || ''))) found.push(flavor.name);
  }
  return [...new Set(found)];
}

function baseFlavors(text, found) {
  const lower = String(text || '').toLowerCase();
  if (/mango sticky rice|ข้าวเหนียวมะม่วง|มะม่วงข้าวเหนียว/.test(lower)) return ['mango', 'sticky rice'];
  if ((/mangosteen|มังคุด/.test(lower)) && (/lychee|ลิ้นจี่/.test(lower))) return ['mangosteen', 'lychee'];
  if (/volcano/.test(lower)) {
    const cup = found.filter(name => ['orange', 'watermelon', 'mango', 'coconut', 'apple', 'guava', 'pineapple'].includes(name));
    if (!cup.length) return found.slice();
    return [cup[0]];
  }
  if (found.length <= 1) return found.slice();
  const primary = found.find(name => ['orange', 'watermelon', 'mango', 'coconut', 'apple', 'guava', 'pineapple', 'mangosteen', 'rambutan'].includes(name));
  return primary ? [primary] : [found[0]];
}

function extraFlavors(itemRaw) {
  const found = flavorsIn(itemRaw);
  const base = new Set(baseFlavors(itemRaw, found));
  return found.filter(name => !base.has(name));
}

function handwritingFlags(item) {
  if (!item) return [];
  const flags = [];
  const name = item.item_raw || 'แถว';
  if (item.price_overridden_from != null || item.price_overridden_to != null) {
    flags.push({
      kind: 'price_change',
      text: `${name}: ราคาเขียนทับ ${item.price_overridden_from ?? '?'} เป็น ${item.price_overridden_to ?? '?'}`,
    });
  }
  const extra = extraFlavors(item.item_raw);
  if (extra.length) {
    flags.push({ kind: 'flavor_shift', text: `${name}: มีรสที่เขียนเพิ่ม (${extra.join(', ')})` });
  }
  if (item.struck || item.handwritten) {
    flags.push({ kind: 'row_shift', text: `${name}: แถวถูกเขียนเพิ่มหรือขีดฆ่า` });
  }
  return flags;
}

function noteCheck(note, financials) {
  const match = String(note).match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)\s*=\s*(\d[\d,]*)/);
  if (!match) return null;
  const a = Number(match[1].replace(/,/g, ''));
  const b = Number(match[2].replace(/,/g, ''));
  const c = Number(match[3].replace(/,/g, ''));
  const equationOk = Math.round((a - b) * 100) === Math.round(c * 100);
  const cash = observedNumber(financials && financials.cash_sales);
  const total = observedNumber(financials && financials.total_sales);
  const known = [cash, total].filter(n => n != null);
  return {
    raw: match[0],
    equationOk,
    comparable: known.length > 0,
    startsFromReport: known.includes(a),
    a, b, c,
  };
}

module.exports = {
  ALBUM_HELP_TH,
  classifyItem,
  formTemplate,
  reportLines,
  rowQtyCheck,
  rowAmountCheck,
  noteCheck,
  moneyText,
  handwritingFlags,
  extraFlavors,
};
