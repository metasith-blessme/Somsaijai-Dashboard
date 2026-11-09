const STATES = new Set(['observed', 'missing', 'illegible', 'ambiguous', 'not_applicable', 'derived', 'estimated']);

function parsePlainNumber(raw) {
  if (raw == null) return null;
  const text = String(raw).trim().replace(/,/g, '').replace(/฿/g, '');
  if (!text || text === '-' || text === '—') return null;
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { uncertain: true, raw: String(raw) };
  return { uncertain: false, value: Number(text), raw: String(raw) };
}

/** A model field becomes a field object. Unknown is null, never coerced to 0. */
function asField(input, unit) {
  if (input == null || input === '') {
    return { raw_text: null, value: null, state: 'missing', unit: unit || null, alternatives: [] };
  }
  if (typeof input === 'number') {
    if (!isFinite(input)) return { raw_text: null, value: null, state: 'illegible', unit: unit || null, alternatives: [] };
    return { raw_text: String(input), value: input, state: 'observed', unit: unit || null, alternatives: [] };
  }
  if (typeof input !== 'object') {
    const parsed = parsePlainNumber(input);
    if (!parsed || parsed.uncertain) {
      return { raw_text: String(input), value: null, state: 'ambiguous', unit: unit || null, alternatives: [] };
    }
    return { raw_text: parsed.raw, value: parsed.value, state: 'observed', unit: unit || null, alternatives: [] };
  }
  const state = STATES.has(input.state) ? input.state : null;
  const raw = input.raw ?? input.raw_text ?? null;
  let value = typeof input.value === 'number' && isFinite(input.value) ? input.value : null;
  let useState = state;
  if (!useState) {
    if (value == null && (raw == null || String(raw).trim() === '')) useState = 'missing';
    else if (value != null) useState = 'observed';
    else useState = 'ambiguous';
  }
  // A blank, an illegible digit, or an estimate must not become a booked observation.
  if (useState !== 'observed') {
    if (useState === 'estimated' || useState === 'derived') {
      return { raw_text: raw == null ? null : String(raw), value, state: useState, unit: unit || input.unit || null, alternatives: input.alternatives || [] };
    }
    return { raw_text: raw == null ? null : String(raw), value: null, state: useState, unit: unit || input.unit || null, alternatives: input.alternatives || [] };
  }
  if (value == null && raw != null) {
    const parsed = parsePlainNumber(raw);
    if (parsed && !parsed.uncertain) value = parsed.value;
  }
  if (value == null) {
    return { raw_text: raw == null ? null : String(raw), value: null, state: 'illegible', unit: unit || null, alternatives: input.alternatives || [] };
  }
  return { raw_text: raw == null ? String(value) : String(raw), value, state: 'observed', unit: unit || input.unit || null, alternatives: input.alternatives || [] };
}

function observedNumber(field) {
  return field && field.state === 'observed' && typeof field.value === 'number' ? field.value : null;
}

/**
 * Number Approve may book. Observed wins. Ambiguous with a written raw_text or
 * alternatives books that written-looking value instead of holding the sheet.
 */
function bookableNumber(field) {
  const observed = observedNumber(field);
  if (observed != null) return observed;
  if (!field || field.state !== 'ambiguous') return null;
  if (field.raw_text != null && String(field.raw_text).trim() !== '') {
    const parsed = parsePlainNumber(field.raw_text);
    if (parsed && !parsed.uncertain) return parsed.value;
  }
  for (const alt of field.alternatives || []) {
    if (typeof alt === 'number' && isFinite(alt)) return alt;
  }
  return null;
}

/** Note/flag text when two readings left the field ambiguous. */
function readingsDisagreeFlag(field) {
  if (!field || field.state !== 'ambiguous') return null;
  const alts = (field.alternatives || []).filter(v => typeof v === 'number' && isFinite(v));
  if (alts.length >= 2) return `readings disagree (${alts.join(' vs ')})`;
  return null;
}

module.exports = { asField, observedNumber, bookableNumber, readingsDisagreeFlag, parsePlainNumber };
