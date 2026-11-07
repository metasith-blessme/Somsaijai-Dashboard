const { verifySignature } = require('./signature');
const {
  partFromMessage,
  partKey,
  doneKey,
  conflictKey,
  partPrefix,
  conflictPrefix,
  batchIdFor,
  summarizeParts,
  missingNote,
  IMAGE_SET_TIMEOUT_MS,
} = require('./image_set');
const { sha256, buildReview } = require('./normalize');
const { applyChecks } = require('./validate');
const { formatSummary, parsePostback } = require('./summary');
const { alreadyText, shortDay } = require('./words');
const { makeApproval, approvalMatchesReview } = require('./approval');
const { publishApprovedBatch, publishStock, publishCosts } = require('./publish');
const costs = require('./costs');
const stock = require('./stock');
const { loadCatalog, parseOrder, buildOrderMessages, buildSenderConfirm, isOrderReplay, packBubbles } = require('./orders');
const { parseGroupConfig, approversOf, isApprover } = require('./config');
const {
  qaEnabled,
  qaQuestion,
  isOwnerDirect,
  buildChatMessages,
  consumeQuota,
  dailyLimit,
  fetchSalesContext,
  askMinimax,
  QA_ERROR,
  QA_LIMIT,
  QA_EMPTY,
  QA_TIMEOUT_MS,
} = require('./qa');
const {
  ALBUM_HELP,
  OCR_FAIL,
  ONLY_PARN_APPROVE,
  ONLY_PARN_SUMMARY,
  SUMMARY_IS_PRIVATE,
  NO_ORDER,
  ORDER_REPLAY_NOTE,
  isIdCommand,
  isReviewCommand,
  isHelpCommand,
  idReply,
  unconfiguredPhoto,
  unconfiguredText,
  partialPhotos,
  conflictPhotos,
  photosDone,
  latePhoto,
  missingPhotosNote,
  pushFailed,
  ownerMissing,
  helpText,
  catalogFailed,
  wentWrong,
  readingPhoto,
  STOCK_SAVED,
  STOCK_SAVED_OWNER,
  STOCK_HOW,
} = require('./staff_text');

const PROCESSING_MS = 5 * 60 * 1000;
const SAME_PHOTOS = 'Got it. These photos were already sent, so no new card.';
const OCR_FAIL_TH = OCR_FAIL;

function groupTable(config) {
  if (config && config.groupTable instanceof Map) return config.groupTable;
  return parseGroupConfig(config && config.groupId);
}

function isAllowedOrderSender(source, config) {
  if (!source || source.type !== 'user' || !source.userId) return false;
  if (isApprover(source.userId, config)) return true;
  return (config.orderSenderUserIds || []).includes(source.userId);
}

function orderCatalog(ctx) {
  if (ctx.config.orderCatalog) return ctx.config.orderCatalog;
  if (!ctx._orderCatalog) ctx._orderCatalog = loadCatalog(ctx.config.suppliersPath);
  return ctx._orderCatalog;
}

async function claimEvent(store, event, now) {
  const id = event.webhookEventId || `${event.type}:${event.timestamp}:${(event.message && event.message.id) || ''}`;
  const key = `event:${id}`;
  const existing = await store.getJson(key);
  if (existing && existing.status === 'done') return { duplicate: true, key };
  if (existing && existing.status === 'processing' && now - existing.at < PROCESSING_MS) return { duplicate: true, key };
  await store.putJson(key, { status: 'processing', at: now });
  return { duplicate: false, key };
}

function inScope(event, config) {
  const source = event.source || {};
  if (source.type !== 'group') return { accept: true };
  const table = groupTable(config);
  if (table.size === 0) return { accept: false, setup: true, groupId: source.groupId };
  if (!table.has(source.groupId)) return { accept: false, foreign: true };
  return { accept: true, groupId: source.groupId, branchHint: table.get(source.groupId) };
}

async function reply(line, token, text) {
  if (!line || !token) return;
  await line.reply(token, [{ type: 'text', text: String(text).slice(0, 4800) }]);
}

/**
 * Reply with the token when there is one. A photo read takes 1–3 minutes and the
 * token is already spent on the "reading it now" note, so the answer then goes
 * out as a push to the chat the photo came from (ctx.pushTo). Never silent.
 */
async function answer(ctx, token, text) {
  if (token) {
    try {
      await reply(ctx.line, token, text);
      return { replied: true };
    } catch (err) {
      console.error(`[reply] ${(err && err.message) || err}`);
    }
  }
  if (ctx.pushTo && ctx.line && typeof ctx.line.push === 'function') {
    await ctx.line.push(ctx.pushTo, [{ type: 'text', text: String(text).slice(0, 4800) }]);
    return { pushed: true };
  }
  return { sent: false };
}

