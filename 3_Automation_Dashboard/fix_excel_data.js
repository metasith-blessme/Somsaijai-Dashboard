const XLSX = require('./node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const B1_PATH = path.join(__dirname, 'SomSaiJai_Dashboard_B1_2026.xlsx');
const B2_PATH = path.join(__dirname, 'SomSaiJai_Dashboard_B2_2026.xlsx');

const B2_CORRECTIONS = {
    '02/06/2026': {
        H: 9, I: 0, J: 41, K: 5, L: 8, M: 4, N: 0, O: 2, P: 3, Q: 72,
        T: 0.5, U: 8, V: 10, W: 0.5, X: 1, Y: 0, Z: 0.5, AA: 8, AB: 3, AC: 2, AD: 0
    },
    '04/06/2026': {
        H: 28, I: 0, J: 31, K: 1, L: 2, M: 4, N: 0, O: 0, P: 0, Q: 66,
        T: 1.5, U: 6, V: 2, W: 0, X: 0, Y: 0, Z: 0, AA: 8, AB: 0, AC: 0, AD: 0
    },
    '05/06/2026': {
        H: 21, I: 0, J: 21, K: 5, L: 23, M: 10, N: 0, O: 6, P: 13, Q: 99,
        T: 1.5, U: 5, V: 10, W: 1, X: 1, Y: 0, Z: 1, AA: 8, AB: 18, AC: 9, AD: 0
    },
    '06/06/2026': {
        D: 2640, G: 2310,
        H: 18, I: 0, J: 36, K: 5, L: 10, M: 4, N: 0, O: 5, P: 4, Q: 82,
        T: 0.5, U: 6, V: 10, W: 1, X: 1, Y: 0, Z: 0, AA: 8, AB: 15, AC: 2, AD: 0
    },
    '08/06/2026': {
        H: 14, I: 0, J: 16, K: 1, L: 11, M: 6, N: 0, O: 2, P: 7, Q: 57,
        T: 0.5, U: 4, V: 2, W: 1, X: 1, Y: 1, Z: 1, AA: 12, AB: 6, AC: 4, AD: 0
    },
    '09/06/2026': {
        H: 15, I: 0, J: 14, K: 2, L: 9, M: 0, N: 0, O: 2, P: 7, Q: 49,
        T: 1.5, U: 4, V: 1, W: 1, X: 1, Y: 0, Z: 1, AA: 0, AB: 6, AC: 4, AD: 0
    }
};

const B1_CORRECTIONS = {
    '04/06/2026': {
        H: 36, I: 0, J: 35, K: 1, L: 2, M: 4, N: 0, O: 0, P: 0, Q: 78, S: 8,
        T: 1.5, U: 6, V: 2, W: 0, X: 0, Y: 0, Z: 0, AA: 8, AB: 0, AC: 0, AD: 0
    },
    '10/06/2026': {
        H: 33, I: 0, J: 22, K: 0, L: 12, M: 12, N: 0, O: 0, P: 0, Q: 79,
        T: 1.0, U: 5, V: 0, W: 1, X: 1, Y: 0.5, Z: 0, AA: 10, AB: 0, AC: 0, AD: 0
    },
    '12/06/2026': {
        H: 17, I: 0, J: 14, K: 5, L: 7, M: 8, N: 0, O: 0, P: 0, Q: 51,
        T: 1.0, U: 5, V: 3, W: 1, X: 1, Y: 0, Z: 0, AA: 13, AB: 0, AC: 0, AD: 0
    },
    '14/06/2026': {
        H: 33, I: 0, J: 28, K: 4, L: 19, M: 19, N: 0, O: 0, P: 0, Q: 103,
        T: 1.0, U: 7, V: 3, W: 2, X: 2, Y: 1, Z: 1, AA: 23, AB: 0, AC: 0, AD: 0
    }
};

function applyCorrections(filePath, corrections) {
    console.log(`\nProcessing file: ${path.basename(filePath)}`);
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets['Jun26'];
    if (!ws) {
        console.error('❌ Jun26 sheet not found!');
        return;
    }
    
    // Find header row to map columns and find dates
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerRowIdx = json.findIndex(row => row && row.includes('Date'));
    
    // Scan column A (Date) for matching dates
    let matchCount = 0;
    for (let r = headerRowIdx + 1; r < json.length; r++) {
        const rowData = json[r];
        if (!rowData || !rowData[0]) continue;
        const dateStr = String(rowData[0]).trim();
        
        if (corrections[dateStr]) {
            console.log(`Found row for date ${dateStr} at index ${r + 1}`);
            const cellMods = corrections[dateStr];
            
            Object.keys(cellMods).forEach(colLetter => {
                const cellAddr = `${colLetter}${r + 1}`;
                const val = cellMods[colLetter];
                
                if (!ws[cellAddr]) {
                    ws[cellAddr] = { t: typeof val === 'number' ? 'n' : 's', v: val };
                } else {
                    ws[cellAddr].v = val;
                    ws[cellAddr].t = typeof val === 'number' ? 'n' : 's';
                    if (ws[cellAddr].w) delete ws[cellAddr].w;
                }
            });
            matchCount++;
        }
    }
    
    if (matchCount > 0) {
        XLSX.writeFile(wb, filePath);
        console.log(`✅ Saved ${matchCount} corrections to ${path.basename(filePath)}`);
    } else {
        console.log(`⚠️ No corrections matched in ${path.basename(filePath)}`);
    }
}

applyCorrections(B1_PATH, B1_CORRECTIONS);
applyCorrections(B2_PATH, B2_CORRECTIONS);
