const { branchField } = require('./normalize');
const { normalizeDate, dateAgeIssue, calendarOk } = require('./dates');

/**
 * A stock list is one count sent by staff, as a photo or as text.
 *
 * StockList {
 *   id, kind: 'photo' | 'text', received_at, from_user, chat_id,
 *   raw_text, source_id, sha256,
 *   branch: { value: 'B1'..'B4' | null, state, raw_text },
 *   date:   { value: 'dd/mm/yyyy' | null, state, raw_text },
 *   rows:   [{ item_raw, qty: number | null, unit: string | null, delivered: number | null, uncertain }],
 *   flags:  [string],
 *   status: 'pending' | 'approved' | 'published' | 'rejected',
 *   seen_in: digest id | null,
 * }
 *
 * Items are kept exactly as staff wrote them. A list without a branch, a date,
 * or one counted row is held at approval; nothing is guessed to fill it.
 */

const STATUS = { pending: 'pending', approved: 'approved', published: 'published', rejected: 'rejected' };
const OPEN = new Set([STATUS.pending, STATUS.approved]);

const listKey = id => `stock:list:${id}`;
const digestKey = id => `stock:digest:${id}`;
const dayKey = day => `stock:digestday:${day}`;

const KEYWORD_RE = /^\s*(?:\/)?(?:stock|สต็อก|สต๊อก|สต็อค|สต๊อค)(?![a-z])\s*[:\-]?/i;
const DELIVERED_RE = /(?:\(\s*|\s+|^|(?=\+))(?:\+|in\b|received\b|deliver(?:ed|y)?\b|got\b|รับเข้า|รับ|เข้า)\s*:?\s*(\d+(?:[.,]\d+)?)\s*[^\d()]*\)?\s*$/i;
const ROW_RE = /^(.+?)\s*(?:[:=]\s*|\s*)(\d+(?:[.,]\d+)?)\s*([^\d]*)$/;
const DATE_RE = /(\d{1,2})\s*[./\-]\s*(\d{1,2})(?:\s*[./\-]\s*(\d{2,4}))?/;

function bangkokDay(now) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(now));
  const pick = type => parts.find(p => p.type === type).value;
  return { iso: `${pick('year')}-${pick('month')}-${pick('day')}`, dmy: `${pick('day')}/${pick('month')}/${pick('year')}`, year: Number(pick('year')) };
}

function num(raw) {
  return raw == null ? null : Number(String(raw).replace(',', '.'));
}

/** "stock" alone is Parn's view command; a stock list has at least one line under the keyword. */
function isStockText(text) {
  const t = String(text || '');
  return KEYWORD_RE.test(t) && t.replace(KEYWORD_RE, '').trim().length > 0;
}

function isStockCommand(text) {
  const t = String(text || '').trim();
  return KEYWORD_RE.test(t) && t.replace(KEYWORD_RE, '').trim().length === 0;
}

function textDate(raw, now) {
  const m = DATE_RE.exec(raw || '');
  if (!m) return null;
  if (m[3]) {
    const date = normalizeDate(m[0]);
    return date.state === 'observed' ? { ...date, raw_text: m[0] } : null;
  }
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = bangkokDay(now).year;
  if (!calendarOk(d, mo, y)) return null;
  return {
    raw_text: m[0],
    value: `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')}/${y}`,
    state: 'observed',
    note: `year not written; used ${y}`,
  };
}

function headerBits(line, now) {
  const branch = branchField(line);
  const date = textDate(line, now);
  let rest = line;
  if (date) rest = rest.replace(date.raw_text, ' ');
  if (branch.state === 'observed') {
    rest = rest.replace(/\bB[\s.\-]*0?[1-5]\b/i, ' ').replace(/สาขา\s*[1-4]/, ' ').replace(/platinum\s*pop|แพลตตินัม|แพลทินัม/i, ' ');
  }
  rest = rest.replace(/\b(?:branch|date|day)\b|วันที่|สาขา|[,:\-]/gi, ' ').trim();
  return { branch: branch.state === 'observed' ? branch : null, date, rest };
}

