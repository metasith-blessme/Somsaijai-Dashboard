const { loadConfig } = require('../line_bot/lib/config');
const { createStore } = require('../line_bot/lib/store');
const { reviewToken, formatSummary } = require('../line_bot/lib/summary');
const { redactDeep } = require('../line_bot/lib/redact');
const crypto = require('crypto');

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

module.exports = async function review(req, res) {
  const config = loadConfig();
  const url = new URL(req.url, 'https://somsaijailive.vercel.app');
  const batch = url.searchParams.get('batch');
  const token = url.searchParams.get('token') || '';
  if (!batch || !config.channelSecret) {
    res.status(400).end('missing batch');
    return;
  }
  const expected = reviewToken(batch, config.channelSecret);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    res.status(401).end('invalid token');
    return;
  }
  const store = createStore();
  const stored = await store.getJson(`review:${batch}`);
  if (!stored) {
    res.status(404).end('not found');
    return;
  }
  const summary = formatSummary(redactDeep(stored), { publicUrl: config.publicUrl, channelSecret: config.channelSecret });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html><meta name="robots" content="noindex"><title>Review ${escapeHtml(batch)}</title>
<style>body{font-family:sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;white-space:pre-wrap}</style>
<h1>ชุด ${escapeHtml(batch)}</h1>
<p>ลิงก์นี้เป็นของเจ้าของร้าน อย่าส่งต่อ รูปต้นฉบับไม่ได้อยู่ในหน้านี้</p>
<pre>${escapeHtml(summary.text)}</pre>`);
};
