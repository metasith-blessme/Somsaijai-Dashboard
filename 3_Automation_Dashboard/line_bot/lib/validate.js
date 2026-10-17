const { observedNumber } = require('./fields');
const { rowQtyCheck, rowAmountCheck, noteCheck, handwritingFlags } = require('./forms');

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

function lineSumCheck(record) {
  const total = observedNumber(record.financials && record.financials.total_sales);
  const items = (record.sales_items || []).filter(item => item && !item.struck);
  const amounts = items.map(item => observedNumber(item.amount)).filter(n => n != null);
  if (total == null || amounts.length === 0) {
    return {
      rule: 'line_sum',
      status: 'not_testable',
      observed: total,
      expected: null,
      difference: null,
      reason: 'total or line amounts were not observed',
    };
  }
  const expected = amounts.reduce((sum, n) => sum + satang(n), 0) / 100;
  const difference = Math.round((total - expected) * 100) / 100;
  return {
    rule: 'line_sum',
    status: difference === 0 ? 'pass' : 'fail',
    observed: total,
    expected,
    difference,
    reason: difference === 0
      ? 'line amounts add up to the written total'
      : 'line amounts do not add up to the written total',
  };
}

function netCheck(financials) {
  const total = observedNumber(financials && financials.total_sales);
  const expense = observedNumber(financials && financials.total_expense);
  const net = observedNumber(financials && financials.net_sales);
  if (total == null || expense == null || net == null) {
    return {
      rule: 'net',
      status: 'not_testable',
      observed: net,
      expected: null,
      difference: null,
      reason: 'total, expense, or net was not observed',
    };
  }
  const expected = Math.round((total - expense) * 100) / 100;
  const difference = Math.round((net - expected) * 100) / 100;
  return {
    rule: 'net',
    status: difference === 0 ? 'pass' : 'fail',
    observed: net,
    expected,
    difference,
    reason: difference === 0
      ? 'total minus expense equals the written net'
      : 'total minus expense does not equal the written net',
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
    const lineSum = lineSumCheck(record);
    lineSum.record_id = record.record_id;
    review.checks.push(lineSum);
    if (lineSum.status === 'fail') {
      record.status = 'needs_review';
      review.issues.push({ source_id: record.record_id, field: 'line_sum', issue: lineSum.reason });
    }
    const net = netCheck(record.financials || {});
    net.record_id = record.record_id;
    review.checks.push(net);
    if (net.status === 'fail') {
      record.status = 'needs_review';
      review.issues.push({ source_id: record.record_id, field: 'net', issue: net.reason });
    }
    for (const item of record.sales_items || []) {
      for (const flag of handwritingFlags(item)) {
        record.status = 'needs_review';
        review.issues.push({ source_id: record.record_id, field: flag.kind, issue: flag.text });
      }
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

module.exports = { channelCheck, lineSumCheck, netCheck, applyChecks, satang };
