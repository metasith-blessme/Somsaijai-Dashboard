const { observedNumber } = require('./fields');
const { rowQtyCheck, rowAmountCheck, noteCheck } = require('./forms');

function satang(n) { return Math.round(Number(n) * 100); }

/**
 * Channel check uses only observed figures.
 * scan is never filled with revenue - cash.
 */
function channelCheck(financials) {
  const cash = financials.cash_sales;
  const scan = financials.scan_sales;
  const total = financials.total_sales;
  const inputs = { cash: observedNumber(cash), scan: observedNumber(scan), total: observedNumber(total) };
  if (inputs.total == null || inputs.cash == null || inputs.scan == null) {
    return {
      rule: 'channels',
      status: 'not_testable',
      observed: inputs.total,
      expected: null,
      difference: null,
      reason: 'cash, scan, or total was not observed',
      inputs,
    };
  }
  const expected = inputs.cash + inputs.scan;
  const difference = satang(inputs.total) - satang(expected);
  return {
    rule: 'channels',
    status: difference === 0 ? 'pass' : 'fail',
    observed: inputs.total,
    expected: Math.round(expected * 100) / 100,
    difference: difference / 100,
    reason: difference === 0 ? 'cash + scan equals the written total' : 'cash + scan does not equal the written total',
    inputs,
  };
}

function applyChecks(review) {
  review.checks = [];
  for (const record of review.records) {
    if (record.document_type !== 'sales_report' && record.document_type !== 'closing_cash') continue;
    const check = channelCheck(record.financials || {});
    check.record_id = record.record_id;
    review.checks.push(check);
    if (check.status === 'fail') {
      record.status = 'needs_review';
      review.issues.push({ source_id: record.record_id, field: 'channels', issue: check.reason });
    }
    for (const item of record.sales_items || []) {
      if (item.struck) continue;
      const qtyCheck = rowQtyCheck(item);
      if (qtyCheck.status === 'fail') {
        record.status = 'needs_review';
        review.checks.push({ rule: 'row_qty', record_id: record.record_id, item: item.item_raw, ...qtyCheck });
        review.issues.push({ source_id: record.record_id, field: 'row_qty', issue: `${item.item_raw}: ${qtyCheck.reason}` });
      }
      const amountCheck = rowAmountCheck(item);
      if (amountCheck.status === 'fail') {
        record.status = 'needs_review';
        review.checks.push({ rule: 'row_amount', record_id: record.record_id, item: item.item_raw, ...amountCheck });
        review.issues.push({ source_id: record.record_id, field: 'row_amount', issue: `${item.item_raw}: ${amountCheck.reason}` });
      }
    }
    for (const note of record.notes || []) {
      const parsed = noteCheck(note, record.financials);
      if (!parsed) continue;
      review.checks.push({
        rule: 'note_equation',
        record_id: record.record_id,
        status: parsed.equationOk ? 'pass' : 'fail',
        observed: parsed.c,
        expected: Math.round((parsed.a - parsed.b) * 100) / 100,
        difference: parsed.equationOk ? 0 : Math.round((parsed.c - (parsed.a - parsed.b)) * 100) / 100,
        reason: parsed.equationOk ? `note arithmetic holds: ${parsed.raw}` : `note arithmetic does not hold: ${parsed.raw}`,
      });
      if (!parsed.equationOk) {
        record.status = 'needs_review';
        review.issues.push({ source_id: record.record_id, field: 'note', issue: `note arithmetic does not hold: ${parsed.raw}` });
      }
      if (parsed.comparable && !parsed.startsFromReport) {
        record.status = 'needs_review';
        review.checks.push({
          rule: 'note_vs_payment',
          record_id: record.record_id,
          status: 'fail',
          observed: parsed.a,
          expected: null,
          difference: null,
          reason: `note starts from ${parsed.a}, which is not the written cash total or the written sales total`,
        });
        review.issues.push({
          source_id: record.record_id,
          field: 'note',
          issue: `note starts from ${parsed.a}, which is not the written cash total or the written sales total`,
        });
      }
    }
  }
  for (const doc of review.expense_documents || []) {
    const lines = (doc.items || []).filter(item => item && typeof item.line_amount === 'number');
    if (!lines.length || observedNumber(doc.payment_amount) == null) {
      review.checks.push({
        rule: 'slip_allocation', record_id: doc.source_id, status: 'not_testable',
        observed: observedNumber(doc.payment_amount), expected: null, difference: null,
        reason: 'payment total or line amounts were not all observed',
      });
      continue;
    }
    const sum = lines.reduce((a, item) => a + satang(item.line_amount), 0);
    const total = satang(observedNumber(doc.payment_amount));
    const difference = total - sum;
    const status = difference === 0 ? 'pass' : 'fail';
    review.checks.push({
      rule: 'slip_allocation', record_id: doc.source_id, status,
      observed: total / 100, expected: sum / 100, difference: difference / 100,
      reason: status === 'pass' ? 'line amounts add up to the payment' : 'line amounts do not add up to the payment',
    });
    if (status === 'fail') doc.status = 'needs_review';
  }
  return review;
}

module.exports = { channelCheck, applyChecks, satang };
