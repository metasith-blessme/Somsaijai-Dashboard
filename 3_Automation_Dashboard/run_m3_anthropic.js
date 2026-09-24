
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const KEY = process.env.MINIMAX_API_KEY;
if (!KEY) { console.error('NO_KEY'); process.exit(1); }

const Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk');
const client = new Anthropic({ baseURL: 'https://api.minimax.io/anthropic', apiKey: KEY });

const PROMPT = `You are reading a SomSaiJai shop report page (Thai cold-press juice bar, branches B1/B2/B3).

STRICT RULES:
1. Do NOT guess missing numbers. Use null if blank, illegible, or dash.
2. Read raw values as written. Do NOT alter values to force math to balance.
3. Preserve original Thai text.

If Sales report, extract JSON:
{
  "doc_type": "sales",
  "branch": "B1|B2|B3",
  "date": "string as written",
  "staff": "string as written",
  "shift_hours": "string as written",
  "financials": {
    "cash_sales": number|null, "scan_sales": number|null, "total_revenue": number|null,
    "total_expense": number|null, "net_sales": number|null,
    "opening_cash": number|null, "expected_cash": number|null, "counted_cash": number|null
  },
  "sales_rows": [{"item_raw":"string","qty":number|null,"price":number|null,"amount_raw":number|null}]
}

If Stock report, extract JSON:
{
  "doc_type": "stock_food" or "stock_packing",
  "branch": "B1|B2|B3",
  "date": "string as written",
  "stock_rows": [{"item_raw":"string","unit_raw":"string","opening":"string","received":"string","used":"string","waste":"string","closing":"string"}]
}

Return ONLY valid JSON. No prose.`;

const imgDir = '/Users/metasithjumpatip/Library/Application Support/Hermes/composer-images';
const files = [
  ['B1','sales','image_4cc026.png'],
  ['B1','food','image_8efdd3.png'],
  ['B1','packing','image_6184d6.png'],
  ['B2','sales','image_2e52f6.png'],
  ['B2','food','image_badb76.png'],
  ['B2','packing','image_3a8577.png'],
  ['B3','sales','image_d70c92.png'],
  ['B3','food','image_e38103.png'],
  ['B3','packing','image_a8bb6d.png'],
];

(async () => {
  const results = [];
  let totalIn = 0, totalOut = 0, totalCached = 0, totalThinking = 0;
  for (const [branch, docType, filename] of files) {
    const b64 = fs.readFileSync(path.join(imgDir, filename)).toString('base64');
    const t0 = Date.now();
    try {
      const msg = await client.messages.create({
        model: 'MiniMax-M3',
        max_tokens: 4000,
        thinking: { type: 'enabled', budget_tokens: 2048 },
        system: PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
            { type: 'text', text: 'Extract all data from this report page as JSON.' }
          ]
        }]
      });
      const dt = Date.now() - t0;
      const u = msg.usage || {};
      const input = u.input_tokens || 0;
      const output = u.output_tokens || 0;
      const cached = (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      totalIn += input; totalOut += output; totalCached += cached;
      
      let text = '';
      let thinking = '';
      for (const block of (msg.content || [])) {
        if (block.type === 'text') text += block.text;
        if (block.type === 'thinking') thinking += (block.thinking || '');
        totalThinking += (block.thinking || '').length / 4;
      }
      
      let parsed = null, parseOk = false, parseError = null;
      const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim();
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) {
        try { parsed = JSON.parse(cleaned.slice(s, e+1)); parseOk = true; }
        catch (err) { parseError = err.message; }
      }
      
      results.push({
        branch, docType, filename, durationMs: dt,
        inputTokens: input, outputTokens: output, cachedTokens: cached,
        parseOk, parseError,
        docDetected: parsed?.doc_type || null,
        rowsFound: parsed ? (parsed.sales_rows?.length || parsed.stock_rows?.length || 0) : 0,
        thinkingLength: thinking.length,
        outputPreview: cleaned.slice(0, 200)
      });
      console.log(`[${parseOk ? 'OK' : 'FAIL'}] ${branch} ${docType} (${dt}ms, in=${input}, out=${output}, cached=${cached}, doc=${results[results.length-1].docDetected}, rows=${results[results.length-1].rowsFound})`);
    } catch (err) {
      console.error(`[ERR] ${branch} ${docType}: ${err.message}`);
      results.push({ branch, docType, filename, error: err.message });
    }
  }
  fs.writeFileSync('/tmp/minimax_m3_anthropic_results.json', JSON.stringify({
    model: 'MiniMax-M3', endpoint: 'https://api.minimax.io/anthropic',
    total_input: totalIn, total_output: totalOut, total_cached: totalCached,
    total_tokens: totalIn + totalOut, results
  }, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify({
    images: results.length,
    parse_ok: results.filter(r => r.parseOk).length,
    parse_fail: results.filter(r => !r.parseOk).length,
    total_input: totalIn,
    total_output: totalOut,
    total_cached: totalCached,
    total_tokens: totalIn + totalOut,
    avg_input: Math.round(totalIn / results.length),
    avg_output: Math.round(totalOut / results.length)
  }, null, 2));
})();
