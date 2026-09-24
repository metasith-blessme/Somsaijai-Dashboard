// Test MiniMax M3 via OpenAI-compatible endpoint against the 9 sample images.
// Effort "Med" = reasoning.effort "medium" (Responses API) or thinking.type "adaptive" (Chat Completions).
// This file does NOT touch Excel, dashboard, or financial data. Review-only run.

const fs = require('fs');
const path = require('path');
const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const KEY = process.env.MINIMAX_API_KEY;
const BASE = 'https://api.minimax.io/v1';
const MODEL = 'MiniMax-M3';

if (!KEY) {
  console.error('MINIMAX_API_KEY not set');
  process.exit(1);
}

const imgDir = '/Users/metasithjumpatip/Library/Application Support/Hermes/composer-images';
const files = [
  ['B1', 'sales', 'image_4cc026.png'],
  ['B1', 'food', 'image_8efdd3.png'],
  ['B1', 'packing', 'image_6184d6.png'],
  ['B2', 'sales', 'image_2e52f6.png'],
  ['B2', 'food', 'image_badb76.png'],
  ['B2', 'packing', 'image_3a8577.png'],
  ['B3', 'sales', 'image_d70c92.png'],
  ['B3', 'food', 'image_e38103.png'],
  ['B3', 'packing', 'image_a8bb6d.png'],
];

const PROMPT = `You are reading a SomSaiJai shop report page (Thai cold-press juice bar, branches B1/B2/B3).

STRICT RULES:
1. Do NOT guess missing numbers. Use null if blank, illegible, or dash.
2. Read raw values as written on paper. Do NOT alter values to force math to balance.
3. Preserve the original Thai text where present.

If the page is a Sales report, extract JSON:
{
  "doc_type": "sales",
  "branch": "B1|B2|B3",
  "date": "string as written",
  "staff": "string as written",
  "shift_hours": "string as written",
  "financials": {
    "cash_sales": number|null,
    "scan_sales": number|null,
    "total_revenue": number|null,
    "total_expense": number|null,
    "net_sales": number|null,
    "opening_cash": number|null,
    "expected_cash": number|null,
    "counted_cash": number|null
  },
  "sales_rows": [
    { "item_raw": "string", "qty": number|null, "price": number|null, "amount_raw": number|null }
  ]
}

If the page is a Stock report, extract JSON:
{
  "doc_type": "stock_food" or "stock_packing",
  "branch": "B1|B2|B3",
  "date": "string as written",
  "stock_rows": [
    { "item_raw": "string", "unit_raw": "string", "opening": "string", "received": "string", "used": "string", "waste": "string", "closing": "string" }
  ]
}

Return ONLY valid JSON. No prose.`;

function callM3(imageBase64) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'default' } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
      max_completion_tokens: 4000,
      temperature: 0.2,
      thinking: { type: 'adaptive' },
      reasoning_split: true,
    });
    const url = new URL(BASE + '/chat/completions');
    const req = https.request(
      {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + KEY,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 300)));
            return;
          }
          try {
            const j = JSON.parse(data);
            const choice = j.choices && j.choices[0];
            const msg = choice && choice.message;
            const content = (msg && (msg.content || msg.reasoning_content)) || '';
            const reasoning = (msg && (msg.reasoning_details || msg.reasoning_content)) || '';
            resolve({ content, reasoning, usage: j.usage || {}, raw: j });
          } catch (e) {
            reject(new Error('parse error: ' + e.message + ' raw=' + data.slice(0, 300)));
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  const results = [];
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalReasoning = 0;
  const tally = { parse_ok: 0, parse_fail: 0, reasoning_empty: 0 };

  for (const [branch, docType, filename] of files) {
    const filePath = path.join(imgDir, filename);
    const b64 = fs.readFileSync(filePath).toString('base64');
    const t0 = Date.now();
    try {
      const r = await callM3(b64);
      const dt = Date.now() - t0;
      const u = r.usage || {};
      const pt = u.prompt_tokens || 0;
      const ct = u.completion_tokens || 0;
      const rt = (u.reasoning_tokens || u.completion_tokens_details?.reasoning_tokens) || 0;
      totalPrompt += pt;
      totalCompletion += ct;
      totalReasoning += rt;
      let parsed = null;
      let parseOk = false;
      let parseError = null;
      const content = String(r.content || '');
      const stripped = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const jsonStart = stripped.indexOf('{');
      const jsonEnd = stripped.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        try {
          parsed = JSON.parse(stripped.slice(jsonStart, jsonEnd + 1));
          parseOk = true;
          tally.parse_ok++;
        } catch (e) {
          parseError = e.message;
          tally.parse_fail++;
        }
      } else {
        tally.parse_fail++;
      }
      const reasoningText = String(r.reasoning || '');
      if (!reasoningText) tally.reasoning_empty++;
      results.push({
        branch,
        docType,
        filename,
        durationMs: dt,
        promptTokens: pt,
        completionTokens: ct,
        reasoningTokens: rt,
        parseOk,
        parseError,
        docDetected: parsed ? (parsed.doc_type || 'unknown') : null,
        rowsFound: parsed ? (parsed.sales_rows ? parsed.sales_rows.length : parsed.stock_rows ? parsed.stock_rows.length : 0) : 0,
        reasoningPreview: reasoningText.slice(0, 200),
        outputPreview: stripped.slice(0, 300),
      });
      console.log(`[${parseOk ? 'OK' : 'FAIL'}] ${branch} ${docType} ${filename} (${dt}ms, p=${pt}, c=${ct}, r=${rt}, doc=${results[results.length - 1].docDetected}, rows=${results[results.length - 1].rowsFound})`);
    } catch (e) {
      console.error('[ERR] ' + branch + ' ' + docType + ' ' + filename + ': ' + e.message);
      results.push({ branch, docType, filename, error: e.message });
      tally.parse_fail++;
    }
  }

  const summary = {
    model: MODEL,
    effort: 'medium (thinking.type=adaptive)',
    base_url: BASE,
    images: results.length,
    parse_ok: tally.parse_ok,
    parse_fail: tally.parse_fail,
    reasoning_empty_count: tally.reasoning_empty,
    total_prompt_tokens: totalPrompt,
    total_completion_tokens: totalCompletion,
    total_reasoning_tokens: totalReasoning,
    total_tokens: totalPrompt + totalCompletion,
    results,
  };
  fs.writeFileSync('/tmp/minimax_m3_medium_test.json', JSON.stringify(summary, null, 2));
  console.log('\n=== M3 MEDIUM SUMMARY ===');
  console.log(JSON.stringify({
    images: summary.images,
    parse_ok: summary.parse_ok,
    parse_fail: summary.parse_fail,
    total_prompt_tokens: totalPrompt,
    total_completion_tokens: totalCompletion,
    total_reasoning_tokens: totalReasoning,
    total_tokens: totalPrompt + totalCompletion,
    avg_prompt_per_image: Math.round(totalPrompt / results.length),
    avg_completion_per_image: Math.round(totalCompletion / results.length),
  }, null, 2));
})();
