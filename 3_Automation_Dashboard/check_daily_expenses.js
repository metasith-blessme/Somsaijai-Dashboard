const XLSX = require('xlsx');
const path = require('path');

const b1Path = path.join(__dirname, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const b2Path = path.join(__dirname, 'SomSaiJai_Dashboard_B2_2026.xlsx');

function dumpLastRows(filePath, label) {
    console.log(`=== Last 5 rows of ${label} ===`);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Daily_Expenses'];
    if (!ws) {
        console.log('No Daily_Expenses sheet');
        return;
    }
    const data = XLSX.utils.sheet_to_json(ws, { range: 2 });
    console.log("Total entries:", data.length);
    data.slice(-5).forEach((r, idx) => {
        console.log(`${idx}: ${JSON.stringify(r)}`);
    });
}

dumpLastRows(b1Path, 'Branch 1');
dumpLastRows(b2Path, 'Branch 2');
