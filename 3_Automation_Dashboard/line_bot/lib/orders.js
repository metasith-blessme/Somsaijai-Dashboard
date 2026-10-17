const fs = require('fs');
const {
  showUnit,
  ORDER_RECEIVED,
  ORDER_SENT,
  ORDER_NOT_SENT,
  ORDER_NO_OWNER,
  YOU_ORDER,
  UNKNOWN_ITEM,
  NO_SHOP,
  COULD_NOT_READ,
  isOrderCommand,
} = require('./staff_text');

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const MAX_BUBBLES = 5;

function thaiDigits(value) {
  return String(value).replace(/[๐-๙]/g, ch => String(THAI_DIGITS.indexOf(ch)));
}

function normName(value) {
  return thaiDigits(value)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[._]/g, '');
}

function formatQty(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function parseQty(raw) {
  const s = thaiDigits(raw).trim();
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/,/g, ''));
  if (/^\d+,\d{1,2}$/.test(s)) return Number(s.replace(',', '.'));
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  return null;
}

function normalizeUnit(raw) {
  if (!raw) return null;
  const u = thaiDigits(raw).toLowerCase().replace(/\./g, '').trim();
  if (['kg', 'kgs', 'กก', 'กิโล', 'กิโลกรัม'].includes(u)) return 'กก';
  if (['box', 'boxes', 'กล่อง'].includes(u)) return 'กล่อง';
  if (u === 'ลูก' || u === 'ผล') return 'ลูก';
  if (u === 'ลัง') return 'ลัง';
  return null;
}

function loadCatalog(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const suppliers = new Map();
  for (const supplier of data.suppliers || []) {
    if (!supplier.id || !supplier.name || !supplier.kind) throw new Error(`supplier ${supplier.id || '(missing)'} needs id, name, kind`);
    if (suppliers.has(supplier.id)) throw new Error(`duplicate supplier ${supplier.id}`);
    suppliers.set(supplier.id, supplier);
  }
  const aliases = new Map();
  const items = new Map();
  for (const item of data.items || []) {
    if (!item.id || !item.default_unit || !item.aliases || !item.aliases.length) {
      throw new Error(`item ${item.id || '(missing)'} needs id, default_unit, aliases`);
    }
    if (items.has(item.id)) throw new Error(`duplicate item ${item.id}`);
    if (item.supplier && !suppliers.has(item.supplier)) throw new Error(`item ${item.id} points at unknown supplier ${item.supplier}`);
    if (item.supplier && item.handled_by) throw new Error(`item ${item.id} cannot have both a supplier and handled_by`);
    if (!item.supplier && item.handled_by !== 'ming') throw new Error(`item ${item.id} needs a supplier or handled_by ming`);
    items.set(item.id, item);
    for (const alias of item.aliases) {
      const key = normName(alias);
      if (!key) throw new Error(`blank alias on ${item.id}`);
      if (aliases.has(key)) throw new Error(`alias ${alias} is used by both ${aliases.get(key).id} and ${item.id}`);
      aliases.set(key, item);
    }
  }
  return { suppliers, items, aliases, list: data };
}

function stripBullet(line) {
  return String(line).replace(/^\s*(?:[-*•]|[0-9]+[.)])\s+/, '').trim();
}

function isPreamble(line) {
  return /^orders?\b/i.test(line)
    || /^ออเดอร์\b/.test(line)
    || /^สั่ง(?:ผลไม้|ของ)?(?:พรุ่งนี้|พรุ่ง)/.test(line);
}

function parseLine(line) {
  const cleaned = thaiDigits(stripBullet(line).replace(/\(([^)]*)\)\s*$/, '').trim());
  const match = cleaned.match(/^(.+?)(?:\s*[-–—:=]\s*|\s+)(\d+(?:[.,]\d+)*)(?:\s*([A-Za-z\u0E00-\u0E7F.]+))?\s*$/);
  if (!match) return null;
  const name = match[1].replace(/[\s\-–—:=]+$/, '').trim();
  if (!name || /^\d/.test(name)) return null;
  const qty = parseQty(match[2]);
  if (qty == null || qty < 0) return null;
  const rawUnit = match[3] || '';
  const unit = rawUnit ? normalizeUnit(rawUnit) : null;
  return { name, qty, unit, rawUnit, raw: line.trim() };
}

