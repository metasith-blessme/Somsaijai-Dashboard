const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = 'SomSaiJai_Dashboard_2026.xlsx';
const wb = XLSX.readFile(EXCEL_FILE);
const monthSheets = wb.SheetNames.filter(name => /^[A-Z][a-z][a-z]\d\d$/.test(name));

monthSheets.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    // Find header row (the one containing 'Date')
    const headerRowIdx = data.findIndex(row => row && row[0] === 'Date');
    if (headerRowIdx === -1) return;

    const headers = data[headerRowIdx];
    if (headers && !headers.includes('Young Coco')) {
        // Insert 'Young Coco' at index 12 (between Apple and Total Cups)
        headers.splice(12, 0, 'Young Coco');
        console.log(`Added Young Coco header for ${sheetName}`);
        
        // Update rows
        for (let i = headerRowIdx + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 10 || ['TOTAL', 'AVG/DAY'].includes(String(row[0]))) continue;
            
            // Shift everything from index 12 onwards
            row.splice(12, 0, 0); // Insert 0 for yco
        }
        wb.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(data);
    }
});

XLSX.writeFile(wb, EXCEL_FILE);
console.log('Successfully added Young Coco column to all Excel sheets');
