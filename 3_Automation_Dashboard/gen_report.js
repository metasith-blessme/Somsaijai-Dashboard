const fs = require('fs');
const path = require('path');
const { calculatePL } = require('./Sales_System_Automation/logic/business_rules');

const DATA_JSON = path.join(__dirname, 'data.json');
const REPORTS_JSON = path.join(__dirname, 'reports_data.json');

try {
    if (!fs.existsSync(DATA_JSON)) {
        console.error(`Error: ${DATA_JSON} not found.`);
        process.exit(1);
    }
    
    const data = JSON.parse(fs.readFileSync(DATA_JSON, 'utf8'));
    console.log('--- Generating reports_data.json using Centralized Business Rules ---');
    
    const fullReport = calculatePL(data);
    
    fs.writeFileSync(REPORTS_JSON, JSON.stringify(fullReport, null, 2), 'utf8');
    console.log('✅ Final Recalculation Complete with Hybrid COGS, Net Loss Carry-Forward, and Annual Summary.');
} catch (err) {
    console.error('❌ Report generation failed:', err.message);
    process.exit(1);
}
