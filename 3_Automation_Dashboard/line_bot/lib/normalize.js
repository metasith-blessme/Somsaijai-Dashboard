const crypto = require('crypto');
const { asField, observedNumber } = require('./fields');
const { normalizeDate, dateAgeIssue } = require('./dates');
const { redactText } = require('./redact');

const { formTemplate } = require('./forms');

const PROMPT_VERSION = 'line-bot-ocr-3';
const OPENED = { B1: '2026-01-01', B2: '2026-04-18', B3: '2026-07-11' };

function branchField(raw) {
  const text = raw == null ? '' : String(raw).trim();
  if (!text) return { raw_text: null, value: null, state: 'missing' };
  const direct = text.toUpperCase().match(/\bB[\s.\-]*([123])\b/);
  if (direct) return { raw_text: text, value: 'B' + direct[1], state: 'observed' };
  const thai = text.match(/สาขา\s*([123])/);
  if (thai) return { raw_text: text, value: 'B' + thai[1], state: 'observed' };
  if (/platinum\s*pop|แพลตตินัม|แพลทินัม/i.test(text)) {
    return { raw_text: text, value: 'B3', state: 'observed' };
  }
  return { raw_text: text, value: null, state: 'ambiguous' };
}

/**
 * Daily Shop Report prints the branch in the Shift box (B-3, B - 3, B.3).
 * A shift that is itself a branch code fills an empty branch cell.
 * Two different codes stay unresolved.
 */
function resolveBranch(header, template) {
  const direct = branchField(header && header.branch_raw);
  const shift = branchField(header && header.shift_raw);
  const shop = template === 'daily_shop_report';
  if (direct.state === 'observed' && shift.state === 'observed' && direct.value !== shift.value) {
    return {
      raw_text: direct.raw_text,
      value: null,
      state: 'ambiguous',
      alternatives: [direct.value, shift.value],
    };
  }
  if (direct.state === 'observed') return direct;
  if (shift.state === 'observed' && (shop || direct.state === 'missing')) {
    return { raw_text: shift.raw_text, value: shift.value, state: 'observed' };
  }
  return direct;
}

function money(input) { return asField(input, 'THB'); }
function qty(input) { return asField(input, 'count'); }

/**
 * Two readings of the same critical field. Disagreement or a missing
 * confirmation becomes ambiguous with a null value — we do not pick one.
 */
function confirm(first, second, label, mode) {
  const a = money(first);
  // skip: the second call was deliberately not made. keep: it failed.
  // Either way the first reading stays. A real second reading still has to agree.
  if (mode === 'skip' || mode === 'keep') return { field: a, issue: null };
  const b = second == null ? null : money(second);
  if (!b) {
    return {
      field: { ...a, value: null, state: a.state === 'missing' ? 'missing' : 'ambiguous' },
      issue: { field: label, issue: 'second reading did not confirm this field' },
    };
  }
  if (a.state === 'observed' && b.state === 'observed' && a.value !== b.value) {
    return {
      field: { raw_text: a.raw_text, value: null, state: 'ambiguous', unit: 'THB', alternatives: [a.value, b.value] },
      issue: { field: label, issue: `readings disagree (${a.value} vs ${b.value})` },
    };
  }
  if (a.state === 'observed' && b.state === 'observed') return { field: a, issue: null };
  if (a.state !== 'observed' && b.state !== 'observed') {
    const state = a.state === 'missing' && b.state === 'missing' ? 'missing' : 'ambiguous';
    const alternatives = (a.alternatives && a.alternatives.length) ? a.alternatives : (b.alternatives || []);
    return { field: { raw_text: a.raw_text || b.raw_text, value: null, state, unit: 'THB', alternatives }, issue: null };
  }
  return {
    field: { raw_text: (a.raw_text || b.raw_text), value: null, state: 'ambiguous', unit: 'THB', alternatives: [a.value, b.value].filter(v => v != null) },
    issue: { field: label, issue: 'only one reading could see this field' },
  };
}

function unconfirm(field, second, label, issues, mode) {
  if (mode === 'skip' || mode === 'keep') return;
  if (!field || field.state !== 'observed') return;
  if (second && second.state === 'observed' && second.value === field.value) return;
  const disagreed = second && second.state === 'observed' && second.value !== field.value;
  if (disagreed) field.alternatives = [field.value, second.value];
  field.value = null;
  field.state = 'ambiguous';
  issues.push({
    field: label,
    issue: disagreed ? `${label} readings disagree` : `second reading did not confirm ${label}`,
  });
}

function staffList(raw) {
  if (raw == null || raw === '') return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(/[,/]/);
  return list.map(s => String(s).trim()).filter(Boolean);
}

function countCell(row, key) {
  if (!row || row[key] == null || row[key] === '') return qty(null);
  return qty(row[key]);
}

