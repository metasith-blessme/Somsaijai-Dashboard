#!/usr/bin/env node
/**
 * Field accuracy of the photo reader on the October 1-17 sheets in the repo,
 * against Parn's closed figures in data.json (ground truth).
 *
 *   GEMINI_API_KEY=... node eval/october_eval.js --lib <line_bot/lib dir> --out result.json
 *
 * Scores what Approve would book: branch, date, Total, cash, scan.
 * Photos without exactly one data.json day (B3 12A/12B, B4 UNDATED) are listed and skipped.
 * Nothing is written to the books, LINE, or the store.
 */
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
  return acc;
}, []));
const LIB = path.resolve(args.lib || path.join(__dirname, '..', 'lib'));
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA = path.join(ROOT, '3_Automation_Dashboard', 'data.json');
const OUT = args.out || null;
const CONCURRENCY = Number(args.concurrency || 4);
const MODEL = args.model || 'gemini-3.5-flash';
const FALLBACK = args.fallback || 'gemini-3.5-flash-lite';
const SKIP = new Set(String(args.skip || '').split(',').filter(Boolean));
const FEWSHOT = args.fewshot !== '0'; // only matters for a lib that has few-shot examples
const RETRY = args.retry || null; // an earlier --out file: read again only the photos that errored
const PAUSE_MS = Number(args.pause || 0);

const { extractImage } = require(path.join(LIB, 'extractor'));
const { buildReview } = require(path.join(LIB, 'normalize'));
const { bookableNumber } = require(path.join(LIB, 'fields'));

const FOLDERS = [
  ['B1', 'B1/1_Sale/Oct26'],
  ['B2', 'B2/1_Sale/Oct26'],
  ['B3', 'B3/1_Sale/Oct26'],
  ['B4', 'B4/sale/Oct26'],
];

function dataset() {
  const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const cases = [];
  const unmatched = [];
  for (const [branch, dir] of FOLDERS) {
    const rows = data.branches[branch].sales.Oct26 || [];
    for (const file of fs.readdirSync(path.join(ROOT, dir)).filter(f => /\.jpe?g$/i.test(f)).sort()) {
      const m = /_(\d{2})-10-2026\.jpe?g$/i.exec(file);
      if (!m) { unmatched.push(`${branch}/${file}`); continue; }
      const date = `${m[1]}/10/2026`;
      const row = rows.find(r => r.d === date);
      if (!row) { unmatched.push(`${branch}/${file}`); continue; }
      cases.push({ id: `${branch}/${file}`, file: path.join(ROOT, dir, file), truth: { branch, date, total: row.rev, cash: row.cash, scan: row.scan } });
    }
  }
  return { cases: cases.filter(c => !SKIP.has(c.id)), unmatched, skipped: [...SKIP] };
}

async function readOne(c) {
  const buf = fs.readFileSync(c.file);
  const started = Date.now();
  let reading;
  try {
    reading = await extractImage({ buf, mimeType: 'image/jpeg', apiKey: process.env.GEMINI_API_KEY, model: MODEL, fallbackModel: FALLBACK, ...(FEWSHOT ? {} : { examples: [] }) });
  } catch (err) {
    return { id: c.id, truth: c.truth, error: err.message || String(err), ms: Date.now() - started };
  }
  const review = buildReview({
    batchId: 'eval',
    images: [{ sourceId: c.id, sha256: 'eval', contentType: 'image/jpeg', extraction: reading.extraction, second: reading.second, secondError: reading.secondError, secondSkipped: reading.secondSkipped === true, branch_hint: null }],
    now: new Date('2026-10-18T05:00:00Z'),
  });
  const r = review.records[0] || {};
  const fin = r.financials || {};
  const got = {
    branch: r.branch && r.branch.state === 'observed' ? r.branch.value : null,
    date: r.date && r.date.state === 'observed' ? r.date.value : null,
    total: bookableNumber(fin.total_sales),
    cash: bookableNumber(fin.cash_sales),
    scan: bookableNumber(fin.scan_sales),
  };
  return { id: c.id, truth: c.truth, got, second: Boolean(reading.second), ms: Date.now() - started };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      if (PAUSE_MS) await new Promise(r => setTimeout(r, PAUSE_MS));
      process.stderr.write(`${out[i].id} ${out[i].error ? 'ERROR' : 'ok'}\n`);
    }
  }));
  return out;
}

function score(results) {
  const fields = ['branch', 'date', 'total', 'cash', 'scan'];
  const per = Object.fromEntries(fields.map(f => [f, { right: 0, wrong: 0, blank: 0 }]));
  let allRight = 0;
  for (const r of results) {
    let ok = true;
    for (const f of fields) {
      const got = r.got ? r.got[f] : null;
      if (got == null) { per[f].blank += 1; ok = false; } else if (got === r.truth[f]) per[f].right += 1; else { per[f].wrong += 1; ok = false; }
    }
    if (ok) allRight += 1;
  }
  const n = results.length;
  const cells = n * fields.length;
  const right = fields.reduce((s, f) => s + per[f].right, 0);
  const wrong = fields.reduce((s, f) => s + per[f].wrong, 0);
  return { photos: n, errors: results.filter(r => r.error).length, field_accuracy: +(right / cells).toFixed(4), confident_wrong: wrong, sheets_all_right: allRight, per_field: per };
}

(async () => {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const { cases, unmatched, skipped } = dataset();
  let results;
  if (RETRY) {
    const earlier = JSON.parse(fs.readFileSync(RETRY, 'utf8')).results;
    const again = await pool(cases.filter(c => (earlier.find(r => r.id === c.id) || {}).error), CONCURRENCY, readOne);
    results = cases.map(c => again.find(r => r.id === c.id) || earlier.find(r => r.id === c.id));
  } else {
    results = await pool(cases, CONCURRENCY, readOne);
  }
  const summary = { lib: LIB, fewshot: FEWSHOT, model: MODEL, fallback: FALLBACK, unmatched, skipped, ...score(results) };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary, results }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})().catch(err => { console.error(err); process.exit(1); });
