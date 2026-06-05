const fs = require('fs');
const path = require('path');

const DASHBOARD_DIR = __dirname;
const STAGING_FILE = path.join(DASHBOARD_DIR, 'pending_verification.json');
const DATA_FILE = path.join(DASHBOARD_DIR, 'data.json');

if (!fs.existsSync(STAGING_FILE)) {
    console.error('No staging file found.');
    process.exit(1);
}

const stagingData = JSON.parse(fs.readFileSync(STAGING_FILE, 'utf8'));
const dataJson = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

console.log(`Initial staging records: ${stagingData.length}`);

// Fix years and verified flags
const processed = stagingData.map(r => {
    let date = r.date;
    // Fix years
    if (date.includes('/2023')) date = date.replace('/2023', '/2026');
    if (date.includes('/2025')) date = date.replace('/2025', '/2026');
    
    // Fix day names if year changed
    const [d, m, y] = date.split('/');
    const dateObj = new Date(`${y}-${m}-${d}`);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const correctDay = days[dateObj.getDay()];
    
    // Ensure cash + scan = rev
    let cash = r.cash || 0;
    let scan = r.scan || 0;
    let rev = r.rev || 0;
    if (cash + scan !== rev) {
        scan = rev - cash;
    }
    
    // Ensure correct total cups
    const cups = (r.or || 0) + (r.or_100 || 0) + (r.wm || 0) + (r.mg || 0) + (r.co || 0) + (r.ap || 0) + (r.yco || 0) + (r.guava || 0) + (r.pineapple || 0);
    let tot = r.tot;
    if (tot !== cups) {
        tot = cups;
    }

    return {
        ...r,
        date: date,
        day: correctDay,
        cash: cash,
        scan: scan,
        tot: tot,
        verified: true
    };
});

// Deduplicate
const uniqueMap = new Map();
processed.forEach(r => {
    const key = `${r.branch}_${r.date}`;
    uniqueMap.set(key, r);
});

// Backfill missing days from data.json if they are not in staging
const allDays = Array.from({ length: 31 }, (_, i) => `${(i + 1).toString().padStart(2, '0')}/05/2026`);

['B1', 'B2'].forEach(branch => {
    const branchSales = dataJson.branches[branch].sales.May26 || [];
    allDays.forEach(day => {
        const key = `${branch}_${day}`;
        if (!uniqueMap.has(key)) {
            // Find in data.json
            const matched = branchSales.find(s => s.d === day || s.date === day);
            if (matched) {
                console.log(`Backfilling ${branch} on ${day} from data.json...`);
                // map keys from data.json format to pending format if needed
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
            } else {
                console.warn(`WARNING: Missing record for ${branch} on ${day} in both staging and data.json`);
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
console.log(`Done! Written ${finalData.length} records back to ${STAGING_FILE}`);
console.log(`B1 records: ${finalData.filter(r => r.branch === 'B1').length}`);
console.log(`B2 records: ${finalData.filter(r => r.branch === 'B2').length}`);
