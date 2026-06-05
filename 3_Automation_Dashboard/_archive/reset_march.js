const XLSX = require('xlsx');
const path = require('path');

const MASTER_EXCEL = path.join(__dirname, 'SomSaiJai_Dashboard_2026.xlsx');

function resetMarch() {
    const workbook = XLSX.readFile(MASTER_EXCEL);
    const ws = workbook.Sheets['Mar26'];
    if (!ws) {
        console.log('Mar26 sheet not found');
        return;
    }

    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // We want to keep headers (first 2 rows) and the structure.
    // We will find where 'TOTAL' row is and keep rows after/at it if they are formulas,
    // but typically it's better to just reconstruct the rows 1-31.
    
    const newJson = [];
    newJson.push(json[0]); // Header 1
    newJson.push(json[1]); // Header 2
    
    // Create empty rows for 1-31 March
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (let d = 1; d <= 31; d++) {
        const dateStr = `${d < 10 ? '0'+d : d}/03/2026`;
        const dateObj = new Date(2026, 2, d);
        const dayName = days[dateObj.getDay()];
        
        // Row structure: Date, Day, Rev, Cash, Exp, Net, Scan, Or, Wm, Mg, Co, Ap, Tot, BB, BS, UO, UW, UMG, UCO, UAP
        const row = new Array(20).fill(0);
        row[0] = dateStr;
        row[1] = dayName;
        newJson.push(row);
    }
    
    // Add Total row (index 33 in 0-based is row 34)
    const totalRow = new Array(20).fill(0);
    totalRow[0] = 'TOTAL';
    // Add formulas if possible, but for now just zeros
    newJson.push(totalRow);

    const newWs = XLSX.utils.aoa_to_sheet(newJson);
    workbook.Sheets['Mar26'] = newWs;
    XLSX.writeFile(workbook, MASTER_EXCEL);
    console.log('✅ Mar26 sheet reset to empty state (01-31 March).');
}

resetMarch();
