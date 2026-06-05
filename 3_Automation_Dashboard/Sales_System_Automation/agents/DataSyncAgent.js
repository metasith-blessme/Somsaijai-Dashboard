const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const ai = new GoogleGenAI();

class DataSyncAgent {
    constructor() {
        this.model = 'gemini-3.1-pro';
        this.systemInstruction = `You are DataSyncAgent.
Your job is to read pending_verification.json and output a JSON array of exact commands or actions needed to update SomSaiJai_Dashboard_B1_2026.xlsx and data.json.
Focus on accurate routing (B1 vs B2) and ensuring BUILT_IN data in SomSaiJai_Dashboard.html matches.`;
    }

    async syncData(pendingData) {
        console.log(`[DataSyncAgent] Planning sync for data...`);
        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `Here is the verified data: ${JSON.stringify(pendingData)}`,
                config: {
                    systemInstruction: this.systemInstruction,
                    responseMimeType: "application/json"
                }
            });
            return JSON.parse(response.text());
        } catch (error) {
            console.error("[DataSyncAgent] Error:", error);
            return null;
        }
    }
}

module.exports = DataSyncAgent;