function parseRow(line) {
  let body = line.replace(/^(?:[\s\-•*·]+|\d+[.)]\s+)+/, '').trim();
  let delivered = null;
  const d = DELIVERED_RE.exec(body);
  if (d) {
    delivered = num(d[1]);
    body = body.slice(0, d.index).trim();
  }
  const m = ROW_RE.exec(body);
  if (!m || !/[^\s\d.,:=]/.test(m[1])) return null;
  return { item_raw: m[1].trim(), qty: num(m[2]), unit: m[3].trim() || null, delivered, uncertain: false };
}

/** Parse a "stock" / "สต็อก" text. Returns { branch, date, rows, unread, flags }. */
function parseStockText(text, now) {
  const lines = String(text || '').split(/\r?\n/);
  lines[0] = lines[0].replace(KEYWORD_RE, '');
  let branch = null;
  let date = null;
  const rows = [];
  const unread = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const head = headerBits(line, now);
    if ((head.branch || head.date) && !head.rest) {
      branch = branch || head.branch;
      date = date || head.date;
      continue;
    }
    const row = parseRow(line);
    if (row) rows.push(row);
    else unread.push(line);
  }
  return { branch, date, rows, unread };
}

function finishFlags(list, now) {
  const flags = list.flags;
  if (list.branch.state !== 'observed') flags.push('branch not written');
  if (list.date.state !== 'observed') flags.push('date not written');
  if (list.date.note) flags.push(list.date.note);
  if (list.branch.note) flags.push(list.branch.note);
  if (list.date.value) {
    const age = dateAgeIssue(list.date.value, now);
    if (age) flags.push(age);
  }
  if (!list.rows.length) flags.push('no rows read');
  const unclear = list.rows.filter(r => r.qty == null || r.uncertain).length;
  if (unclear) flags.push(`${unclear} row(s) unclear`);
  if (list.branch_hint && list.branch.value && list.branch.value !== list.branch_hint) {
    flags.push(`list says ${list.branch.value} but this LINE group is ${list.branch_hint}`);
  }
  return list;
}

function baseList({ id, kind, now, source, branchHint }) {
  return {
    id,
    kind,
    received_at: new Date(now).toISOString(),
    from_user: (source && source.userId) || null,
    chat_id: source ? (source.groupId || source.roomId || source.userId || null) : null,
    branch_hint: branchHint || null,
    raw_text: null,
    source_id: id,
    sha256: null,
    flags: [],
    status: STATUS.pending,
    seen_in: null,
  };
}

function fromText({ id, text, now, source, branchHint }) {
  const parsed = parseStockText(text, now);
  const list = baseList({ id, kind: 'text', now, source, branchHint });
  list.raw_text = String(text);
  list.branch = parsed.branch || { raw_text: null, value: null, state: 'missing' };
  list.date = parsed.date || { raw_text: null, value: null, state: 'missing' };
  list.rows = parsed.rows;
  if (parsed.unread.length) list.flags.push(`could not read: ${parsed.unread.join(' | ').slice(0, 200)}`);
  return finishFlags(list, now);
}

function field(f) {
  return f && f.state === 'observed' && f.value != null && Number.isFinite(Number(f.value)) ? Number(f.value) : null;
}

/** A review record of document_type stock_report, read from a photo. */
function fromReviewRecord({ record, sha256, now, source, branchHint }) {
  const list = baseList({ id: record.record_id, kind: 'photo', now, source, branchHint });
  list.sha256 = sha256 || null;
  list.branch = record.branch || { value: null, state: 'missing' };
  list.date = record.date || { value: null, state: 'missing' };
  list.rows = (record.stock_items || []).map(row => {
    const qty = row && typeof row.qty === 'object' ? field(row.qty) : (Number.isFinite(row && row.qty) ? row.qty : null);
    const delivered = row && typeof row.delivered === 'object' ? field(row.delivered) : (Number.isFinite(row && row.delivered) ? row.delivered : null);
    return {
      item_raw: String((row && row.item_raw) || '').trim(),
      qty,
      unit: (row && (row.unit_raw || row.unit)) ? String(row.unit_raw || row.unit).trim() : null,
      delivered,
      uncertain: Boolean(row && (row.uncertain || (row.qty && typeof row.qty === 'object' && row.qty.state && row.qty.state !== 'observed'))),
    };
  }).filter(row => row.item_raw);
  for (const issue of record.issues || []) {
    if (issue && issue.field && !['branch', 'date'].includes(issue.field)) list.flags.push(`${issue.field}: ${issue.issue}`.slice(0, 160));
  }
  return finishFlags(list, now);
}

