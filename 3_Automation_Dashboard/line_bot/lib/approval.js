const crypto = require('crypto');

class GateError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function sourceHash(review) {
  const list = (review.sources || []).map(s => s.sha256).filter(Boolean).sort();
  return crypto.createHash('sha256').update(list.join('\n')).digest('hex');
}

function payloadHash(review) {
  const body = {
    sources: sourceHash(review),
    records: (review.records || []).map(r => ({
      id: r.record_id,
      type: r.document_type,
      status: r.status,
      branch: r.branch && r.branch.value,
      branch_state: r.branch && r.branch.state,
      date: r.date && r.date.value,
      date_state: r.date && r.date.state,
      revenue: r.financials && r.financials.total_sales && r.financials.total_sales.value,
      cash: r.financials && r.financials.cash_sales && r.financials.cash_sales.value,
      scan: r.financials && r.financials.scan_sales && r.financials.scan_sales.value,
    })),
    expenses: (review.expense_documents || []).map(d => ({
      id: d.source_id,
      status: d.status,
      amount: d.payment_amount && d.payment_amount.value,
      date: d.payment_date && d.payment_date.value,
      memo: d.memo_lines || [],
    })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

function assertApproval({ review, approval, ownerUserId }) {
  if (!review || !review.review || review.review.import_allowed !== false) {
    throw new GateError('extractor_contract', 'The reading must keep import_allowed false. Approval is a separate record.');
  }
  if (!approval || approval.decision !== 'approve') {
    throw new GateError('not_approved', 'Nothing is imported without an owner approval.');
  }
  if (!ownerUserId || approval.approver_user_id !== ownerUserId) {
    throw new GateError('not_owner', 'This approval is not from the configured owner.');
  }
  if (approval.payload_hash !== payloadHash(review)) {
    throw new GateError('hash_mismatch', 'The approval does not match this reading.');
  }
  if (approval.source_hash !== sourceHash(review)) {
    throw new GateError('source_mismatch', 'The approval does not match these photos.');
  }
}

function makeApproval({ review, userId, decision, at }) {
  return {
    decision,
    approver_user_id: userId,
    approved_at: at,
    batch_id: review.batch_id,
    payload_hash: payloadHash(review),
    source_hash: sourceHash(review),
    import_allowed_on_extractor: false,
  };
}

module.exports = { GateError, sourceHash, payloadHash, assertApproval, makeApproval };
