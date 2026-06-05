const XLSX = require('xlsx');
const path = require('path');

const MASTER_EXCEL = path.join(__dirname, 'SomSaiJai_Dashboard_2026.xlsx');

function checkMarch() {
    const workbook = XLSX.readFile(MASTER_EXCEL);
    const ws = workbook.Sheets['Mar26'];
    if (!ws) {
        console.log('Mar26 sheet not found');
        return;
    }

    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: 0 });
    let totalRevenue = 0;
    const records = [];

    // Assuming rows start from index 2 based on update_dashboard.js
    for (let i = 2; i < json.length; i++) {
        const r = json[i];
        if (!r || !r[0] || ['TOTAL', 'AVG/DAY'].includes(String(r[0]))) continue;
        
        const date = String(r[0]);
        const rev = Number(r[2]) || 0;
        totalRevenue += rev;
        records.push({ date, rev });
    }

    console.log('--- March 2026 Revenue Audit ---');
    records.forEach(rec => console.log(`${rec.date}: ${rec.rev.toLocaleString()} THB`));
    console.log('-------------------------------');
    console.log(`Total Revenue: ${totalRevenue.toLocaleString()} THB`);
    console.log(`Target Revenue: 258,895 THB`);
    console.log(`Difference: ${(totalRevenue - 258895).toLocaleString()} THB`);
}

checkMarch();
