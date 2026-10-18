const crypto = require('crypto');
const { observedNumber } = require('./fields');
const { buildChangePlan } = require('./adapter');
const { classifyItem, handwritingFlags } = require('./forms');

function baht(n) {
  if (n == null) return 'ไม่ทราบ';
  return Number(n).toLocaleString('en-US');
}

function reviewToken(batchId, secret) {
  return crypto.createHmac('sha256', secret).update(`review:${batchId}`).digest('hex');
}

const CHECK_TH = {
  channels: 'สด+สแกน',
  line_sum: 'ผลรวมแถว',
  net: 'สุทธิ',
  row_qty: 'จำนวน',
  row_amount: 'บาท',
  note_equation: 'โน้ต',
  note_vs_payment: 'โน้ต≠ยอด',
  slip_allocation: 'สลิป',
};

function fieldAmount(field) {
  if (!field || field.state === 'missing') return null;
  if (field.state === 'observed' && field.value != null) return baht(field.value);
  const alt = (field.alternatives || []).filter(value => value != null);
  if (alt.length) return `ไม่ชัด (${alt.join(' / ')})`;
  return 'ไม่ชัด';
}

function salesHead(record) {
  if (!record || (record.document_type !== 'sales_report' && record.document_type !== 'closing_cash')) return null;
  const branch = record.branch && record.branch.state === 'observed' && record.branch.value
    ? record.branch.value
    : 'สาขาไม่ชัด';
  const date = record.date && record.date.value ? record.date.value : 'วันที่ไม่ชัด';
  const fin = record.financials || {};
  const total = fieldAmount(fin.total_sales);
  const bits = [`${branch} ${date}`, total ? `รวม ${total}` : 'รวม ไม่ชัด'];
  if (fin.cash_sales && fin.cash_sales.state === 'observed' && fin.scan_sales && fin.scan_sales.state === 'observed') {
    bits.push(`สด ${baht(fin.cash_sales.value)} สแกน ${baht(fin.scan_sales.value)}`);
  }
  return bits.join(' ');
}

function checkBit(check) {
  const name = CHECK_TH[check.rule] || check.rule;
  if (check.rule === 'note_equation') {
    const raw = String(check.reason || '').split(': ').slice(1).join(': ').trim();
    const status = check.status === 'pass' ? 'ผ่าน' : check.status === 'fail' ? 'ไม่ผ่าน' : 'ไม่ตรวจ';
    return raw ? `โน้ต ${raw} ${status}` : `โน้ต ${status}`;
  }
  if (check.status === 'fail') {
    const gap = check.difference != null && check.rule !== 'note_vs_payment' ? ` (${check.difference})` : '';
    const who = check.item ? `${check.item} ` : '';
    return `${who}${name} ไม่ผ่าน${gap}`;
  }
  if (check.status === 'pass') return `${name} ผ่าน`;
  return `${name} ไม่ตรวจ`;
}

function checkLine(checks) {
  if (!checks || !checks.length) return null;
  return `เช็ค: ${checks.map(checkBit).join(' · ')}`;
}

function issueFlag(issue) {
  if (!issue) return null;
  const text = String(issue.issue || '').replace(/\s+/g, ' ').trim();
  if (!text || issue.field === 'branch' || issue.field === 'branch_hint') return null;
  if (issue.field === 'date_age' || /more than \d+ days old/.test(text)) {
    const old = text.match(/date (\S+) is more than (\d+) days old/);
    return old ? `วันที่ ${old[1]} เก่ากว่า ${old[2]} วัน` : 'วันที่เก่ากว่ากำหนด';
  }
  if (/in the future/.test(text)) {
    const match = text.match(/date (\S+)/);
    return match ? `วันที่ ${match[1]} อยู่ในอนาคต` : 'วันที่อยู่ในอนาคต';
  }
  if (issue.field === 'extraction') return 'อ่านรูปไม่ได้';
  if (issue.field === 'second_reading') return 'อ่านซ้ำไม่ได้';
  if (/disagree|did not confirm/i.test(text)) {
    const detail = (text.match(/\((.+)\)/) || [])[1];
    return detail ? `อ่านไม่ตรง (${detail})` : 'อ่านไม่ตรง';
  }
  return null;
}

