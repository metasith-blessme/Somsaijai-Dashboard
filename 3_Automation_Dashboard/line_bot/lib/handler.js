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
const { makeApproval } = require('./approval');
const { publishApprovedBatch } = require('./publish');
const { loadCatalog, parseOrder, buildOrderMessages, buildSenderConfirm, isOrderReplay } = require('./orders');
const { parseGroupConfig } = require('./config');
const { ALBUM_HELP_TH } = require('./forms');

const PROCESSING_MS = 5 * 60 * 1000;
const OCR_FAIL_TH = 'อ่านรูปไม่สำเร็จ จะลองอ่านใหม่อีกครั้ง ถ้ายังไม่ได้ กรุณาส่งรูปนี้อีกครั้งในแชท';

function isIdCommand(text) {
  return /^(id|\/id|ไอดี)$/i.test(String(text || '').trim());
}
function isReviewCommand(text) {
  return /^(review|สรุป|\/review)$/i.test(String(text || '').trim());
}
function isHelpCommand(text) {
  return /^(help|\/help|ช่วย|วิธีส่งรูป)$/i.test(String(text || '').trim());
}

function groupTable(config) {
  if (config && config.groupTable instanceof Map) return config.groupTable;
  return parseGroupConfig(config && config.groupId);
}

function isAllowedOrderSender(source, config) {
  if (!source || source.type !== 'user' || !source.userId) return false;
  if (config.ownerUserId && source.userId === config.ownerUserId) return true;
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

async function finishBatch(batchId, parts, ctx) {
  const { store, config, line, extractImage } = ctx;
  const existing = await store.getJson(`batch:${batchId}`);
  if (existing && existing.review) return existing;

  const images = [];
  let failed = 0;
  for (const part of parts) {
    const saved = await store.getJson(`msg:${part.messageId}`);
    const bytes = await store.get(`bytes:${part.messageId}`);
    if (!saved || !bytes) continue;
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
    images.push({
      sourceId: part.messageId,
      sha256: saved.sha256,
      contentType: saved.contentType,
      extraction: reading.extraction,
      second: reading.second,
      secondError: reading.secondError,
      secondSkipped: reading.secondSkipped === true,
      branch_hint: ctx.branchHint || null,
      line_group_id: ctx.lineGroupId || null,
    });
  }
  if (images.length && failed === images.length) {
    const error = new Error(OCR_FAIL_TH);
    error.ocrFailed = true;
    try {
      await reply(line, ctx.replyToken, OCR_FAIL_TH);
      error.replied = true;
    } catch (replyErr) {
      error.replied = false;
    }
    throw error;
  }
  if (failed) ctx.ocrWarning = OCR_FAIL_TH;
  const review = applyChecks(buildReview({ batchId, images, now: new Date(ctx.now) }));
  await store.putJson(`review:${batchId}`, review);
  const summary = formatSummary(review, { publicUrl: config.publicUrl, channelSecret: config.channelSecret });
  if (ctx.setNote) {
    summary.text = `${ctx.setNote}\n\n${summary.text}`.slice(0, 4800);
    if (summary.messages[0]) summary.messages[0].text = summary.text;
  }
  const batch = { batch_id: batchId, review, summary_text: summary.text, created_at: ctx.now, status: 'pending_review' };
  await store.putJson(`batch:${batchId}`, batch);
  await store.putJson('latest:pending', { batch_id: batchId });

  if (config.ownerUserId) {
    try {
      await line.push(config.ownerUserId, summary.messages);
      batch.review_pushed = true;
    } catch (err) {
      batch.push_error = err.message || String(err);
      await reply(line, ctx.replyToken, `อ่านรูปแล้ว แต่ส่งเข้าแชทส่วนตัวไม่สำเร็จ (${batch.push_error}). เปิดแชทกับบอทแล้วพิมพ์ สรุป`);
    }
  } else {
    await reply(line, ctx.replyToken, 'อ่านรูปแล้ว แต่ยังไม่ได้ตั้ง LINE_OWNER_USER_ID จึงยังไม่ส่งให้คุณปานอนุมัติ');
  }
  await store.putJson(`batch:${batchId}`, batch);
  return batch;
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
  const batchCtx = { ...ctx, replyToken, setNote: note, ocrWarning: undefined };
  const batch = await finishBatch(batchId, summary.ordered, batchCtx);
  if (!batch.push_error && ctx.config.ownerUserId) {
    const warning = batchCtx.ocrWarning ? `\n${batchCtx.ocrWarning}` : '';
    const head = note
      ? `${note}\n${ALBUM_HELP_TH}`
      : `ได้รับรูปครบแล้ว ส่งสรุปให้คุณปานในแชทส่วนตัว ยังไม่ลงบัญชี\n${ALBUM_HELP_TH}`;
    try {
      await reply(ctx.line, replyToken, `${head}${warning}`);
    } catch (err) { /* a reply token expires before the two-minute fallback */ }
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
      await reply(ctx.line, replyToken, `รูปชุดนี้ซ้ำซ้อนกัน อ่านไม่ได้ ส่งใหม่อีกครั้งเป็นรูปในแชท\n${ALBUM_HELP_TH}`);
    } catch (err) { /* the reply token may already have been used */ }
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
    await reply(line, event.replyToken, `กลุ่มนี้คือ ${scope.groupId}\nตั้งค่า LINE_GROUP_ID เป็นค่านี้ก่อน บอทจึงจะอ่านรูป\nรหัสของคุณคือ ${event.source && event.source.userId}\n${ALBUM_HELP_TH}`);
    return { setup: true, groupId: scope.groupId };
  }
  ctx.branchHint = scope.branchHint || null;
  ctx.lineGroupId = scope.groupId || null;
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
        await reply(line, event.replyToken, `รูปนี้มาถึงหลังสรุปชุดแล้ว ถ้าเป็นรูปที่ขาด ให้ส่งรูปนั้นอีกครั้งเป็นข้อความใหม่\n${ALBUM_HELP_TH}`);
      } catch (err) { /* the reply token may already have been used */ }
    }
    return { late: true, duplicate: write.duplicate };
  }
  const summary = await loadSet(store, part.setId);
  if (summary.conflicts.length || summary.complete) {
    const outcome = await settleImageSet(part.setId, ctx, event.replyToken);
    if (outcome.claimed === false || outcome.skipped) return { claimed: false, pending: !summary.complete };
    return outcome;
  }
  scheduleImageSetTimeout(part.setId, ctx, event.replyToken);
  if (part.index === 1 && !write.duplicate) {
    const waitMin = Math.max(1, Math.round(IMAGE_SET_TIMEOUT_MS / 60000));
    await reply(line, event.replyToken, `ได้รับรูปชุดนี้แล้ว ${summary.have}/${summary.total} จะสรุปเมื่อครบ หรือภายใน ${waitMin} นาที\n${ALBUM_HELP_TH}`);
  }
  return { pending: true, have: summary.have, total: summary.total };
}

