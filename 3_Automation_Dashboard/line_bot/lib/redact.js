/** Mask long digit runs (account numbers, refs). Leave ordinary baht amounts alone. */
function redactText(value) {
  if (value == null) return value;
  return String(value).replace(/\d{8,}/g, (m) => '•'.repeat(m.length - 4) + m.slice(-4));
}

function redactDeep(value) {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactDeep(v);
    return out;
  }
  return value;
}

module.exports = { redactText, redactDeep };
