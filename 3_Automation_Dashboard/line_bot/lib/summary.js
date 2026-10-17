const crypto = require('crypto');
const { observedNumber } = require('./fields');
const { buildChangePlan } = require('./adapter');
const { reportLines } = require('./forms');

function baht(n) {
  if (n == null) return 'ไม่ทราบ';
  return Number(n).toLocaleString('en-US');
}

function reviewToken(batchId, secret) {
  return crypto.createHmac('sha256', secret).update(`review:${batchId}`).digest('hex');
}

function formatSummary(review, { publicUrl, channelSecret } = {}) {
  const plan = buildChangePlan(review);
  const lines = [`ชุด ${review.batch_id}`, `รูป ${review.sources.length} ใบ`, ''];
  for (const record of review.records || []) {
    const detail = reportLines(record);
    if (!detail.length) continue;
    lines.push(...detail, '');
  }
  const importable = [];
  for (const list of plan.salesLists) {
    for (const row of list.rows) {
      const scan = row.scan == null ? 'สแกนไม่ทราบ' : `สแกน ${baht(row.scan)}`;
      const cash = row.cash == null ? 'เงินสดไม่ทราบ' : `เงินสด ${baht(row.cash)}`;
      lines.push(`${row.branch} ${row.date} ยอดขาย ${baht(row.revenue)} (${cash} / ${scan})`);
      importable.push(`${row.branch} ${row.date}`);
    }
  }
  for (const row of (plan.expenseList && plan.expenseList.rows) || []) {
    lines.push(`${row.branch} ${row.date} ค่าใช้จ่าย ${row.cat} ${baht(row.amt)} บาท`);
    importable.push(`${row.branch} ${row.date} ${row.cat}`);
  }
  if (!importable.length) lines.push('ยังไม่มีรายการที่อ่านชัดพอจะลงบัญชี');
  if (plan.held.length) {
    lines.push('', 'ยังไม่ลง (ต้องชัดก่อน):');
    for (const item of plan.held.slice(0, 6)) {
      lines.push(`- ${[item.branch, item.date].filter(Boolean).join(' ') || item.source_id}: ${item.reasons[0]}`);
    }
    if (plan.held.length > 6) lines.push(`- และอีก ${plan.held.length - 6} รายการ`);
  }
  const uncertain = (review.issues || []).slice(0, 5).map(i => i.issue).filter(Boolean);
  if (uncertain.length) {
    lines.push('', 'จุดที่ไม่ชัด:');
    uncertain.forEach(text => lines.push(`- ${text}`));
  }
  lines.push('', 'ยังไม่เข้าระบบและยังไม่ขึ้น dashboard จนกว่าคุณปานจะกดอนุมัติ');
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
