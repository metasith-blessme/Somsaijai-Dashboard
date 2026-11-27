/**
 * Worked examples sent with each photo: a real October sheet and Parn's closed
 * figures for it. Loaded once per function instance. A missing file means no examples.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'fewshot', 'examples.json');
let cached;

function loadExamples(file = FILE) {
  if (file === FILE && cached !== undefined) return cached;
  let out = [];
  try {
    out = (JSON.parse(fs.readFileSync(file, 'utf8')).examples || []).filter(e => e && e.data && e.answer);
  } catch (err) {
    out = [];
  }
  if (file === FILE) cached = out;
  return out;
}

/** Gemini parts for the examples, ahead of the photo to read. */
function exampleParts(examples) {
  const parts = [];
  (examples || []).forEach((e, i) => {
    parts.push({ text: `Example ${i + 1}: ${e.label}. These are the correct values for this sheet (approved by Parn). Read new photos the same way.\n${JSON.stringify(e.answer)}` });
    parts.push({ inlineData: { data: e.data, mimeType: e.mimeType || 'image/jpeg' } });
  });
  if (parts.length) parts.push({ text: 'End of examples. Now read the next photo. Return JSON for that photo only, in the shape above.' });
  return parts;
}

module.exports = { loadExamples, exampleParts };
