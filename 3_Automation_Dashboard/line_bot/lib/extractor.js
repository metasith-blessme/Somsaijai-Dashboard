const { PROMPT_VERSION, resolveBranch } = require('./normalize');
const { formTemplate } = require('./forms');

const RULES = `You transcribe a SomSaiJai (Thai juice shop) photo. Return ONLY JSON, no markdown.
Rules:
- Unknown, blank, illegible, or ambiguous is null with state "missing", "illegible", or "ambiguous". NEVER use 0 for a blank.
- A zero is state "observed" and value 0 only when a zero is actually written.
- Do not compute one number from another. Never set scan = total - cash.
- Do not guess the branch from a filename or a folder. Read it from the page. If it is not on the page, branch_raw is null.
- On a Daily Shop Report the branch is often written in the Shift box, as B-3, B - 3, B.3, B 1, B-4, or B-04. Copy that text into shift_raw and also into branch_raw. Do not leave branch_raw null when Shift contains a branch code.
- Keep date_raw exactly as written (25.8.2026 or 25/08/2569). Do not invent a year.
- Copy every menu row, including blanks and handwritten additions. qty null when the cell is blank.
- Set uncertain true when a digit could be another digit. Do not pick the digit that makes the total balance.
- For a transfer slip, read every memo line into memo_lines in order. Do not stop at the first line.
- Do not decide the purchased item from the payee name. Mask account numbers to the last 4 digits only.
- Do not include a full account number, national id, or phone number.
- document_type is one of: sales_report, closing_cash, stock_report, transfer_slip, supplier_receipt, other, unreadable.
- Two sales forms exist. Set form_template to "daily_shop_report" when the title is SOMSAIJAI DAILY SHOP REPORT (menu rows, cash tally, scan tally, total qty, sales THB, shift expenses, closing summary). Set "daily_sales_record" when the title is SOM SAI JAI Daily Sales Record (about 10 products, cash qty, scan qty, total qty, payment summary, Other/Ice).
- The shop-report photo may be rotated. Read it after turning the title upright. Set orientation to "rotated" when you had to turn it, otherwise "upright".
- Tally marks are strokes. A digit written in brackets next to the strokes is the staff count: put that digit in cash_qty or scan_qty. If your stroke count disagrees with the bracket, keep both and set uncertain true. Do not pick the one that balances.
- On a Daily Sales Record the column headed Total Qty sometimes contains baht, not cups. Put a column that is money in amount, and put bracket counts in cash_qty and scan_qty. If you cannot tell whether a number is cups or baht, leave qty and amount null and set uncertain true. Do not multiply price by qty and call the product observed.
- Copy handwritten price changes into price_overridden_from and price_overridden_to. Copy extra handwritten rows, including items with no printed line. A crossed-out row has struck true and is not a sale.
- When staff cross out only the printed product name and write another product on that row (for example Coconut crossed out, Volcano Water written), item_raw is the WRITTEN product, struck stays false, and label_crossed_out is the printed name. Book what staff wrote, never the crossed-out printed label.
- Ice and Other are not menu cups. Put them in other.ice and other.other.
- Mixed drinks (Volcano, Blended, Mango Sticky Rice) stay as their own rows. Do not split them into orange, mango, or another single fruit.
- A blank qty is null. Do not write 0 because the row is empty.`;

