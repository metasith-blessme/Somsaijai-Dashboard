const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const dir = '/Users/metasithjumpatip/Desktop/Blessme/somsaijai/B2/1_Sale/Jun26';

const PROMPT = `Analyze this SomSaiJai sales report image.
Return ONLY a JSON object:
{
  "date": "DD/MM/YYYY",
  "rev": number,
  "cash": number,
  "scan": number,
  "exp": number,
  "or": number,
  "wm": number,
  "mg": number,
  "co": number,
  "ap": number,
  "tot": number,
  "uo": number,
  "uw": number,
  "umg": number,
  "uco_raw": number
}`;

async function run() {
    const targets = ['LINE_ALBUM_B2 0626_260615_2.jpg', 'LINE_ALBUM_B2 0626_260615_6.jpg'];
    for (const file of targets) {
        const filePath = path.join(dir, file);
        const data = fs.readFileSync(filePath);
        try {
            console.log(`=== OCR for ${file} ===`);
            const resp = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { text: PROMPT },
                    { inlineData: { data: data.toString('base64'), mimeType: 'image/jpeg' } }
                ]
            });
            console.log(resp.text);
        } catch (e) {
            console.error(`Error for ${file}:`, e.message);
        }
    }
}

run();