async function onPostback(event, ctx) {
  const source = event.source || {};
  const { action, batch } = parsePostback(event.postback && event.postback.data);
  if (!action || !batch) return { ignored: true };
  if (!ctx.config.ownerUserId || source.userId !== ctx.config.ownerUserId) {
    await reply(ctx.line, event.replyToken, 'เฉพาะคุณปานอนุมัติชุดนี้ได้');
    return { denied: true };
  }
  const review = await ctx.store.getJson(`review:${batch}`);
  const record = await ctx.store.getJson(`batch:${batch}`);
  if (!review || !record) {
    await reply(ctx.line, event.replyToken, 'ไม่พบชุดนี้แล้ว');
    return { missing: true };
  }
  if (action === 'reject') {
    if (record.status === 'published') {
      await reply(ctx.line, event.replyToken, 'ชุดนี้ลงบัญชีไปแล้ว ปุ่มไม่รับยกเลิกย้อนหลังไม่ได้');
      return { status: record.status };
    }
    record.status = 'rejected';
    record.approval = makeApproval({ review, userId: source.userId, decision: 'reject', at: new Date(ctx.now).toISOString() });
    await ctx.store.putJson(`batch:${batch}`, record);
    await reply(ctx.line, event.replyToken, `ไม่รับชุด ${batch} ไม่มีอะไรถูกเขียน`);
    return { status: 'rejected' };
  }
  if (action !== 'approve') return { ignored: true };
  if (record.status === 'published' && record.approval && record.approval.publish_receipt) {
    await reply(ctx.line, event.replyToken, `ชุด ${batch} ขึ้น dashboard ไปแล้ว ไม่ได้ทำซ้ำ`);
    return { status: 'published', duplicate: true };
  }
  const approval = record.approval && record.approval.decision === 'approve'
    ? record.approval
    : makeApproval({ review, userId: source.userId, decision: 'approve', at: new Date(ctx.now).toISOString() });
  record.approval = approval;
  record.status = 'approved';
  await ctx.store.putJson(`batch:${batch}`, record);
  const result = await publishApprovedBatch({
    review, approval, ownerUserId: ctx.config.ownerUserId, config: ctx.config, deps: ctx.deps,
  });
  if (result.status === 'published') {
    record.status = 'published';
    record.approval.publish_receipt = result;
  } else {
    record.last_result = { status: result.status, reason: result.reason || null, held: result.plan && result.plan.held };
  }
  await ctx.store.putJson(`batch:${batch}`, record);
  await reply(ctx.line, event.replyToken, result.message);
  return { status: result.status };
}

