#!/usr/bin/env node
/**
 * Read a few real report photos and print the review summary.
 * Does not write Excel, data.json, or the live site.
 *
 *   node line_bot/scripts/dry_run.js
 *   node line_bot/scripts/dry_run.js path/to/photo.jpg
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { extractImage } = require('../lib/extractor');
const { buildReview, sha256 } = require('../lib/normalize');
const { applyChecks } = require('../lib/validate');
const { formatSummary } = require('../lib/summary');

const root = path.join(__dirname, '..', '..', '..');
const defaults = [
  path.join(root, 'B2/1_Sale/Sep26/IMG_3106.JPG'),
  path.join(root, 'B2/1_Sale/Sep26/IMG_3107.JPG'),
  path.join(root, 'B1/2_Expenses/Sep26/IMG_3033.JPG'),
];

function mime(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function main() {
  const files = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const images = (files.length ? files : defaults).map(file => path.resolve(file));
  const missing = images.filter(file => !fs.existsSync(file));
  if (missing.length) {
    console.error('Missing sample image:\n' + missing.join('\n'));
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set, so this dry run cannot read the photos.');
    console.error('Put it in 3_Automation_Dashboard/.env or the environment and run again.');
    console.error('Nothing was imported.');
    process.exit(2);
  }
  const batchId = 'dryrun_' + new Date().toISOString().replace(/[:.]/g, '-');
  const pages = [];
  for (const file of images) {
    process.stderr.write(`reading ${path.relative(root, file)}\n`);
    const buf = fs.readFileSync(file);
    const reading = await extractImage({
      buf,
      mimeType: mime(file),
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || process.env.GEMINI_OCR_MODEL || 'gemini-3.5-flash',
      fallbackModel: process.env.GEMINI_MODEL_FALLBACK || 'gemini-3.8-flash',
    });
    pages.push({
      sourceId: path.basename(file),
      sha256: sha256(buf),
      contentType: mime(file),
      extraction: reading.extraction,
      second: reading.second,
      secondError: reading.secondError,
      secondSkipped: reading.secondSkipped === true,
    });
  }
  const review = applyChecks(buildReview({ batchId, images: pages }));
  if (review.review.import_allowed !== false) throw new Error('import_allowed must stay false');
  const summary = formatSummary(review);
  const outDir = path.join(__dirname, '..', 'dry-run-output');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'review.json'), JSON.stringify(review, null, 2));
  fs.writeFileSync(path.join(outDir, 'summary.txt'), summary.text);
  console.log(summary.text);
  console.log('\nimport_allowed: ' + review.review.import_allowed);
  console.log('Saved the full review under line_bot/dry-run-output/ (not imported).');
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
