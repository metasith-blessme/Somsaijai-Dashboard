const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const ai = new GoogleGenAI(); // Assumes GEMINI_API_KEY is in env

class ImageExtractorAgent {
    constructor() {
        this.model = process.env.GEMINI_OCR_MODEL || 'gemini-3.1-pro';
        this.systemInstruction = `You are ImageExtractorAgent for SomSaiJai.
Extract sales data from handwritten daily report images.
Return JSON ONLY.
Fields:
- d (Date: DD/MM/YYYY)
- rev (Total Revenue)
- cash (Cash payment)
- scan (Scan payment)
- exp (Daily expenses)
- uo, uw, uap, umg, uco_raw, uco_meat, uco_water, uco_conden, uguava, upine (Cup/Ingredient counts)
Rule: cash + scan = rev. If missing, derive it.`;
    }

    async processImage(imagePath) {
        console.log(`[ImageExtractor] Processing ${imagePath}...`);
        const b64 = fs.readFileSync(imagePath).toString("base64");
        
        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: [
                    { role: 'user', parts: [
                        { text: "Extract sales data from this image." },
                        { inlineData: { mimeType: 'image/jpeg', data: b64 } }
                    ]}
                ],
                config: {
                    systemInstruction: this.systemInstruction,
                    responseMimeType: "application/json"
                }
            });
            return JSON.parse(response.text());
        } catch (error) {
            console.error("[ImageExtractor] Error:", error);
            return null;
        }
    }
}

module.exports = ImageExtractorAgent;