function isoOf(dmy) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Why a list cannot go to the dashboard, or null when it can. */
function holdReason(list) {
  if (list.branch.state !== 'observed' || !list.branch.value) return 'no branch';
  if (list.date.state !== 'observed' || !isoOf(list.date.value)) return 'no date';
  if (!list.rows.some(r => r.qty != null)) return 'no counted rows';
  return null;
}

function ledgerRows(list) {
  if (holdReason(list)) return [];
  return list.rows.filter(r => r.qty != null).map(r => ({
    branch: list.branch.value,
    date: isoOf(list.date.value),
    item: r.item_raw,
    qty: r.qty,
    unit: r.unit,
    delivered: r.delivered,
    source: `line:${list.kind}:${list.id}`,
  }));
}

const rowKey = r => [r.branch, r.date, String(r.item).trim().toLowerCase(), String(r.unit || '').trim().toLowerCase()].join('|');

/** Same branch, day, item, and unit replaces the earlier count, so a retry converges. */
function mergeLedger(ledger, rows) {
  const out = ledger && typeof ledger === 'object' ? { ...ledger } : {};
  const byKey = new Map((out.stock_counts || []).map(r => [rowKey(r), r]));
  for (const row of rows) byKey.set(rowKey(row), row);
  out.stock_counts = [...byKey.values()].sort((a, b) =>
    a.branch.localeCompare(b.branch) || a.date.localeCompare(b.date) || String(a.item).localeCompare(String(b.item)));
  return out;
}

async function saveList(store, list) {
  const created = await store.putIfAbsent(listKey(list.id), Buffer.from(JSON.stringify(list)), 'application/json');
  return created && created.created !== false;
}

async function loadLists(store, filter = l => OPEN.has(l.status)) {
  const keys = await store.list('stock:list:');
  const lists = [];
  for (const key of keys) {
    const list = await store.getJson(key);
    if (list && filter(list)) lists.push(list);
  }
  return lists.sort((a, b) => a.received_at.localeCompare(b.received_at));
}

function showNum(n) {
  return n == null ? '?' : String(n);
}

function digestMessages(digestId, lists) {
  const lines = [`สต็อกรอตรวจ ${lists.length} ใบ`];
  for (const list of lists) {
    const hold = holdReason(list);
    lines.push('');
    lines.push(`${list.branch.value || 'สาขา?'} ${list.date.value || 'วันที่?'} (${list.kind === 'photo' ? 'รูป' : 'ข้อความ'}) ${list.rows.length} รายการ${hold ? ` ⚠ ไม่ลง: ${hold}` : ''}`);
    for (const row of list.rows.slice(0, 12)) {
      lines.push(`- ${row.item_raw} ${showNum(row.qty)}${row.unit ? ` ${row.unit}` : ''}${row.delivered != null ? ` (+${row.delivered})` : ''}${row.uncertain ? ' ?' : ''}`);
    }
    if (list.rows.length > 12) lines.push(`… +${list.rows.length - 12}`);
    for (const flag of list.flags.slice(0, 4)) lines.push(`⚠ ${flag}`);
  }
  const ready = lists.filter(l => !holdReason(l)).length;
  const text = lines.join('\n').slice(0, 4800);
  return [
    { type: 'text', text },
    {
      type: 'template',
      altText: `สต็อกรอตรวจ ${lists.length} ใบ`,
      template: {
        type: 'buttons',
        text: (ready ? `อนุมัติ = ลง dashboard ${ready} ใบที่ครบ\nไม่รับ = ทิ้งทั้ง ${lists.length} ใบ` : `ยังไม่มีใบที่ลงได้\nไม่รับ = ทิ้งทั้ง ${lists.length} ใบ`).slice(0, 160),
        actions: [
          { type: 'postback', label: 'อนุมัติ', data: `action=stock_approve&batch=${digestId}`, displayText: 'อนุมัติสต็อก' },
          { type: 'postback', label: 'ไม่รับ', data: `action=stock_reject&batch=${digestId}`, displayText: 'ไม่รับสต็อก' },
        ],
      },
    },
  ];
}