function shortUncertainty(text) {
  const raw = String(text || '');
  if (/rotat/i.test(raw)) return 'รูปเอียง';
  if (/staff name/i.test(raw)) return 'ชื่อพนักงานไม่ชัด';
  if (/no branch/i.test(raw)) return null;
  if (/opening cash/i.test(raw)) return 'เงินเปิดกะไม่ชัด';
  if (/tally|cup count/i.test(raw)) return 'จำนวนแก้วไม่ชัด';
  if (/expense/i.test(raw)) return 'ค่าใช้จ่ายกะไม่ชัด';
  if (/grand total|3089|3090/i.test(raw)) return null;
  if (/cash total|extra mark/i.test(raw)) return 'เงินสดไม่ชัด';
  if (/crossed out|handwritten|printed price/i.test(raw)) return null;
  if (/total qty/i.test(raw)) return 'ช่องจำนวนไม่ชัด';
  const clean = raw.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 40) : null;
}

function recordFlags(record) {
  const flags = [];
  if (record.branch_hint && (!record.branch || record.branch.state !== 'observed')) {
    flags.push(`กลุ่มไลน์ตั้งไว้เป็น ${record.branch_hint}`);
  }
  if (record.branch_hint && record.branch && record.branch.state === 'observed' && record.branch.value !== record.branch_hint) {
    flags.push(`กระดาษ ${record.branch.value} แต่กลุ่มไลน์ตั้งไว้เป็น ${record.branch_hint}`);
  }
  const ice = record.other && record.other.ice;
  if (ice && ice.state !== 'missing') {
    const amount = fieldAmount(ice) || 'ไม่ชัด';
    flags.push(`น้ำแข็ง ${amount} ยังไม่ลงค่าใช้จ่าย`);
  }
  const unmapped = [];
  for (const item of record.sales_items || []) {
    if (!item || !item.item_raw) continue;
    if (!classifyItem(item.item_raw).code && !unmapped.includes(item.item_raw)) unmapped.push(item.item_raw);
    for (const flag of handwritingFlags(item)) flags.push(flag.text);
  }
  if (unmapped.length) flags.push(`ไม่มีช่องในตาราง: ${unmapped.join(', ')}`);
  for (const issue of record.issues || []) {
    const flag = issueFlag(issue);
    if (flag) flags.push(flag);
  }
  const uncertain = [];
  for (const text of record.model_uncertainties || []) {
    const short = shortUncertainty(text);
    if (short && !uncertain.includes(short)) uncertain.push(short);
  }
  if (uncertain.length) flags.push(`ไม่ชัด: ${uncertain.map(item => item.replace(/ไม่ชัด$/, '')).join(', ')}`);
  return [...new Set(flags)];
}

function shortReason(reason) {
  const text = String(reason || '').replace(/\s+/g, ' ').trim();
  const rules = [
    [/branch was not read/, 'สาขาไม่ชัด'],
    [/date was not read/, 'วันที่ไม่ชัด'],
    [/revenue was not read/, 'ยอดไม่ชัด'],
    [/cash \+ scan does not equal/, 'สด+สแกนไม่ตรง'],
    [/is not a sales row/, 'ไม่ใช่ยอดขาย'],
    [/January–March/, 'ม.ค.–มี.ค. ปิดแล้ว'],
    [/was not open yet/, 'สาขายังไม่เปิด'],
    [/stock counts/, 'สต็อก ไม่ลงยอด'],
    [/line amounts do not add up to the written total/, 'แถวไม่ตรงรวม'],
    [/line amounts do not add up to the payment/, 'สลิปไม่ตรงยอด'],
    [/total minus expense does not equal/, 'สุทธิไม่ตรง'],
    [/note arithmetic does not hold: (.*)/, 'โน้ตไม่ตรง'],
    [/more than \d+ days old/, 'วันที่เก่ากว่ากำหนด'],
    [/in the future/, 'วันที่อยู่ในอนาคต'],
    [/paying branch was not read/, 'สาขาไม่ชัด'],
    [/payment date was not read/, 'วันที่ไม่ชัด'],
    [/payment amount was not read/, 'ยอดไม่ชัด'],
    [/transfer is not a completed payment/, 'โอนไม่สำเร็จ'],
    [/transfer status was not read/, 'สถานะโอนไม่ชัด'],
    [/memo names a different month/, 'เดือนในบันทึกไม่ตรง'],
    [/profit distribution/, 'ไม่ใช่ค่าใช้จ่าย'],
    [/does not say what was bought/, 'ไม่รู้ว่าซื้ออะไร'],
    [/mixed purchase has no line amounts/, 'ยอดแยกไม่ครบ'],
    [/could not classify a line/, 'แยกบรรทัดไม่ได้'],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) return label;
  }
  return text.slice(0, 80);
}