function lookupItem(name, catalog) {
  return catalog.aliases.get(normName(name)) || null;
}

/**
 * A 1:1 note is an order when it names a known fruit, or when it opens like
 * "Orders for tomorrow" and still has at least one quantity line. A single
 * unrecognized line with no header is left alone so a normal chat is not drafted.
 */
function parseOrder(text, catalog) {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  let sawPreamble = false;
  const recognized = [];
  const unknown = [];
  const unparsed = [];
  for (const line of lines) {
    const body = stripBullet(line);
    if (isPreamble(body)) {
      sawPreamble = true;
      continue;
    }
    if (/^@\S+(?:\s+@\S+)*$/.test(body)) continue;
    const parsed = parseLine(body);
    if (!parsed) {
      if (/\d/.test(thaiDigits(body))) unparsed.push(body);
      continue;
    }
    const item = lookupItem(parsed.name, catalog);
    if (!item) {
      unknown.push(parsed);
      continue;
    }
    const flags = [];
    const unit = parsed.unit || item.default_unit;
    if (!parsed.unit) flags.push('unit_defaulted');
    else if (parsed.unit !== item.default_unit) flags.push('unit_differs');
    if (parsed.rawUnit && !parsed.unit) flags.push('unit_unrecognized');
    recognized.push({
      id: item.id,
      label_th: item.label_th,
      label_en: item.label_en,
      qty: parsed.qty,
      unit: parsed.unit ? parsed.unit : unit,
      display_unit: parsed.rawUnit && !parsed.unit ? parsed.rawUnit : unit,
      default_unit: item.default_unit,
      supplier: item.supplier || null,
      handled_by: item.handled_by || null,
      raw: parsed.raw,
      flags,
    });
  }

  const itemShaped = recognized.length + unknown.length;
  const isOrder = recognized.length > 0 || (sawPreamble && (itemShaped > 0 || unparsed.length > 0)) || unknown.length >= 2;
  const drafts = isOrder ? buildDrafts(recognized, catalog) : [];
  return { isOrder, sawPreamble, items: recognized, unknown, unparsed, drafts };
}

function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => (vars[key] == null ? '' : String(vars[key])));
}

function combineSameItem(lines) {
  const out = [];
  for (const line of lines) {
    const prev = out.find(item => item.id === line.id && item.display_unit === line.display_unit);
    if (!prev) {
      out.push({ ...line, sources: 1 });
      continue;
    }
    prev.qty += line.qty;
    prev.sources += 1;
    if (!prev.flags.includes('combined')) prev.flags = prev.flags.concat('combined');
  }
  return out;
}

function buildDrafts(items, catalog) {
  const drafts = [];
  for (const supplier of catalog.suppliers.values()) {
    const mine = combineSameItem(items.filter(item => item.supplier === supplier.id));
    if (!mine.length) continue;
    drafts.push({ supplierId: supplier.id, name: supplier.name, also_known_as: supplier.also_known_as || null, items: mine, text: renderSupplier(supplier, mine) });
  }
  return drafts;
}

function renderSupplier(supplier, items) {
  if (supplier.kind === 'price_question') return supplier.message;
  if (supplier.kind === 'count_line') {
    if (items.length === 1 && !items[0].flags.includes('unit_unrecognized') && items[0].display_unit === items[0].default_unit) {
      return fill(supplier.message, { qty: formatQty(items[0].qty), unit: items[0].display_unit, label_th: items[0].label_th });
    }
    const lines = items.map(item => `${item.label_th} ${formatQty(item.qty)} ${item.display_unit}`);
    return `วันนี้ครับผม\n${lines.join('\n')}`;
  }
  if (supplier.kind === 'item_list') {
    const lines = [supplier.greeting];
    for (const item of items) {
      const unitBit = item.display_unit === item.default_unit ? '' : ` ${item.display_unit}`;
      lines.push(fill(supplier.item_line, { label_th: item.label_th, qty: formatQty(item.qty), unit: item.display_unit }) + unitBit);
    }
    if (supplier.delivery_line) lines.push(supplier.delivery_line);
    return lines.join('\n');
  }
  throw new Error(`unknown supplier kind ${supplier.kind}`);
}

function itemPhrase(item) {
  const who = item.handled_by === 'ming'
    ? 'คุณเมนสั่งเอง'
    : (item.supplier ? null : 'ไม่มีร้าน');
  return { text: `${item.label_th} ${formatQty(item.qty)} ${item.display_unit}`, who };
}