const FULL_SHAPE = `{
  "document_type": "sales_report",
  "form_template": null,
  "title_raw": null,
  "orientation": "upright",
  "image_quality": "ok",
  "header": {"date_raw": null, "branch_raw": null, "staff_raw": [], "shift_raw": null, "open_raw": null, "close_raw": null},
  "sales": {
    "cash_sales": {"raw": null, "value": null, "state": "missing"},
    "scan_sales": {"raw": null, "value": null, "state": "missing"},
    "total_sales": {"raw": null, "value": null, "state": "missing"},
    "total_expense": {"raw": null, "value": null, "state": "missing"},
    "net_sales": {"raw": null, "value": null, "state": "missing"},
    "opening_cash": {"raw": null, "value": null, "state": "missing"},
    "counted_cash": {"raw": null, "value": null, "state": "missing"},
    "expected_cash": {"raw": null, "value": null, "state": "missing"},
    "total_cups": {"raw": null, "value": null, "state": "missing"}
  },
  "other": {"ice": {"raw": null, "value": null, "state": "missing"}, "other": {"raw": null, "value": null, "state": "missing"}},
  "notes": [],
  "menu_rows": [{"item_raw": "", "price_raw": null, "price_overridden_from": null, "price_overridden_to": null, "cash_qty": {"raw": null, "value": null, "state": "missing"}, "scan_qty": {"raw": null, "value": null, "state": "missing"}, "qty_raw": null, "qty_value": null, "qty_state": "missing", "amount_raw": null, "uncertain": false, "struck": false, "label_crossed_out": null}],
  "handwritten_additions": [],
  "shift_expenses": [],
  "stock_rows": [],
  "slip": {
    "bank": null, "status_raw": null, "datetime_raw": null,
    "amount": {"raw": null, "value": null, "state": "missing"},
    "fee": {"raw": null, "value": null, "state": "missing"},
    "currency": null, "reference_raw": null,
    "sender_masked": null, "receiver_masked": null,
    "memo_lines": [],
    "items": [{"item_raw": "", "quantity_raw": null, "unit_raw": null, "line_amount": null}]
  },
  "uncertainties": []
}`;

const FULL_PROMPT = `${RULES}\nUse this shape:\n${FULL_SHAPE}`;
const SECOND_PROMPT = `${RULES}
This is an independent second reading. Do not try to make the columns balance.
Return ONLY this JSON:
{"date_raw": null, "branch_raw": null, "shift_raw": null, "form_template": null, "sales": {"cash_sales": {"raw": null, "value": null, "state": "missing"}, "scan_sales": {"raw": null, "value": null, "state": "missing"}, "total_sales": {"raw": null, "value": null, "state": "missing"}, "total_expense": {"raw": null, "value": null, "state": "missing"}, "opening_cash": {"raw": null, "value": null, "state": "missing"}, "counted_cash": {"raw": null, "value": null, "state": "missing"}, "total_cups": {"raw": null, "value": null, "state": "missing"}}, "other": {"ice": {"raw": null, "value": null, "state": "missing"}}, "slip": {"amount": {"raw": null, "value": null, "state": "missing"}, "memo_lines": []}}`;

function parseModelJson(text) {
  const clean = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('model did not return JSON');
  return JSON.parse(match[0]);
}

async function defaultGenerate({ buf, mimeType, prompt, apiKey, model }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const { GoogleGenAI } = require('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: mimeType || 'image/jpeg' } },
      ],
    }],
  });
  return parseModelJson(response.text);
}

const MAX_ATTEMPTS = 4;

function errorText(err) {
  if (!err) return '';
  const nested = err.error || err.cause || {};
  return [err.status, err.statusCode, err.code, err.message, nested.status, nested.code, nested.message]
    .filter(part => part != null && part !== '')
    .join(' ');
}

function isRetryable(err) {
  const status = Number(err && (err.status || err.statusCode || (err.error && err.error.status)));
  if (status === 503 || status === 429) return true;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|TOO MANY REQUESTS/i.test(errorText(err));
}

function backoffMs(attempt, random = Math.random) {
  const exp = Math.min(8000, 500 * (2 ** (Math.max(1, attempt) - 1)));
  const roll = Number(random());
  const jitter = Math.floor((Number.isFinite(roll) ? roll : 0) * 250);
  return exp + jitter;
}

function observedAmount(field) {
  if (field == null || typeof field !== 'object') return null;
  if (field.state && field.state !== 'observed') return null;
  return typeof field.value === 'number' && Number.isFinite(field.value) ? field.value : null;
}

function rowAmount(row) {
  if (!row || row.struck) return null;
  if (row.amount && typeof row.amount === 'object') return observedAmount(row.amount);
  if (row.amount_state && row.amount_state !== 'observed') return null;
  return typeof row.amount_value === 'number' && Number.isFinite(row.amount_value) ? row.amount_value : null;
}

/**
 * A second Gemini call is spent only when the first reading is unsure or
 * the written figures do not add up. A clear photo stays on one call.
 * The two calls are sequential: the second one depends on this decision.
 */