/** Save a digest of the open lists and mark them seen. Returns null when nothing is open. */
async function openDigest(store, digestId, lists, now) {
  if (!lists.length) return null;
  const digest = { id: digestId, list_ids: lists.map(l => l.id), created_at: new Date(now).toISOString() };
  await store.putJson(digestKey(digestId), digest);
  for (const list of lists) {
    list.seen_in = digestId;
    await store.putJson(listKey(list.id), list);
  }
  return { digest, messages: digestMessages(digestId, lists) };
}

/**
 * The 22:00 push. At most one per Bangkok day, and none when every open list
 * was already shown to Parn.
 */
async function runDailyDigest({ store, line, ownerUserId, now }) {
  if (!ownerUserId) return { skipped: 'owner_not_set' };
  const open = await loadLists(store);
  if (!open.some(l => !l.seen_in)) return { skipped: 'nothing_new', open: open.length };
  const day = bangkokDay(now).iso;
  const claim = await store.putIfAbsent(dayKey(day), Buffer.from(JSON.stringify({ at: new Date(now).toISOString() })), 'application/json');
  if (claim && claim.created === false) return { skipped: 'already_sent_today', day };
  const opened = await openDigest(store, `stock-${day}`, open, now);
  await line.push(ownerUserId, opened.messages);
  return { pushed: true, digest_id: opened.digest.id, lists: open.length };
}

/** Parn types "สต็อก": the same view as a free reply. */
async function replyDigest({ store, now }) {
  const open = await loadLists(store);
  return openDigest(store, `stock-${bangkokDay(now).iso}-${now}`, open, now);
}

/**
 * อนุมัติ / ไม่รับ on a digest. Covers only the lists the digest showed, so a
 * list sent after the card is not approved unseen. Safe to tap twice.
 */
async function decideDigest({ store, digestId, decision, now, publish }) {
  const digest = await store.getJson(digestKey(digestId));
  if (!digest) return { status: 'missing', message: 'ไม่พบชุดสต็อกนี้แล้ว' };
  const lists = [];
  for (const id of digest.list_ids) {
    const list = await store.getJson(listKey(id));
    if (list && OPEN.has(list.status)) lists.push(list);
  }
  if (!lists.length) return { status: 'done', message: 'ชุดสต็อกนี้ตัดสินแล้ว' };
  const at = new Date(now).toISOString();
  if (decision === 'reject') {
    for (const list of lists) {
      Object.assign(list, { status: STATUS.rejected, decided_at: at });
      await store.putJson(listKey(list.id), list);
    }
    return { status: 'rejected', message: `ไม่รับสต็อก ${lists.length} ใบ` };
  }
  const ready = lists.filter(l => !holdReason(l));
  const held = lists.length - ready.length;
  const heldNote = held ? `\nค้าง ${held} ใบ (ไม่มีสาขา/วันที่/จำนวน) ยังรออยู่` : '';
  if (!ready.length) return { status: 'held', message: `ยังไม่มีใบที่ลงได้${heldNote}` };
  for (const list of ready) {
    Object.assign(list, { status: STATUS.approved, decided_at: at });
    await store.putJson(listKey(list.id), list);
  }
  const rows = ready.flatMap(ledgerRows);
  const result = await publish(rows, digestId);
  if (result.status !== 'published') {
    return { status: result.status, message: `อนุมัติแล้ว แต่ยังไม่ขึ้น dashboard: ${result.reason || result.status}${heldNote}`.slice(0, 400) };
  }
  for (const list of ready) {
    Object.assign(list, { status: STATUS.published, publish: { commit: result.commit || null, at } });
    await store.putJson(listKey(list.id), list);
  }
  return {
    status: 'published',
    message: `ลงสต็อก ${ready.length} ใบ (${rows.length} แถว) แล้ว เว็บอัปเดตใน 1–2 นาที${heldNote}\n${result.url || ''}`.trim(),
  };
}

module.exports = {
  STATUS,
  isStockText,
  isStockCommand,
  parseStockText,
  fromText,
  fromReviewRecord,
  holdReason,
  ledgerRows,
  mergeLedger,
  saveList,
  loadLists,
  digestMessages,
  runDailyDigest,
  replyDigest,
  decideDigest,
  bangkokDay,
  listKey,
};
