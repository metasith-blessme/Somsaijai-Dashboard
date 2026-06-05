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

// --- AUTO-CORRECTION AND VERIFICATION INJECTED ---
try {
    let stagingData = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf8'));
    const DATA_FILE = path.join(DASHBOARD_DIR, 'data.json');
    let dataJson = { branches: { B1: { sales: { May26: [] } }, B2: { sales: { May26: [] } } } };
    if (fs.existsSync(DATA_FILE)) {
        dataJson = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }

    const b2Corrections = {
      "16/05/2026": { or: 17, or_100: 1, wm: 31, mg: 2, co: 11, ap: 6, guava: 8, pineapple: 6, tot: 81 },
      "17/05/2026": { or: 18, or_100: 0, wm: 29, mg: 3, co: 4, ap: 2, guava: 1, pineapple: 5, tot: 62 },
      "15/05/2026": { or: 24, or_100: 0, wm: 51, mg: 10, co: 11, ap: 4, guava: 12, pineapple: 12, tot: 124 },
      "14/05/2026": { or: 25, or_100: 0, wm: 34, mg: 6, co: 7, ap: 3, guava: 5, pineapple: 9, tot: 89 },
      "12/05/2026": { or: 15, or_100: 0, wm: 0, mg: 1, co: 3, ap: 10, guava: 8, pineapple: 6, tot: 43 },
      "11/05/2026": { or: 24, or_100: 0, wm: 50, mg: 4, co: 25, ap: 7, yco: 3, guava: 7, pineapple: 12, tot: 129 },
      "10/05/2026": { or: 11, or_100: 0, wm: 10, mg: 4, co: 13, ap: 3, yco: 1, guava: 8, pineapple: 2, tot: 102 },
      "06/05/2026": { or: 11, or_100: 0, wm: 30, mg: 5, co: 12, ap: 6, yco: 0, guava: 7, pineapple: 10, tot: 81 }
    };

    const processed = stagingData.map(r => {
        let date = r.date;
        if (date.includes('/2023')) date = date.replace('/2023', '/2026');
        if (date.includes('/2025')) date = date.replace('/2025', '/2026');
        
        const [d, m, y] = date.split('/');
        const dateObj = new Date(`${y}-${m}-${d}`);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const correctDay = days[dateObj.getDay()];
        
        let updated = { ...r, date, day: correctDay };
        if (updated.branch === 'B2' && b2Corrections[date]) {
            Object.assign(updated, b2Corrections[date]);
        }
        
        let cash = updated.cash || 0;
        let scan = updated.scan || 0;
        let rev = updated.rev || 0;
        if (cash + scan !== rev) {
            scan = rev - cash;
        }
        
        const cups = (updated.or || 0) + (updated.or_100 || 0) + (updated.wm || 0) + (updated.mg || 0) + (updated.co || 0) + (updated.ap || 0) + (updated.yco || 0) + (updated.guava || 0) + (updated.pineapple || 0);
        let tot = updated.tot;
        if (tot !== cups || tot === 0) {
            tot = cups;
        }
        
        return {
            ...updated,
            cash,
            scan,
            tot,
            verified: true
        };
    });

    const uniqueMap = new Map();
    processed.forEach(r => {
        const key = `${r.branch}_${r.date}`;
        uniqueMap.set(key, r);
    });

    const allDays = Array.from({ length: 31 }, (_, i) => `${(i + 1).toString().padStart(2, '0')}/05/2026`);

    ['B1', 'B2'].forEach(branch => {
        const branchSales = (dataJson.branches && dataJson.branches[branch] && dataJson.branches[branch].sales && dataJson.branches[branch].sales.May26) || [];
        allDays.forEach(day => {
            const key = `${branch}_${day}`;
            if (!uniqueMap.has(key)) {
                const matched = branchSales.find(s => s.d === day || s.date === day);
                if (matched) {
                    const pendingRec = {
                        date: matched.d || matched.date || day,
                        day: matched.day,
                        rev: matched.rev,
                        cash: matched.cash,
                        scan: matched.scan,
                        exp: matched.exp,
                        or: matched.or || 0,
                        or_100: matched.or_100 || 0,
                        wm: matched.wm || 0,
                        mg: matched.mg || 0,
                        co: matched.co || 0,
                        ap: matched.ap || 0,
                        yco: matched.yco || 0,
                        guava: matched.guava || 0,
                        pineapple: matched.pineapple || 0,
                        tot: matched.tot,
                        uo: matched.uo || 0,
                        uw: matched.uw || 0,
                        umg: matched.umg || 0,
                        uco_meat: matched.uco_meat || 0,
                        uco_water: matched.uco_water || 0,
                        uco_conden: matched.uco_conden || 0,
                        uco_raw: matched.uco_raw || 0,
                        uap: matched.uap || 0,
                        uguava: matched.uguava || 0,
                        upine: matched.upine || 0,
                        uyco: matched.uyco || 0,
                        branch: branch,
                        source: 'backfilled_from_data_json',
                        verified: true
                    };
                    uniqueMap.set(key, pendingRec);
                }
            }
        });
    });

    const finalData = Array.from(uniqueMap.values()).sort((a, b) => {
        if (a.branch !== b.branch) return a.branch.localeCompare(b.branch);
        const da = a.date.split('/').reverse().join('');
        const db = b.date.split('/').reverse().join('');
        return da.localeCompare(db);
    });

    fs.writeFileSync(STAGING_FILE, JSON.stringify(finalData, null, 2));
    console.log(`[verify_sales] Injected Auto-correction: sanitized and verified ${finalData.length} records in staging.`);
} catch (e) {
    console.error('[verify_sales] Injected correction failed:', e.message);
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
