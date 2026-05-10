const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT_DIR = path.join(__dirname, '..', '..', '..', '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, '3_Automation_Dashboard');
const STAGING_FILE = path.join(DASHBOARD_DIR, 'pending_verification.json');

if (!fs.existsSync(STAGING_FILE)) {
    console.error('No staging data found. Run node process_sales.js first.');
    process.exit(1);
}

const stagingData = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf8'));
const verifiedData = stagingData.filter(r => r.verified);

if (verifiedData.length === 0) {
    console.log('⚠️ No records are marked as "verified: true" in pending_verification.json.');
    process.exit(0);
}

// Group by branch then month
const byBranch = {};
verifiedData.forEach(r => {
    const branch = r.branch || 'B1';
    if (!byBranch[branch]) byBranch[branch] = {};
    
    const [d, m, y] = r.date.split('/');
    const monthKey = new Date(`${y}-${m}-${d}`).toLocaleString('en-us', {month:'short'}) + '26';
    if (!byBranch[branch][monthKey]) byBranch[branch][monthKey] = [];
    byBranch[branch][monthKey].push(r);
});

Object.keys(byBranch).forEach(branch => {
    const excelFile = path.join(DASHBOARD_DIR, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
    if (!fs.existsSync(excelFile)) {
        console.error(`Excel file for branch ${branch} not found: ${excelFile}`);
        return;
    }

    const wb = XLSX.readFile(excelFile);
    const byMonth = byBranch[branch];

    Object.keys(byMonth).forEach(month => {
        if (!wb.Sheets[month]) {
            console.error(`Sheet ${month} not found in ${excelFile}! Skipping.`);
            return;
        }

        const ws = wb.Sheets[month];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        const headerRowIdx = data.findIndex(row => row && row.includes('Date'));
        if (headerRowIdx === -1) return;

        const headers = data[headerRowIdx];
        
        // Dynamic Column Mapping
        const ensureColumn = (name, afterName) => {
            if (!headers.includes(name)) {
                const idx = headers.indexOf(afterName) + 1 || headers.length;
                headers.splice(idx, 0, name);
                for (let i = headerRowIdx + 1; i < data.length; i++) {
                    if (data[i]) data[i].splice(idx, 0, 0);
                }
                console.log(`Added '${name}' column to ${month} sheet in ${branch} Excel.`);
            }
        };

        ensureColumn('Orange (100)', 'Orange');
        ensureColumn('Guava', 'Young Coco');
        ensureColumn('Pineapple', 'Guava');
        ensureColumn('Used Mango', 'Used Watermelon (pcs)');
        ensureColumn('Used Coco (Meat)', 'Used Mango');
        ensureColumn('Used Coco (Water)', 'Used Coco (Meat)');
        ensureColumn('Used Coco (Conden)', 'Used Coco (Water)');
        ensureColumn('Used Coco (Raw)', 'Used Coco (Conden)');
        ensureColumn('Used Apple', 'Used Coco (Raw)');
        ensureColumn('Used Guava', 'Used Apple');
        ensureColumn('Used Pineapple', 'Used Guava');
        ensureColumn('Used Young Coco', 'Used Pineapple');

        const col = {};
        headers.forEach((h, i) => col[h] = i);

        const existingRows = data.slice(headerRowIdx + 1);
        const newRecords = byMonth[month];

        newRecords.forEach(rec => {
            const idx = existingRows.findIndex(row => row[0] === rec.date);
            
            // Build row data based on dynamic columns
            const rowData = new Array(headers.length).fill(0);
            rowData[col['Date']] = rec.date;
            rowData[col['Day']] = rec.day;
            rowData[col['Revenue (฿)']] = rec.rev;
            rowData[col['Cash (฿)']] = rec.cash;
            rowData[col['Expenses (฿)']] = rec.exp;
            rowData[col['Cash-Exp (฿)']] = rec.cash - rec.exp;
            rowData[col['Scan/Transfer (฿)']] = rec.scan;
            rowData[col['Orange']] = rec.or;
            rowData[col['Orange (100)']] = rec.or_100 || 0;
            rowData[col['Watermelon']] = rec.wm;
            rowData[col['Mango']] = rec.mg;
            rowData[col['Coconut']] = rec.co;
            rowData[col['Apple']] = rec.ap;
            rowData[col['Young Coco']] = rec.yco || 0;
            rowData[col['Guava']] = rec.guava || 0;
            rowData[col['Pineapple']] = rec.pineapple || 0;
            rowData[col['Total Cups']] = rec.tot;
            rowData[col['Used Orange (basket)']] = rec.uo;
            rowData[col['Used Watermelon (pcs)']] = rec.uw;
            rowData[col['Used Mango']] = rec.umg || 0;
            rowData[col['Used Coco (Meat)']] = rec.uco_meat || 0;
            rowData[col['Used Coco (Water)']] = rec.uco_water || 0;
            rowData[col['Used Coco (Conden)']] = rec.uco_conden || 0;
            rowData[col['Used Coco (Raw)']] = rec.uco_raw || 0;
            rowData[col['Used Apple']] = rec.uap || 0;
            rowData[col['Used Guava']] = rec.uguava || 0;
            rowData[col['Used Pineapple']] = rec.upine || 0;
            rowData[col['Used Young Coco']] = rec.uyco || 0;

            if (idx !== -1) {
                existingRows[idx] = rowData;
                console.log(`[${branch}] Updated record for ${rec.date}`);
            } else {
                existingRows.push(rowData);
                console.log(`[${branch}] Added new record for ${rec.date}`);
            }
        });

        existingRows.sort((a, b) => {
            if (!a[0] || !b[0]) return 0;
            const da = a[0].split('/').reverse().join('');
            const db = b[0].split('/').reverse().join('');
            return da.localeCompare(db);
        });

        const newSheetData = data.slice(0, headerRowIdx + 1).concat(existingRows);
        const finalData = newSheetData.filter(row => row[0] && !['TOTAL', 'AVG/DAY'].includes(row[0]));
        const statsRows = finalData.slice(headerRowIdx + 1);
        
        const totalRow = new Array(headers.length).fill(null);
        totalRow[0] = 'TOTAL';
        totalRow[1] = `${statsRows.length} days`;
        
        for (let c = 2; c < headers.length; c++) {
            totalRow[c] = statsRows.reduce((s, r) => s + (parseFloat(r[c]) || 0), 0);
        }
        
        const avgRow = new Array(headers.length).fill(null);
        avgRow[0] = 'AVG/DAY';
        for (let c = 2; c < headers.length; c++) {
            avgRow[c] = totalRow[c] / statsRows.length;
        }

        finalData.push([]);
        finalData.push(totalRow);
        finalData.push(avgRow);

        wb.Sheets[month] = XLSX.utils.aoa_to_sheet(finalData);
    });

    XLSX.writeFile(wb, excelFile);
    console.log(`✅ ${branch} Excel updated.`);
});

const remainingStaging = stagingData.filter(r => !r.verified);
fs.writeFileSync(STAGING_FILE, JSON.stringify(remainingStaging, null, 2));