function heldLine(held) {
  if (!held.length) return null;
  const bits = held.slice(0, 5).map(item => {
    const where = [item.branch, item.date].filter(Boolean).join(' ');
    const why = shortReason(item.reasons && item.reasons[0]);
    return where ? `${where} ${why}` : why;
  });
  const more = held.length > 5 ? ` +${held.length - 5}` : '';
  return `ค้าง: ${bits.join(' · ')}${more}`;
}

function formatSummary(review, { publicUrl, channelSecret } = {}) {
  const plan = buildChangePlan(review);
  const lines = [`ชุด ${review.batch_id} · รูป ${review.sources.length}`];
  const importable = [];
  for (const record of review.records || []) {
    const head = salesHead(record);
    if (!head) continue;
    lines.push(head);
    const checks = (review.checks || []).filter(check => check.record_id === record.record_id && check.rule !== 'slip_allocation');
    const checksText = checkLine(checks);
    if (checksText) lines.push(checksText);
    for (const flag of recordFlags(record)) lines.push(`- ${flag}`);
  }
  for (const list of plan.salesLists) {
    for (const row of list.rows) importable.push(`${row.branch} ${row.date}`);
  }
  for (const row of (plan.expenseList && plan.expenseList.rows) || []) {
    lines.push(`${row.branch} ${row.date} ค่าใช้จ่าย ${row.cat} ${baht(row.amt)}`);
    importable.push(`${row.branch} ${row.date} ${row.cat}`);
  }
  const slips = checkLine((review.checks || []).filter(check => check.rule === 'slip_allocation'));
  if (slips) lines.push(slips);
  const held = heldLine(plan.held);
  if (held) lines.push(held);
  else if (!importable.length) lines.push('ยังไม่มีรายการที่ลงได้');
  lines.push('ยังไม่เข้าระบบ จนกดอนุมัติ');
  let url = null;
  if (publicUrl && channelSecret) {
    url = `${publicUrl}/api/review?batch=${encodeURIComponent(review.batch_id)}&token=${reviewToken(review.batch_id, channelSecret)}`;
    lines.push(url);
  }
  const text = lines.join('\n').slice(0, 4800);
  const messages = [
    { type: 'text', text },
    {
      type: 'template',
      altText: `ตรวจชุด ${review.batch_id}`,
      template: {
        type: 'buttons',
        text: (importable.length
          ? `อนุมัติ ${importable.length} รายการที่อ่านชัด? ที่ค้างจะไม่ถูกเขียน`
          : 'ชุดนี้ยังไม่มีรายการที่ลงบัญชีได้').slice(0, 160),
        actions: [
          { type: 'postback', label: 'อนุมัติ', data: `action=approve&batch=${review.batch_id}`, displayText: 'อนุมัติ' },
          { type: 'postback', label: 'ไม่รับ', data: `action=reject&batch=${review.batch_id}`, displayText: 'ไม่รับ' },
        ],
      },
    },
  ];
  return { text, messages, plan, url };
}

function parsePostback(data) {
  const params = new URLSearchParams(String(data || ''));
  return { action: params.get('action'), batch: params.get('batch') };
}

module.exports = { formatSummary, parsePostback, reviewToken, baht, observedNumber };