function menuRows(list) {
  if (!Array.isArray(list)) return [];
  return list.map((row, i) => ({
    item_raw: row && row.item_raw != null ? String(row.item_raw) : null,
    price_written: row ? (row.price_raw ?? row.price_written ?? null) : null,
    price_overridden_from: row && row.price_overridden_from != null ? row.price_overridden_from : null,
    price_overridden_to: row && row.price_overridden_to != null ? row.price_overridden_to : null,
    cash_qty: countCell(row, 'cash_qty'),
    scan_qty: countCell(row, 'scan_qty'),
    qty: qty(row ? (row.qty ?? { raw: row.qty_raw, value: row.qty_value, state: row.qty_state || (row.uncertain ? 'ambiguous' : row.qty_raw == null && row.qty_value == null ? 'missing' : 'observed') }) : null),
    amount: money(row ? (row.amount ?? { raw: row.amount_raw, value: row.amount_value, state: row.amount_raw == null && row.amount_value == null ? 'missing' : 'observed' }) : null),
    uncertain: !!(row && (row.uncertain || row.qty_uncertain)),
    struck: !!(row && row.struck),
    source_row: i + 1,
  }));
}

function readingHeader(obj) {
  if (!obj || typeof obj !== 'object') return null;
  return {
    branch_raw: obj.branch_raw != null ? obj.branch_raw : (obj.header && obj.header.branch_raw),
    shift_raw: obj.shift_raw != null ? obj.shift_raw : (obj.header && obj.header.shift_raw),
  };
}

function oneImage({ sourceId, sha256, contentType, extraction, second, secondError, secondSkipped, branch_hint, line_group_id }, now) {
  const ext = extraction && typeof extraction === 'object' ? extraction : {};
  const sec = second && typeof second === 'object' ? second : null;
  const issues = [];
  if (secondError) issues.push({ field: 'second_reading', issue: String(secondError) });
  if (!extraction) issues.push({ field: 'extraction', issue: 'first reading failed' });

  const template = formTemplate(ext);
  const confirmMode = secondSkipped || secondError ? (secondSkipped ? 'skip' : 'keep') : 'compare';

  const date = normalizeDate(ext.header && ext.header.date_raw);
  const date2 = sec ? normalizeDate(sec.date_raw || (sec.header && sec.header.date_raw)) : null;
  unconfirm(date, date2, 'date', issues, confirmMode);
  if (date.state === 'observed' && date.value) {
    const age = dateAgeIssue(date.value, now);
    if (age) issues.push({ field: 'date_age', issue: age });
  }

  const branch = resolveBranch(ext.header, template);
  const branch2 = sec ? resolveBranch(readingHeader(sec), sec.form_template || template) : null;
  if (branch.alternatives && branch.alternatives.length > 1 && branch.state !== 'observed') {
    issues.push({ field: 'branch', issue: `branch and shift disagree (${branch.alternatives.join(' vs ')})` });
  }
  unconfirm(branch, branch2, 'branch', issues, confirmMode);
  if (branch_hint && branch.state === 'observed' && branch.value !== branch_hint) {
    issues.push({ field: 'branch', issue: `form says ${branch.value} but this LINE group is mapped to ${branch_hint}` });
  } else if (branch_hint && branch.state !== 'observed') {
    issues.push({ field: 'branch_hint', issue: `LINE group is mapped to ${branch_hint}; the form did not show a branch, so the hint was not used` });
  }

  const salesIn = ext.sales || {};
  const sales2 = (sec && sec.sales) || {};
  const financials = {};
  for (const key of ['cash_sales', 'scan_sales', 'total_sales', 'total_expense', 'net_sales', 'opening_cash', 'counted_cash', 'expected_cash']) {
    const result = confirm(salesIn[key], sec ? sales2[key] : null, key, confirmMode);
    financials[key] = result.field;
    if (result.issue && (key === 'total_sales' || key === 'cash_sales' || key === 'scan_sales')) issues.push(result.issue);
  }
  financials.total_cups = qty(salesIn.total_cups);
  if (sec) unconfirm(financials.total_cups, qty(sales2.total_cups), 'total_cups', issues, confirmMode);

  const docType = ['sales_report', 'closing_cash', 'stock_report', 'transfer_slip', 'supplier_receipt', 'other', 'unreadable'].includes(ext.document_type)
    ? ext.document_type : 'other';

  const slipIn = ext.slip || {};
  const slip2 = (sec && sec.slip) || {};
  const amount = confirm(slipIn.amount, sec ? slip2.amount : null, 'slip.amount', confirmMode);
  if (docType === 'transfer_slip' || docType === 'supplier_receipt') {
    if (amount.issue) issues.push(amount.issue);
  }

  return {
    source_id: sourceId,
    sha256,
    content_type: contentType || null,
    document_type: docType,
    image_quality: ext.image_quality || null,
    disposition: docType === 'unreadable' || !extraction ? 'unreadable' : (issues.length ? 'needs_review' : 'reviewed'),
    header: {
      date,
      branch,
      staff_raw: staffList(ext.header && ext.header.staff_raw),
      shift_raw: ext.header && ext.header.shift_raw != null ? String(ext.header.shift_raw) : null,
      open_raw: ext.header && ext.header.open_raw != null ? String(ext.header.open_raw) : null,
      close_raw: ext.header && ext.header.close_raw != null ? String(ext.header.close_raw) : null,
    },
    form_template: template,
    orientation: ext.orientation || null,
    branch_hint: branch_hint || null,
    line_group_id: line_group_id || null,
    financials,
    other: {
      ice: money(ext.other && ext.other.ice),
      other: money(ext.other && ext.other.other),
    },
    notes: Array.isArray(ext.notes) ? ext.notes.map(note => String(note)) : [],
    sales_items: menuRows(ext.menu_rows),
    handwritten_additions: menuRows(ext.handwritten_additions).map(row => ({ ...row, handwritten: true })),
    shift_expenses: Array.isArray(ext.shift_expenses) ? ext.shift_expenses : [],
    stock_items: Array.isArray(ext.stock_rows) ? ext.stock_rows : [],
    slip: {
      bank: slipIn.bank || null,
      status_raw: slipIn.status_raw || null,
      datetime_raw: slipIn.datetime_raw || null,
      amount: amount.field,
      fee: money(slipIn.fee),
      currency: slipIn.currency || null,
      reference_raw: redactText(slipIn.reference_raw || null),
      sender_masked: redactText(slipIn.sender_masked || null),
      receiver_masked: redactText(slipIn.receiver_masked || null),
      memo_lines: Array.isArray(slipIn.memo_lines) ? slipIn.memo_lines.map(line => redactText(String(line))) : [],
      items: Array.isArray(slipIn.items) ? slipIn.items : [],
    },
    model_uncertainties: Array.isArray(ext.uncertainties) ? ext.uncertainties.map(String) : [],
    issues,
  };
}