function chatOf(source) {
  if (!source) return null;
  if (source.type === 'group') return source.groupId || null;
  if (source.type === 'room') return source.roomId || null;
  return source.userId || null;
}

async function finishBatch(batchId, parts, ctx) {
  const { store, config, line, extractImage } = ctx;
  const existing = await store.getJson(`batch:${batchId}`);
  if (existing && existing.review) return existing;

  // All photos are read at once, so the last one gets the same time as the first.
  const loaded = [];
  for (const part of parts) {
    const saved = await store.getJson(`msg:${part.messageId}`);
    const bytes = await store.get(`bytes:${part.messageId}`);
    if (saved && bytes) loaded.push({ part, saved, bytes });
  }
  let failed = 0;
  const images = await Promise.all(loaded.map(async ({ part, saved, bytes }) => {
    let reading;
    try {
      reading = await extractImage({
        buf: bytes,
        mimeType: saved.contentType,
        apiKey: config.geminiKey,
        model: config.geminiModel,
        fallbackModel: config.geminiFallbackModel,
      });
    } catch (err) {
      failed += 1;
      reading = { extraction: null, second: null, secondError: err.message || String(err), secondSkipped: false };
    }
    return {
      sourceId: part.messageId,
      sha256: saved.sha256,
      contentType: saved.contentType,
      extraction: reading.extraction,
      second: reading.second,
      secondError: reading.secondError,
      secondSkipped: reading.secondSkipped === true,
      branch_hint: ctx.branchHint || null,
      line_group_id: ctx.lineGroupId || null,
    };
  }));
  if (images.length && failed === images.length) {
    const error = new Error(OCR_FAIL_TH);
    error.ocrFailed = true;
    try {
      const sent = await answer(ctx, ctx.replyToken, OCR_FAIL_TH);
      error.replied = sent.replied === true || sent.pushed === true;
    } catch (replyErr) {
      error.replied = false;
    }
    throw error;
  }
  if (failed) ctx.ocrWarning = OCR_FAIL_TH;
  const review = applyChecks(buildReview({ batchId, images, now: new Date(ctx.now) }));
  await store.putJson(`review:${batchId}`, review);

  // Stock counts wait for Parn's one daily digest, so a stock photo costs no push.
  const stockRecords = review.records.filter(r => r.document_type === 'stock_report');
  for (const record of stockRecords) {
    const image = images.find(i => i.sourceId === record.record_id) || {};
    await stock.saveList(store, stock.fromReviewRecord({
      record, sha256: image.sha256, now: ctx.now, source: ctx.source, branchHint: ctx.branchHint,
    }));
  }
  if (stockRecords.length && stockRecords.length === review.records.length && !(review.expense_documents || []).length) {
    const batch = { batch_id: batchId, review, created_at: ctx.now, status: 'stock' };
    await store.putJson(`batch:${batchId}`, batch);
    return batch;
  }
  const days = salesDays(review);
  const same = await sameSheetsAs(store, days);
  if (same) {
    // Staff sent the same photos again: the card Parn and Ming already have still stands.
    const batch = { batch_id: batchId, review, created_at: ctx.now, status: 'duplicate', duplicate_of: same };
    await store.putJson(`batch:${batchId}`, batch);
    return batch;
  }
  for (const d of days) await store.putJson(dayKey(d), { batch_id: batchId, sha256: d.sha256 });
  const summary = formatSummary(review, { publicUrl: config.publicUrl, channelSecret: config.channelSecret });
  if (ctx.setNote) {
    summary.text = `${ctx.setNote}\n\n${summary.text}`.slice(0, 4800);
    if (summary.messages[0]) summary.messages[0].text = summary.text;
  }
  const batch = { batch_id: batchId, review, summary_text: summary.text, created_at: ctx.now, status: 'pending_review' };
  await store.putJson(`batch:${batchId}`, batch);
  await store.putJson('latest:pending', { batch_id: batchId });

  const approvers = approversOf(config);
  if (approvers.length) {
    const sent = await pushEach(line, approvers, summary.messages);
    batch.review_pushed_to = sent.ok;
    batch.review_pushed = sent.ok.length > 0;
    if (!sent.ok.length) {
      batch.push_error = sent.errors[0];
      try { await answer({ ...ctx, pushTo: approvers.includes(ctx.pushTo) ? null : ctx.pushTo }, ctx.replyToken, pushFailed(batch.push_error)); }
      catch (replyErr) { console.error(replyErr); }
    }
  } else {
    try { await answer(ctx, ctx.replyToken, ownerMissing()); } catch (replyErr) { console.error(replyErr); }
  }
  await store.putJson(`batch:${batchId}`, batch);
  return batch;
}

