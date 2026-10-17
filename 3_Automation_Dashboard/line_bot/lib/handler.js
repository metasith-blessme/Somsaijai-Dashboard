const { verifySignature } = require('./signature');
const { partFromMessage, emptySet, addPart, orderedParts } = require('./image_set');
const { sha256, buildReview } = require('./normalize');
const { applyChecks } = require('./validate');
const { formatSummary, parsePostback } = require('./summary');
const { makeApproval } = require('./approval');
const { publishApprovedBatch } = require('./publish');
const { loadCatalog, parseOrder, buildOrderMessages, buildSenderConfirm, isOrderReplay } = require('./orders');

const PROCESSING_MS = 5 * 60 * 1000;

function isIdCommand(text) {
  return /^(id|\/id|ไอดี)$/i.test(String(text || '').trim());
}
function isReviewCommand(text) {
  return /^(review|สรุป|\/review)$/i.test(String(text || '').trim());
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
  if (!config.groupId) return { accept: false, setup: true, groupId: source.groupId };
  if (source.groupId !== config.groupId) return { accept: false, foreign: true };
  return { accept: true, groupId: source.groupId };
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
  for (const part of parts) {
    const saved = await store.getJson(`msg:${part.messageId}`);
    const bytes = await store.get(`bytes:${part.messageId}`);
    if (!saved || !bytes) continue;
    let reading;
    try {
      reading = await extractImage({ buf: bytes, mimeType: saved.contentType, apiKey: config.geminiKey, model: config.geminiModel });
    } catch (err) {
      reading = { extraction: null, second: null, secondError: err.message || String(err) };
    }
    images.push({
      sourceId: part.messageId,
      sha256: saved.sha256,
      contentType: saved.contentType,
      extraction: reading.extraction,
      second: reading.second,
      secondError: reading.secondError,
    });
  }
  const review = applyChecks(buildReview({ batchId, images }));
  await store.putJson(`review:${batchId}`, review);
  const summary = formatSummary(review, { publicUrl: config.publicUrl, channelSecret: config.channelSecret });
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

async function onImage(event, ctx) {
  const message = event.message;
  const { store, line } = ctx;
  const scope = inScope(event, ctx.config);
  if (scope.foreign) return { ignored: 'foreign_group' };
  if (scope.setup) {
    await reply(line, event.replyToken, `กลุ่มนี้คือ ${scope.groupId}\nตั้งค่า LINE_GROUP_ID เป็นค่านี้ก่อน บอทจึงจะอ่านรูป\nรหัสของคุณคือ ${event.source && event.source.userId}`);
    return { setup: true, groupId: scope.groupId };
  }
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
  const key = `set:${part.setId}`;
  const state = (await store.getJson(key)) || emptySet(part.setId, part.total);
  const result = addPart(state, { ...part, sha256: saved.sha256 });
  await store.putJson(key, state);
  if (!result.complete) {
    if (part.index === 1 && !result.duplicate) {
      await reply(line, event.replyToken, `ได้รับรูปชุดนี้แล้ว ${Object.keys(state.parts).length}/${state.total} จะสรุปเมื่อครบ`);
    }
    return { pending: true, have: Object.keys(state.parts).length, total: state.total };
  }
  if (state.conflicts.length) {
    await reply(line, event.replyToken, 'รูปชุดนี้ซ้ำซ้อนกัน อ่านไม่ได้ ส่งใหม่อีกครั้งเป็นรูปในแชท ไม่ใช่อัลบั้ม');
    return { conflict: true };
  }
  const batchId = `set_${part.setId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  ctx.replyToken = event.replyToken;
  const batch = await finishBatch(batchId, orderedParts(state), ctx);
  if (!batch.push_error && ctx.config.ownerUserId) {
    await reply(line, event.replyToken, 'ได้รับรูปครบแล้ว ส่งสรุปให้คุณปานในแชทส่วนตัว ยังไม่ลงบัญชี');
  }
  return { batch_id: batchId, status: batch.status };
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
    await reply(ctx.line, event.replyToken, lines.join('\n'));
    return { id: true };
  }
  if (scope.setup && event.type === 'message') {
    await reply(ctx.line, event.replyToken, `รหัสกลุ่มคือ ${scope.groupId} ตั้ง LINE_GROUP_ID ก่อน บอทจึงจะอ่านรูป`);
    return { setup: true };
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
    try {
      await reply(ctx.line, event.replyToken, `ทำไม่สำเร็จ: ${(err.message || err).toString().slice(0, 300)}`);
    } catch (replyErr) { /* the reply token may already have been used */ }
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

module.exports = { handleWebhook, handleEvent, isIdCommand };
