const { GoogleGenAI } = require('@google/genai');
const { execSync } = require('child_process');

const ai = new GoogleGenAI();

class QADeployerAgent {
    constructor() {
        this.model = 'gemini-3.5-flash';
        this.systemInstruction = `You are QADeployerAgent.
Analyze deployment logs and provide a quick GO/NO-GO JSON response.`;
    }

    async deployAndVerify() {
        console.log(`[QADeployerAgent] Triggering deployment...`);
        try {
            // Rebuild static dashboard data first
            console.log(`[QADeployerAgent] Running update-dashboard...`);
            execSync('npm run update-dashboard', { stdio: 'inherit' });
            
            console.log(`[QADeployerAgent] Running Vercel deployment...`);
            const deployLog = execSync('npx vercel --prod', { encoding: 'utf8' });
            
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `Analyze this Vercel deploy log and confirm success:\n\n${deployLog}`,
                config: {
                    systemInstruction: this.systemInstruction,
                    responseMimeType: "application/json"
                }
            });
            return JSON.parse(response.text());
        } catch (error) {
            console.error("[QADeployerAgent] Error during deployment:", error.message);
            return { status: "FAILED", reason: error.message };
        }
    }
}

module.exports = QADeployerAgent;