/** One entry per sales sheet in a review: which branch and day it books, and its photo. */
function salesDays(review) {
  return (review.records || [])
    .filter(r => r.document_type === 'sales_report' && r.branch && r.branch.state === 'observed' && r.date && r.date.state === 'observed')
    .map(r => ({
      branch: r.branch.value,
      date: r.date.value,
      sha256: ((review.sources || []).find(s => s.source_id === r.record_id) || {}).sha256 || null,
    }));
}

function dayKey(d) {
  return `sales:day:${d.branch}:${d.date.replace(/\//g, '-')}`;
}

/** The batch that already carries exactly these sales photos, if every one matches. */
async function sameSheetsAs(store, days) {
  if (!days.length) return null;
  let batchId = null;
  for (const d of days) {
    const latest = await store.getJson(dayKey(d));
    if (!latest || !d.sha256 || latest.sha256 !== d.sha256) return null;
    if (batchId && batchId !== latest.batch_id) return null;
    batchId = latest.batch_id;
  }
  const earlier = await store.getJson(`batch:${batchId}`);
  return earlier && earlier.status !== 'rejected' ? batchId : null;
}

/** A newer card for one of these days, if staff re-sent the sheet after this one. */
async function newerCardFor(store, review) {
  for (const d of salesDays(review)) {
    const latest = await store.getJson(dayKey(d));
    if (latest && latest.batch_id !== review.batch_id) return { ...d, batch_id: latest.batch_id };
  }
  return null;
}

async function savePart(store, part) {
  const body = Buffer.from(JSON.stringify({
    setId: part.setId,
    messageId: part.messageId,
    index: part.index,
    total: part.total,
    sha256: part.sha256 || null,
  }));
  const written = await store.putIfAbsent(partKey(part.setId, part.index), body, 'application/json');
  if (written.created) return { duplicate: false, conflict: false };
  const existing = await store.getJson(partKey(part.setId, part.index));
  if (existing && existing.messageId === part.messageId) return { duplicate: true, conflict: false };
  await store.putIfAbsent(conflictKey(part.setId, part.index), Buffer.from(JSON.stringify({
    type: 'index_conflict',
    index: part.index,
    messageId: part.messageId,
    previous: existing && existing.messageId,
  })), 'application/json');
  return { duplicate: false, conflict: true };
}

async function loadSet(store, setId) {
  const parts = [];
  for (const key of await store.list(partPrefix(setId))) {
    const part = await store.getJson(key);
    if (part) parts.push(part);
  }
  const conflicts = [];
  for (const key of await store.list(conflictPrefix(setId))) {
    const row = await store.getJson(key);
    if (row) conflicts.push(row);
  }
  return summarizeParts(parts, conflicts);
}

async function claimSet(store, setId, reason) {
  const payload = Buffer.from(JSON.stringify({
    at: Date.now(),
    reason,
    claimId: require('crypto').randomUUID(),
  }));
  const result = await store.putIfAbsent(doneKey(setId), payload, 'application/json');
  return result.created === true;
}