async function onText(event, ctx) {
  const text = event.message && event.message.text;
  const source = event.source || {};
  const scope = inScope(event, ctx.config);
  if (scope.foreign) return { ignored: 'foreign_group' };
  if (isIdCommand(text) || (event.type === 'join' && scope.setup)) {
    const lines = [`รหัสของคุณคือ ${source.userId || '(ไม่มี)'}`];
    if (source.groupId || scope.groupId) lines.push(`รหัสกลุ่มคือ ${source.groupId || scope.groupId}`);
    if (!ctx.config.groupId) lines.push('เอาสองค่านี้ไปใส่ LINE_OWNER_USER_ID และ LINE_GROUP_ID');
    if (source.type === 'group' || event.type === 'join') lines.push(ALBUM_HELP_TH);
    await reply(ctx.line, event.replyToken, lines.join('\n'));
    return { id: true };
  }
  if (scope.setup && event.type === 'message') {
    await reply(ctx.line, event.replyToken, `รหัสกลุ่มคือ ${scope.groupId} ตั้ง LINE_GROUP_ID ก่อน บอทจึงจะอ่านรูป\n${ALBUM_HELP_TH}`);
    return { setup: true };
  }
  if (isHelpCommand(text)) {
    await reply(ctx.line, event.replyToken, `${ALBUM_HELP_TH}\nเลือกหลายรูปแล้วส่งในแชทได้ อย่ากดอัลบั้ม`);
    return { help: true };
  }
  if (isReviewCommand(text)) {
    if (source.userId !== ctx.config.ownerUserId) {
      await reply(ctx.line, event.replyToken, 'เฉพาะคุณปานขอดูสรุปได้');
      return { denied: true };
    }
    const latest = await ctx.store.getJson('latest:pending');
    const review = latest && await ctx.store.getJson(`review:${latest.batch_id}`);
    if (!review) {
      await reply(ctx.line, event.replyToken, 'ยังไม่มีชุดที่รอตรวจ');
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
  return { ignored: true };
}

async function replayOrder(event, ctx) {
  const saved = await ctx.store.getJson('latest:order');
  if (!saved || !saved.messages) {
    await reply(ctx.line, event.replyToken, 'ยังไม่มีออเดอร์');
    return { empty: true };
  }
  await ctx.line.reply(event.replyToken, saved.messages);
  return { order_replay: true };
}

async function onOrder(event, ctx) {
  let catalog;
  try {
    catalog = orderCatalog(ctx);
  } catch (err) {
    await reply(ctx.line, event.replyToken, `อ่านรายชื่อร้านไม่ได้: ${(err.message || err).toString().slice(0, 200)}`);
    return { error: 'catalog' };
  }
  const parsed = parseOrder(event.message.text, catalog);
  if (!parsed.isOrder) return null;
  const packed = buildOrderMessages(parsed, catalog);
  const senderIsOwner = event.source.userId === ctx.config.ownerUserId;
  await ctx.store.putJson('latest:order', {
    at: ctx.now,
    from: event.source.userId,
    messages: packed.messages,
  });
  if (senderIsOwner) {
    await ctx.line.reply(event.replyToken, packed.messages);
    return { order: true, pushed: false, drafts: packed.drafts.length };
  }
  let pushed = false;
  if (ctx.config.ownerUserId && ctx.line) {
    try {
      await ctx.line.push(ctx.config.ownerUserId, packed.messages);
      pushed = true;
    } catch (err) {
      pushed = false;
    }
  }
  await reply(ctx.line, event.replyToken, buildSenderConfirm(parsed, { delivered: pushed, ownerSet: Boolean(ctx.config.ownerUserId) }));
  return { order: true, pushed, drafts: packed.drafts.length };
}

async function handleEvent(event, ctx) {
  const claim = await claimEvent(ctx.store, event, ctx.now);
  if (claim.duplicate) return { duplicate: true };
  try {
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
    if (!err.replied) {
      try {
        await reply(ctx.line, event.replyToken, `ทำไม่สำเร็จ: ${(err.message || err).toString().slice(0, 300)}`);
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

module.exports = { handleWebhook, handleEvent, isIdCommand, OCR_FAIL_TH };
