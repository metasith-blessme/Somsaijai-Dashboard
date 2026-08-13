require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const MONTH = process.argv[2] || 'May26';
const BRANCH = process.argv[3] || 'B1';

const ROOT_DIR = path.join(__dirname, '..', '..', '..', '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, '3_Automation_Dashboard');
const SALES_DIR = path.join(ROOT_DIR, BRANCH, '1_Sale', MONTH);
const STAGING_FILE = path.join(DASHBOARD_DIR, 'pending_verification.json');

// --- API CLIENTS ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const EXTRACTION_PROMPT = `Analyze this SomSaiJai sales report image.
Return ONLY a JSON object:
{
  "date": "DD/MM/YYYY",
  "day": "Mon/Tue/Wed/Thu/Fri/Sat/Sun",
  "rev": number (Total/All),
  "cash": number,
  "scan": number (Scan/Transfer),
  "exp": number (Staff/Expenses),
  "or": number (Orange),
  "or_100": number,
  "wm": number,
  "mg": number,
  "co": number,
  "ap": number,
  "yco": number,
  "guava": number,
  "pineapple": number,
  "tot": number (Total cups),
  "uo": number (Used Orange),
  "uw": number,
  "umg": number,
  "uco_meat": number,
  "uco_water": number,
  "uco_conden": number,
  "uco_raw": number,
  "uap": number,
  "uguava": number,
  "upine": number,
  "uyco": number
}
Rules: 0 for missing, convert fractions to decimals. No conversational text.`;

async function callGemini(imagePath, modelName, retries = 2) {
    try {
        const imageData = fs.readFileSync(imagePath);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: [{
                role: "user",
                parts: [
                    { text: EXTRACTION_PROMPT },
                    { inlineData: { data: imageData.toString("base64"), mimeType: "image/jpeg" } }
                ]
            }]
        });
        const text = response.text;
        const cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json|```/g, '').trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : cleanText);
    } catch (e) {
        if (e.message.includes('429') && retries > 0) {
            console.warn(`[${modelName}] Rate limited. Waiting 10s...`);
            await new Promise(r => setTimeout(r, 10000));
            return callGemini(imagePath, modelName, retries - 1);
        }
        console.error(`Gemini Error (${modelName}):`, e.message);
        return null;
    }
}

function auditData(data) {
    if (!data || !data.date) return false;
    
    // Check 1: Revenue Match
    const revCalc = (data.cash || 0) + (data.scan || 0);
    const revMatch = Math.abs((data.rev || 0) - revCalc) < 2; // Allow small rounding error

    // Check 2: Total Cups Match
    const cupsCalc = (data.or || 0) + (data.or_100 || 0) + (data.wm || 0) + (data.mg || 0) + (data.co || 0) + (data.ap || 0) + (data.yco || 0) + (data.guava || 0) + (data.pineapple || 0);
    const cupsMatch = data.tot === cupsCalc || data.tot === 0 || cupsCalc === 0;

    // Check 3: Date Hallucination
    const dateMatch = data.date && data.date.includes('/2026');

    return revMatch && cupsMatch && dateMatch;
}

async function processImages() {
    if (!fs.existsSync(SALES_DIR)) {
        console.error(`Directory not found: ${SALES_DIR}`);
        process.exit(1);
    }

    // Load existing staging data for caching
    let stagingData = [];
    if (fs.existsSync(STAGING_FILE)) {
        try { stagingData = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf8')); } catch(e) {}
    }

    const files = fs.readdirSync(SALES_DIR).filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.png'));
    console.log(`🚀 Turbo Processing ${files.length} images for ${BRANCH}...`);

    const processedSales = [];
    for (const file of files) {
        // --- CACHE CHECK (SKIP IF ALREADY IN STAGING) ---
        const existing = stagingData.find(r => r.source === file && r.branch === BRANCH);
        if (existing && existing.date) {
            console.log(`⏩ Skipping ${file} (Already in staging)`);
            processedSales.push(existing);
            continue;
        }

        const filePath = path.join(SALES_DIR, file);
        console.log(`📦 Processing ${file}...`);

        // --- ATTEMPT: GEMINI OCR MODEL ---
        const ocrModel = process.env.GEMINI_OCR_MODEL || "gemini-3.5-flash";
        let data = await callGemini(filePath, ocrModel, 0); // No retries to keep it fast
        
        if (data) {
            // Local Date Correction (Fix 2086 -> 2026)
            if (data.date && data.date.includes('/2086')) {
                data.date = data.date.replace('/2086', '/2026');
            }

            const verified = auditData(data);
            if (verified) console.log(`  ✅ [AUTO-VERIFIED] ${data.date}`);
            else console.warn(`  ⚠️ Audit failed for ${file}. Needs manual review.`);

            processedSales.push({
                ...data,
                branch: BRANCH,
                source: file,
                verified: verified
            });
        } else {
            console.error(`  ❌ Failed to process ${file} (Rate limited or Error).`);
        }
        
        // ponytail: free-tier Gemini caps at 15 req/min; 5s spacing stays under it. Drop if on a paid key.
        await new Promise(r => setTimeout(r, 5000));
    }

    // Deduplication & Sync
    const uniqueMap = new Map();
    // Keep verified ones over unverified ones for the same date
    processedSales.sort((a, b) => (a.verified === b.verified) ? 0 : a.verified ? -1 : 1);
    processedSales.forEach(s => {
        if (!s.date) return;
        const key = `${BRANCH}_${s.date}`;
        if (!uniqueMap.has(key)) uniqueMap.set(key, s);
    });

    const finalSales = Array.from(uniqueMap.values()).sort((a, b) => {
        const da = a.date.split('/').reverse().join('');
        const db = b.date.split('/').reverse().join('');
        return da.localeCompare(db);
    });

    // Merge back into staging
    finalSales.forEach(newRec => {
        const idx = stagingData.findIndex(r => r.source === newRec.source && r.branch === newRec.branch);
        if (idx === -1) stagingData.push(newRec);
        else stagingData[idx] = newRec;
    });

    fs.writeFileSync(STAGING_FILE, JSON.stringify(stagingData, null, 2));
    console.log(`\n✨ Done! Staging Updated: ${STAGING_FILE}`);
}

processImages();