function needsSecondReading(extraction) {
  const reasons = [];
  if (!extraction || extraction.document_type === 'unreadable') {
    return { needed: true, reasons: ['first reading is missing or unreadable'] };
  }
  const header = extraction.header || {};
  if (header.date_raw == null || String(header.date_raw).trim() === '') reasons.push('date was not read');
  const branch = resolveBranch(header, formTemplate(extraction));
  if (branch.state !== 'observed') reasons.push('branch was not read');
  const sales = extraction.sales || {};
  for (const key of ['cash_sales', 'scan_sales', 'total_sales']) {
    if (observedAmount(sales[key]) == null) reasons.push(`${key} is not a clear reading`);
  }
  if (extraction.image_quality && /poor|low|blur|illegible/i.test(String(extraction.image_quality))) {
    reasons.push('image quality is low');
  }
  const rows = [].concat(extraction.menu_rows || [], extraction.handwritten_additions || []);
  if (rows.some(row => row && row.uncertain)) reasons.push('a row is marked uncertain');
  const notes = Array.isArray(extraction.uncertainties) ? extraction.uncertainties.map(String) : [];
  if (notes.some(note => /disagree|illegible|ambiguous|unsure|ไม่ชัด|could be|not stable|unreadable|not legible/i.test(note))) {
    reasons.push('the first reading marked a field unsure');
  }
  const cash = observedAmount(sales.cash_sales);
  const scan = observedAmount(sales.scan_sales);
  const total = observedAmount(sales.total_sales);
  if (cash != null && scan != null && total != null && Math.round(cash * 100) + Math.round(scan * 100) !== Math.round(total * 100)) {
    reasons.push('cash + QR does not equal total');
  }
  const amounts = rows.map(rowAmount).filter(n => n != null);
  if (total != null && amounts.length && amounts.reduce((sum, n) => sum + Math.round(n * 100), 0) !== Math.round(total * 100)) {
    reasons.push('row amounts do not add up to total');
  }
  return { needed: reasons.length > 0, reasons };
}

const sleepMs = ms => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry({ gen, args, fallbackModel, sleep, random, maxAttempts }) {
  const primary = args.model;
  const fallback = fallbackModel && fallbackModel !== primary ? fallbackModel : null;
  const attempts = maxAttempts || MAX_ATTEMPTS;
  const wait = sleep || sleepMs;
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const model = attempt >= 3 && fallback ? fallback : primary;
    try {
      return await gen({ ...args, model });
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === attempts) throw err;
      await wait(backoffMs(attempt, random));
    }
  }
  throw lastErr;
}

/**
 * Read one photo. A consistent first reading is not sent to Gemini again.
 * 503 and 429 are retried with backoff. This does not write any books.
 */
async function extractImage({ buf, mimeType, apiKey, model, fallbackModel, generate, sleep, random, maxAttempts }) {
  const gen = generate || defaultGenerate;
  const first = await generateWithRetry({
    gen,
    args: { buf, mimeType, prompt: FULL_PROMPT, apiKey, model },
    fallbackModel,
    sleep,
    random,
    maxAttempts,
  });
  const decision = needsSecondReading(first);
  if (!decision.needed) {
    return {
      extraction: first,
      second: null,
      secondError: null,
      secondSkipped: true,
      secondSkipReason: 'first reading is consistent',
      prompt_version: PROMPT_VERSION,
    };
  }
  let second = null;
  let secondError = null;
  try {
    second = await generateWithRetry({
      gen,
      args: { buf, mimeType, prompt: SECOND_PROMPT, apiKey, model },
      fallbackModel,
      sleep,
      random,
      maxAttempts,
    });
  } catch (err) {
    secondError = err.message || String(err);
  }
  return {
    extraction: first,
    second,
    secondError,
    secondSkipped: false,
    secondReasons: decision.reasons,
    prompt_version: PROMPT_VERSION,
  };
}

module.exports = {
  extractImage,
  parseModelJson,
  FULL_PROMPT,
  SECOND_PROMPT,
  defaultGenerate,
  needsSecondReading,
  isRetryable,
  backoffMs,
  MAX_ATTEMPTS,
};