function sleep(ms, ctx) {
  if (ctx && typeof ctx.sleep === 'function') return ctx.sleep(ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processClaimedSet(setId, summary, ctx, replyToken) {
  const batchId = batchIdFor(setId);
  const note = missingNote(summary);
  const staffNote = missingPhotosNote(summary);
  const batchCtx = { ...ctx, replyToken, setNote: note, ocrWarning: undefined };
  const batch = await finishBatch(batchId, summary.ordered, batchCtx);
  if (!batch.push_error && approversOf(ctx.config).length) {
    const warning = batchCtx.ocrWarning ? `\n${batchCtx.ocrWarning}` : '';
    const owner = isOwnerDirect(ctx.source, ctx.config);
    const head = batch.status === 'stock' ? (owner ? STOCK_SAVED_OWNER : STOCK_SAVED)
      : batch.status === 'duplicate' ? SAME_PHOTOS
        : (staffNote || (owner ? 'Card sent. Nothing is booked until you tap Approve.' : photosDone()));
    // Only with a live reply token. The chat already got "reading it now", and the
    // owner's own chat gets the summary card itself, so no extra push is spent here.
    if (replyToken) {
      try {
        await reply(ctx.line, replyToken, `${head}${warning}`);
      } catch (err) { /* a reply token expires before the two-minute fallback */ }
    } else if (warning && ctx.pushTo && !isApprover(ctx.pushTo, ctx.config)) {
      try { await answer(ctx, null, `${head}${warning}`); } catch (err) { console.error(err); }
    }
  }
  return { batch_id: batchId, status: batch.status, missing: summary.missing || [] };
}

async function settleImageSet(setId, ctx, replyToken) {
  if (await ctx.store.getJson(doneKey(setId))) return { skipped: true };
  const summary = await loadSet(ctx.store, setId);
  if (summary.conflicts.length) {
    const claimed = await claimSet(ctx.store, setId, 'conflict');
    if (!claimed) return { claimed: false };
    try {
      await answer(ctx, replyToken, conflictPhotos());
    } catch (err) { console.error(err); }
    return { conflict: true };
  }
  if (!summary.ordered.length) return { empty: true };
  const claimed = await claimSet(ctx.store, setId, summary.complete ? 'complete' : 'timeout');
  if (!claimed) return { claimed: false };
  try {
    return await processClaimedSet(setId, summary, ctx, replyToken);
  } catch (err) {
    // A failed read must not keep the claim, or LINE's retry cannot try again.
    try { await ctx.store.delete(doneKey(setId)); } catch (deleteErr) { console.error(deleteErr); }
    throw err;
  }
}

function scheduleImageSetTimeout(setId, ctx, replyToken) {
  if (typeof ctx.scheduleBackground !== 'function') return;
  const ms = Number.isFinite(ctx.imageSetTimeoutMs) && ctx.imageSetTimeoutMs >= 0
    ? ctx.imageSetTimeoutMs
    : IMAGE_SET_TIMEOUT_MS;
  const job = (async () => {
    await sleep(ms, ctx);
    try {
      await settleImageSet(setId, ctx, replyToken);
    } catch (err) {
      console.error(err);
    }
  })();
  ctx.scheduleBackground(job);
}

async function onImage(event, ctx) {
  const message = event.message;
  const { store, line } = ctx;
  const scope = inScope(event, ctx.config);
  if (scope.foreign) return { ignored: 'foreign_group' };
  if (scope.setup) {
    await reply(line, event.replyToken, unconfiguredPhoto({
      groupId: scope.groupId,
      userId: event.source && event.source.userId,
    }));
    return { setup: true, groupId: scope.groupId };
  }
  ctx.branchHint = scope.branchHint || null;
  ctx.lineGroupId = scope.groupId || null;
  ctx.pushTo = chatOf(event.source);
  ctx.source = event.source || null;
  const already = await store.getJson(`msg:${message.id}`);
  let saved = already;
  if (!already) {
    const content = await line.getContent(message.id);
    const hash = sha256(content.buf);
    saved = { messageId: message.id, sha256: hash, contentType: content.contentType };
    await store.put(`bytes:${message.id}`, content.buf);
    await store.putJson(`msg:${message.id}`, saved);
  }
  const part = partFromMessage(message);
  const write = await savePart(store, { ...part, sha256: saved.sha256 });
  if (await store.getJson(doneKey(part.setId))) {
    if (!write.duplicate) {
      try {
        await reply(line, event.replyToken, latePhoto());
      } catch (err) { /* the reply token may already have been used */ }
    }
    return { late: true, duplicate: write.duplicate };
  }
  const summary = await loadSet(store, part.setId);
  if (summary.conflicts.length || summary.complete) {
    let token = event.replyToken;
    if (!summary.conflicts.length && !write.duplicate) {
      // Answer at once. The read takes 1–3 minutes and used to leave the chat silent.
      try {
        await reply(line, token, readingPhoto(isOwnerDirect(event.source, ctx.config)));
        token = null;
      } catch (err) { console.error(`[reply] ${(err && err.message) || err}`); }
    }
    const outcome = await settleImageSet(part.setId, ctx, token);
    if (outcome.claimed === false || outcome.skipped) return { claimed: false, pending: !summary.complete };
    return outcome;
  }
  scheduleImageSetTimeout(part.setId, ctx, event.replyToken);
  if (part.index === 1 && !write.duplicate) {
    const waitMin = Math.max(1, Math.round(IMAGE_SET_TIMEOUT_MS / 60000));
    await reply(line, event.replyToken, partialPhotos(summary.have, summary.total, waitMin));
  }
  return { pending: true, have: summary.have, total: summary.total };
}

async function onPostback(event, ctx) {
  const source = event.source || {};
  const { action, batch } = parsePostback(event.postback && event.postback.data);
  if (!action || !batch) return { ignored: true };
  if (!isApprover(source.userId, ctx.config)) {
    await reply(ctx.line, event.replyToken, ONLY_PARN_APPROVE);
    return { denied: true };
  }
  const by = { userId: source.userId, name: await displayName(ctx, source.userId) };
  if (action === 'stock_approve' || action === 'stock_reject') {
    const decision = action === 'stock_approve' ? 'approve' : 'reject';
    const claim = await claimDecision(ctx.store, `stock:${batch}`, decision, by, ctx.now);
    if (!claim.created) {
      const who = claim.existing;
      if (!who.name && who.userId) who.name = await displayName(ctx, who.userId);
      await reply(ctx.line, event.replyToken, alreadyText(who));
      return { stock: 'already' };
    }
    const outcome = await stock.decideDigest({
      store: ctx.store,
      digestId: batch,
      decision,
      by,
      now: ctx.now,
      nameOf: userId => displayName(ctx, userId),
      publish: (rows, id) => publishStock({ rows, digestId: id, config: ctx.config, deps: ctx.deps }),
    });
    if (!['published', 'rejected'].includes(outcome.status)) await releaseDecision(ctx.store, `stock:${batch}`);
    await reply(ctx.line, event.replyToken, outcome.message);
    return { stock: outcome.status };
  }
  const review = await ctx.store.getJson(`review:${batch}`);
  const record = await ctx.store.getJson(`batch:${batch}`);
  if (!review || !record) {
    await reply(ctx.line, event.replyToken, 'That card has expired. Send the photo again.');
    return { missing: true };
  }
  if (action !== 'approve' && action !== 'reject') return { ignored: true };
  // One decision per batch, whoever taps first. A failed publish frees it for a retry.
  const decided = decidedBy(record);
  const claim = decided ? null : await claimDecision(ctx.store, `batch:${batch}`, action, by, ctx.now);
  if (decided || !claim.created) {
    const who = decided || claim.existing;
    if (!who.name && who.userId) who.name = await displayName(ctx, who.userId);
    await reply(ctx.line, event.replyToken, alreadyText(who));
    return { status: 'already', decision: who.decision, by: who.userId };
  }
  if (action === 'reject') {
    record.status = 'rejected';
    record.approval = makeApproval({ review, userId: source.userId, name: by.name, decision: 'reject', at: new Date(ctx.now).toISOString() });
    await ctx.store.putJson(`batch:${batch}`, record);
    await reply(ctx.line, event.replyToken, 'Rejected. Nothing booked.');
    return { status: 'rejected' };
  }
  const newer = await newerCardFor(ctx.store, review);
  if (newer) {
    await releaseDecision(ctx.store, `batch:${batch}`);
    await reply(ctx.line, event.replyToken, `A newer photo of ${newer.branch} ${shortDay(newer.date)} came in. Use the newest card. Nothing booked.`);
    return { status: 'superseded', by: newer.batch_id };
  }
  // Reuse a saved approval only while it still describes this review. A rewritten
  // reading (the 2-digit year fix, for example) gets a new approval from this tap.
  // assertApproval still rejects a mismatched approval if one is passed through.
  const previous = record.approval;
  const reusable = previous && previous.decision === 'approve' && approvalMatchesReview(previous, review);
  const approval = reusable
    ? { ...previous, approver_user_id: source.userId, approver_name: by.name }
    : makeApproval({ review, userId: source.userId, name: by.name, decision: 'approve', at: new Date(ctx.now).toISOString() });
  if (previous && previous.decision === 'approve' && !reusable) {
    console.error(`[publish] stale approval regenerated for ${batch}`);
  }
  record.approval = approval;
  record.status = 'approved';
  await ctx.store.putJson(`batch:${batch}`, record);
  let result;
  try {
    result = await publishApprovedBatch({
      review, approval, approverUserIds: approversOf(ctx.config), config: ctx.config, deps: ctx.deps,
    });
  } catch (err) {
    await releaseDecision(ctx.store, `batch:${batch}`);
    const step = err.step || err.code || 'publish';
    const reason = (err.message || String(err)).toString().replace(/\s+/g, ' ').trim().slice(0, 300);
    console.error(`[publish] ${step}: ${reason}`);
    record.last_result = { status: 'error', step, reason };
    await ctx.store.putJson(`batch:${batch}`, record);
    await reply(ctx.line, event.replyToken, `Could not book (${step}): ${reason}`);
    return { status: 'error', step, reason };
  }
  // Only a booked card is final. Anything else can be tapped again.
  if (result.status !== 'published') await releaseDecision(ctx.store, `batch:${batch}`);
  if (result.status === 'published') {
    record.status = 'published';
    record.approval.publish_receipt = result;
  } else {
    record.last_result = {
      status: result.status,
      step: result.step || null,
      reason: result.reason || null,
      held: result.plan && result.plan.held,
    };
  }
  await ctx.store.putJson(`batch:${batch}`, record);
  await reply(ctx.line, event.replyToken, result.message);
  return { status: result.status, step: result.step || null };
}

async function onText(event, ctx) {
  const text = event.message && event.message.text;
  const source = event.source || {};
  const scope = inScope(event, ctx.config);
  if (scope.foreign) return { ignored: 'foreign_group' };
  if (isIdCommand(text) || (event.type === 'join' && scope.setup)) {
    await reply(ctx.line, event.replyToken, idReply({
      userId: source.userId,
      groupId: source.groupId || scope.groupId,
      groupsLocked: Boolean(ctx.config.groupId),
      inGroup: source.type === 'group' || event.type === 'join',
    }));
    return { id: true };
  }
  if (scope.setup && event.type === 'message') {
    await reply(ctx.line, event.replyToken, unconfiguredText(scope.groupId));
    return { setup: true };
  }
  if (isHelpCommand(text)) {
    await reply(ctx.line, event.replyToken, helpText(isOwnerDirect(source, ctx.config)));
    return { help: true };
  }
  if (/^(?:\/?senders|ผู้ส่ง|ใครทัก)$/i.test(String(text || '').trim()) && isOwnerDirect(source, ctx.config)) {
    await reply(ctx.line, event.replyToken, await sendersText(ctx.store));
    return { senders: true };
  }
  if (costs.isCostCommand(text) && source.type === 'user' && source.userId && source.userId === ctx.config.ownerUserId) {
    return onCost(event, ctx);
  }
  if (stock.isStockCommand(text)) return onStockCommand(event, ctx);
  const saved = stock.isStockText(text) && stock.fromText({
    id: event.message.id, text, now: ctx.now, source, branchHint: scope.branchHint,
  });
  // "stock left for orange?" from Parn is a question, not a count; staff get the format.
  if (saved && !saved.rows.length && !isOwnerDirect(source, ctx.config)) {
    await reply(ctx.line, event.replyToken, STOCK_HOW);
    return { stock_help: true };
  }
  if (saved && saved.rows.length) {
    await stock.saveList(ctx.store, saved);
    await reply(ctx.line, event.replyToken, isOwnerDirect(source, ctx.config) ? STOCK_SAVED_OWNER : STOCK_SAVED);
    return { stock: saved.id, rows: saved.rows.length, flags: saved.flags };
  }
  if (isReviewCommand(text)) {
    if (source.type !== 'user') {
      await reply(ctx.line, event.replyToken, isApprover(source.userId, ctx.config) ? SUMMARY_IS_PRIVATE : ONLY_PARN_SUMMARY);
      return { denied: true };
    }
    if (!isApprover(source.userId, ctx.config)) {
      await reply(ctx.line, event.replyToken, ONLY_PARN_SUMMARY);
      return { denied: true };
    }
    const latest = await ctx.store.getJson('latest:pending');
    const review = latest && await ctx.store.getJson(`review:${latest.batch_id}`);
    if (!review) {
      await reply(ctx.line, event.replyToken, 'Nothing waiting for review.');
      return { empty: true };
    }
    const summary = formatSummary(review, { publicUrl: ctx.config.publicUrl, channelSecret: ctx.config.channelSecret });
    await ctx.line.reply(event.replyToken, summary.messages);
    return { batch_id: latest.batch_id };
  }
  if (source.type === 'user' && isAllowedOrderSender(source, ctx.config)) {
    if (isOrderReplay(text)) return replayOrder(event, ctx);
    const outcome = await onOrder(event, ctx);
    if (outcome) return outcome;
  }
  const answered = await onQuestion(event, ctx);
  if (answered) return answered;
  return { ignored: true };
}

/** Parn: "ผู้ส่ง". Who has messaged the bot 1:1, newest first, so a new approver's id is easy to find. */
async function sendersText(store) {
  const entries = [];
  for (const key of await store.list('sender:')) {
    const entry = await store.getJson(key);
    if (entry && entry.first_seen_at) entries.push(entry);
  }
  if (!entries.length) return 'No one new has messaged the bot.';
  entries.sort((a, b) => b.first_seen_at.localeCompare(a.first_seen_at));
  return entries.slice(0, 15)
    .map(e => `${e.display_name || '(no name)'}\n${e.user_id}\n${e.first_seen_at.slice(0, 10)}`)
    .join('\n\n');
}

/** Parn only: "cost B1 Nov 12000 rent" books one month-end cost row. */
async function onCost(event, ctx) {
  const parsed = costs.parseCost(event.message.text, ctx.now);
  if (parsed.error) {
    await reply(ctx.line, event.replyToken, parsed.error);
    return { cost: 'usage' };
  }
  const result = await publishCosts({ rows: [parsed.row], config: ctx.config, deps: ctx.deps });
  const text = result.status === 'published'
    ? costs.costSaved(parsed.row)
    : `Cost not saved (${result.step || result.status}): ${result.reason || ''}`.trim().slice(0, 400);
  await reply(ctx.line, event.replyToken, text);
  return { cost: result.status, row: parsed.row };
}

/** "สต็อก" alone: Parn sees the open stock lists as a free reply; staff get the format. */
async function onStockCommand(event, ctx) {
  if (!isOwnerDirect(event.source, ctx.config)) {
    await reply(ctx.line, event.replyToken, STOCK_HOW);
    return { stock_help: true };
  }
  const opened = await stock.replyDigest({ store: ctx.store, now: ctx.now });
  if (!opened) {
    await reply(ctx.line, event.replyToken, 'No stock lists waiting.');
    return { stock_empty: true };
  }
  await ctx.line.reply(event.replyToken, opened.messages);
  return { stock_digest: opened.digest.id };
}

async function onQuestion(event, ctx) {
  if (!qaEnabled(ctx.config)) return null;
  const parsed = qaQuestion(event);
  if (!parsed) return null;
  if (!parsed.question) {
    await reply(ctx.line, event.replyToken, QA_EMPTY);
    return { qa: true, empty: true };
  }
  const source = event.source || {};
  const userId = source.userId || 'anonymous';
  let quota;
  try {
    quota = await consumeQuota(ctx.store, userId, ctx.now, dailyLimit(ctx.config));
  } catch (err) {
    await reply(ctx.line, event.replyToken, QA_ERROR);
    return { qa: true, error: true };
  }
  if (!quota.allowed) {
    await reply(ctx.line, event.replyToken, QA_LIMIT);
    return { qa: true, limited: true };
  }
  const owner = isOwnerDirect(source, ctx.config);
  let salesContext = null;
  if (owner) {
    try {
      salesContext = await fetchSalesContext({
        publicUrl: ctx.config.publicUrl,
        fetchImpl: ctx.fetchImpl,
        now: ctx.now,
        timeoutMs: ctx.config.salesTimeoutMs,
      });
    } catch (err) {
      salesContext = null;
    }
  }
  const messages = buildChatMessages({
    owner,
    question: parsed.question,
    salesContext: owner ? salesContext : null,
  });
  try {
    const answer = await askMinimax({
      apiKey: ctx.config.minimaxKey,
      model: ctx.config.minimaxModel,
      messages,
      fetchImpl: ctx.fetchImpl,
      timeoutMs: ctx.config.qaTimeoutMs || QA_TIMEOUT_MS,
      maxTokens: ctx.config.qaMaxTokens,
    });
    await reply(ctx.line, event.replyToken, answer);
    return { qa: true, owner };
  } catch (err) {
    await reply(ctx.line, event.replyToken, QA_ERROR);
    return { qa: true, error: true };
  }
}

async function replayOrder(event, ctx) {
  const saved = await ctx.store.getJson('latest:order');
  if (!saved || !saved.messages) {
    await reply(ctx.line, event.replyToken, NO_ORDER);
    return { empty: true };
  }
  if (event.source && isApprover(event.source.userId, ctx.config)) {
    await ctx.line.reply(event.replyToken, saved.messages);
  } else {
    await ctx.line.reply(event.replyToken, packBubbles({ type: 'text', text: ORDER_REPLAY_NOTE }, saved.messages.slice(1)));
  }
  return { order_replay: true };
}

async function onOrder(event, ctx) {
  let catalog;
  try {
    catalog = orderCatalog(ctx);
  } catch (err) {
    await reply(ctx.line, event.replyToken, catalogFailed((err.message || err).toString()));
    return { error: 'catalog' };
  }
  const parsed = parseOrder(event.message.text, catalog);
  if (!parsed.isOrder) return null;
  const packed = buildOrderMessages(parsed, catalog);
  const sender = event.source.userId;
  await ctx.store.putJson('latest:order', {
    at: ctx.now,
    from: sender,
    messages: packed.messages,
  });
  if (sender === ctx.config.ownerUserId) {
    await ctx.line.reply(event.replyToken, packed.messages);
    return { order: true, pushed: false, drafts: packed.drafts.length };
  }
  // Parn always gets the drafts. An approver who sent the order gets them free in
  // the reply; everyone else just gets the confirmation.
  const senderApproves = isApprover(sender, ctx.config);
  const targets = approversOf(ctx.config).filter(id => id !== sender);
  const sent = ctx.line ? await pushEach(ctx.line, targets, packed.messages) : { ok: [] };
  const pushed = sent.ok.length > 0;
  if (senderApproves) {
    const note = { type: 'text', text: buildSenderConfirm(parsed, { delivered: pushed, ownerSet: Boolean(ctx.config.ownerUserId) }) };
    await ctx.line.reply(event.replyToken, packBubbles(note, packed.messages.slice(1)));
    return { order: true, pushed, drafts: packed.drafts.length };
  }
  await reply(ctx.line, event.replyToken, buildSenderConfirm(parsed, { delivered: pushed, ownerSet: Boolean(ctx.config.ownerUserId) }));
  return { order: true, pushed, drafts: packed.drafts.length };
}

async function pushEach(line, userIds, messages) {
  const ok = [];
  const errors = [];
  for (const id of userIds) {
    try {
      await line.push(id, messages);
      ok.push(id);
    } catch (err) {
      errors.push((err && err.message) || String(err));
    }
  }
  return { ok, errors };
}

/** LINE profile name, cached in the sender log. The userId tail when LINE has none. */
async function displayName(ctx, userId) {
  const known = await ctx.store.getJson(`sender:${userId}`);
  if (known && known.display_name) return known.display_name;
  try {
    if (ctx.line && typeof ctx.line.profile === 'function') {
      const profile = await ctx.line.profile(userId);
      if (profile && profile.displayName) {
        await ctx.store.putJson(`sender:${userId}`, { ...(known || { user_id: userId, first_seen_at: new Date(ctx.now).toISOString() }), display_name: profile.displayName });
        return profile.displayName;
      }
    }
  } catch (err) { console.error(`[profile] ${(err && err.message) || err}`); }
  return `…${String(userId).slice(-6)}`;
}

function decidedBy(record) {
  const a = record && record.approval;
  if (!a || !['published', 'rejected'].includes(record.status)) return null;
  return { decision: a.decision, userId: a.approver_user_id, name: a.approver_name };
}

/**
 * The first tap wins. A claim older than a publish can run (5 min) is left from a
 * cut-off run, and the next tap takes it over.
 */
async function claimDecision(store, key, decision, by, now) {
  const body = { decision, userId: by.userId, name: by.name, at: new Date(now).toISOString() };
  const put = await store.putIfAbsent(`decision:${key}`, Buffer.from(JSON.stringify(body)), 'application/json');
  if (!put || put.created !== false) return { created: true };
  const existing = await store.getJson(`decision:${key}`);
  if (existing && now - Date.parse(existing.at) > PROCESSING_MS) {
    await store.putJson(`decision:${key}`, body);
    return { created: true };
  }
  return { created: false, existing: existing || body };
}

async function releaseDecision(store, key) {
  try { await store.delete(`decision:${key}`); } catch (err) { console.error(err); }
}

/** First 1:1 message from someone who is not an approver: keep their id and LINE name. */
async function logNewSender(event, ctx) {
  const source = event.source || {};
  if (source.type !== 'user' || !source.userId || isApprover(source.userId, ctx.config)) return;
  const key = `sender:${source.userId}`;
  if (await ctx.store.getJson(key)) return;
  let name = null;
  try {
    if (ctx.line && typeof ctx.line.profile === 'function') name = (await ctx.line.profile(source.userId)).displayName || null;
  } catch (err) { console.error(`[profile] ${(err && err.message) || err}`); }
  const entry = {
    user_id: source.userId,
    display_name: name,
    first_seen_at: new Date(ctx.now).toISOString(),
    first_event: event.type === 'message' && event.message ? `message:${event.message.type}` : event.type,
    first_text: event.message && event.message.type === 'text' ? String(event.message.text || '').slice(0, 60) : null,
  };
  await ctx.store.putIfAbsent(key, Buffer.from(JSON.stringify(entry)), 'application/json');
  console.log(`[sender] new 1:1 sender ${source.userId} ${JSON.stringify(name)}`);
}

async function handleEvent(event, ctx) {
  const claim = await claimEvent(ctx.store, event, ctx.now);
  if (claim.duplicate) return { duplicate: true };
  try {
    try { await logNewSender(event, ctx); } catch (err) { console.error(`[sender] ${(err && err.message) || err}`); }
    let outcome;
    if (event.type === 'message' && event.message && event.message.type === 'image') outcome = await onImage(event, ctx);
    else if (event.type === 'postback') outcome = await onPostback(event, ctx);
    else if (event.type === 'message' && event.message && event.message.type === 'text') outcome = await onText(event, ctx);
    else if (event.type === 'join') outcome = await onText({ ...event, message: { text: 'id' } }, ctx);
    else outcome = { ignored: event.type };
    await ctx.store.putJson(claim.key, { status: 'done', at: ctx.now });
    return outcome;
  } catch (err) {
    await ctx.store.putJson(claim.key, { status: 'error', at: ctx.now, message: err.message || String(err) });
    console.error(`[event] ${(err && err.message) || err}`);
    if (!err.replied) {
      try {
        await answer(ctx, event.replyToken, wentWrong((err.message || err).toString()));
      } catch (replyErr) { /* the reply token may already have been used */ }
    }
    return { error: err.message || String(err) };
  }
}

async function handleWebhook({ rawBody, signature, ctx }) {
  if (!verifySignature(rawBody, signature, ctx.config.channelSecret)) {
    return { status: 401, body: 'invalid signature' };
  }
  let payload;
  try { payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody)); }
  catch (e) { return { status: 400, body: 'bad json' }; }
  const outcomes = [];
  for (const event of payload.events || []) outcomes.push(await handleEvent(event, ctx));
  return { status: 200, body: 'ok', outcomes };
}

module.exports = {
  handleWebhook,
  handleEvent,
  isIdCommand,
  isReviewCommand,
  isHelpCommand,
  OCR_FAIL,
  OCR_FAIL_TH,
  ALBUM_HELP,
};