function buildOrderMessages(parsed, catalog) {
  const lines = ['ออเดอร์พรุ่งนี้'];
  for (const item of combineSameItem(parsed.items)) {
    const phrase = itemPhrase(item);
    if (item.handled_by === 'ming') {
      lines.push(`• ${phrase.text} → คุณเมนสั่งเอง`);
    } else if (item.supplier) {
      const supplier = catalog.suppliers.get(item.supplier);
      const ask = supplier && supplier.kind === 'price_question' ? ' (ถามราคาก่อน)' : '';
      const extra = item.flags.includes('combined') ? ' รวมจากหลายบรรทัด' : '';
      const unitNote = item.flags.includes('unit_differs') || item.flags.includes('unit_unrecognized') ? ' หน่วยตามที่ส่งมา' : '';
      lines.push(`• ${phrase.text} → ${supplier ? supplier.name : item.supplier}${ask}${extra}${unitNote}`);
    }
  }
  for (const row of parsed.unknown) {
    const unit = row.unit || row.rawUnit || 'ไม่บอกหน่วย';
    lines.push(`• ${row.name} ${formatQty(row.qty)} ${unit} → ไม่รู้จักสินค้านี้ ยังไม่ใส่ในข้อความ`);
  }
  for (const row of parsed.unparsed) lines.push(`• อ่านบรรทัดนี้ไม่ได้: ${row}`);
  if (!parsed.items.length && !parsed.unknown.length && !parsed.unparsed.length) lines.push('ไม่มีรายการ');
  const draftNames = parsed.drafts.map((draft, index) => `${index + 1}. ${draft.name}`);
  if (draftNames.length) {
    lines.push('', 'ก๊อปข้อความด้านล่างไปส่งเองตามลำดับ', ...draftNames);
  }
  lines.push('', 'บอทไม่ได้ส่งให้ร้าน');
  const summary = { type: 'text', text: lines.join('\n').slice(0, 4800) };
  const bubbles = parsed.drafts.map(draft => ({ type: 'text', text: String(draft.text).slice(0, 4800) }));
  return { summaryText: summary.text, messages: packBubbles(summary, bubbles), drafts: parsed.drafts };
}

function packBubbles(summary, bubbles) {
  if (1 + bubbles.length <= MAX_BUBBLES) return [summary, ...bubbles];
  const head = bubbles.slice(0, MAX_BUBBLES - 2);
  const tail = bubbles.slice(MAX_BUBBLES - 2).map(bubble => bubble.text).join('\n\n');
  return [summary, ...head, { type: 'text', text: tail.slice(0, 4800) }];
}

function buildSenderConfirm(parsed, { delivered, ownerSet }) {
  const lines = [ORDER_RECEIVED];
  for (const item of parsed.items) {
    const unit = showUnit(item.display_unit);
    const dest = item.handled_by === 'ming'
      ? `— ${YOU_ORDER}`
      : (item.supplier ? `→ ${supplierName(parsed, item.supplier)}` : `— ${NO_SHOP}`);
    lines.push(`• ${item.label_en} ${formatQty(item.qty)} ${unit} ${dest}`.replace(/ +/g, ' ').trim());
  }
  for (const row of parsed.unknown) {
    const unit = showUnit(row.unit || row.rawUnit || '');
    lines.push(`• ${row.name} ${formatQty(row.qty)} ${unit} — ${UNKNOWN_ITEM}`.replace(/ +/g, ' ').trim());
  }
  for (const row of parsed.unparsed) lines.push(`• ${COULD_NOT_READ} ${row}`);
  if (!ownerSet) lines.push(ORDER_NO_OWNER);
  else if (delivered) lines.push(ORDER_SENT);
  else lines.push(ORDER_NOT_SENT);
  return lines.join('\n').slice(0, 4800);
}

function supplierName(parsed, id) {
  const draft = parsed.drafts.find(row => row.supplierId === id);
  return draft ? draft.name : id;
}

function isOrderReplay(text) {
  return isOrderCommand(text);
}

module.exports = {
  loadCatalog,
  parseOrder,
  buildOrderMessages,
  buildSenderConfirm,
  packBubbles,
  isOrderReplay,
  normalizeUnit,
  formatQty,
};