const BLOCKING_FIELDS = new Set(['date', 'branch', 'total_sales', 'slip.amount', 'second_reading', 'extraction']);

function recordStatus(image) {
  if (image.disposition === 'unreadable') return 'needs_review';
  if (image.issues.some(issue => BLOCKING_FIELDS.has(issue.field))) return 'needs_review';
  if (image.header.date.state !== 'observed' || image.header.branch.state !== 'observed') return 'needs_review';
  if (image.issues.some(issue => issue.field === 'date_age')) return 'needs_review';
  return 'ready_for_review';
}

/**
 * Build the review artifact. import_allowed is always false here.
 * Human approval is a separate record.
 */
function buildReview({ batchId, images, now }) {
  const pages = (images || []).map(image => oneImage(image, now));
  const records = [];
  const expense_documents = [];
  pages.forEach((page) => {
    if (page.document_type === 'transfer_slip' || page.document_type === 'supplier_receipt') {
      expense_documents.push({
        source_id: page.source_id,
        sha256: page.sha256,
        document_type: page.document_type,
        branch: page.header.branch,
        payment_date: page.header.date,
        payment_status_raw: page.slip.status_raw,
        payment_amount: page.slip.amount,
        currency: page.slip.currency,
        fee: page.slip.fee,
        reference_raw: page.slip.reference_raw,
        sender_masked: page.slip.sender_masked,
        receiver_masked: page.slip.receiver_masked,
        memo_lines: page.slip.memo_lines,
        items: page.slip.items,
        issues: page.issues,
        status: recordStatus(page),
      });
      return;
    }
    records.push({
      record_id: page.source_id,
      document_type: page.document_type,
      status: recordStatus(page),
      source_ids: [page.source_id],
      branch: page.header.branch,
      date: page.header.date,
      staff_raw: page.header.staff_raw,
      shift_raw: page.header.shift_raw,
      open_raw: page.header.open_raw,
      close_raw: page.header.close_raw,
      form_template: page.form_template,
      orientation: page.orientation,
      branch_hint: page.branch_hint,
      line_group_id: page.line_group_id,
      financials: page.financials,
      other: page.other,
      notes: page.notes,
      sales_items: page.sales_items.concat(page.handwritten_additions),
      stock_items: page.stock_items,
      shift_expenses: page.shift_expenses,
      issues: page.issues,
      model_uncertainties: page.model_uncertainties,
    });
  });

  const review = {
    schema_version: 'somsaijai-extraction-review-v1',
    prompt_version: PROMPT_VERSION,
    batch_id: batchId,
    sources: pages.map(p => ({
      source_id: p.source_id,
      sha256: p.sha256,
      document_type: p.document_type,
      content_type: p.content_type,
      disposition: p.disposition,
    })),
    records,
    expense_documents,
    checks: [],
    issues: pages.flatMap(p => p.issues.map(issue => ({ ...issue, source_id: p.source_id }))),
    opened: OPENED,
    review: {
      reviewer: null,
      reviewed_at: null,
      approval_reference: null,
      import_allowed: false,
    },
  };
  if (review.review.import_allowed !== false) {
    throw new Error('extractor contract broken');
  }
  return review;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

module.exports = { buildReview, sha256, PROMPT_VERSION, OPENED, observedNumber, branchField, resolveBranch };
