// Apr26 was extracted with the daily ice cost missing on most days — 18 of 30 B1 days
// and 3 of 13 B2 days came through as 0. Every value below was read off the bottom-right
// block of the handwritten report ("ice③ → ⊖180") and cross-checked against that sheet's
// own arithmetic (cash − ice = net), which is the ground truth when the circled bag count
// is ambiguous. Ice is ฿60/bag; halves occur (2½ → ฿150).
//
// Totals match the owner's manual count: B1 ฿4,890, B2 ฿1,290.
// B1 15/04 stays 0 — the stall did not trade that day (rev 0) and has no report.
//
// Run: node fix_april_ice.js [--dry]
const XLSX = require('xlsx');
const path = require('path');

const SHEET = 'Apr26';
const DRY_RUN = process.argv.includes('--dry');

// date -> ice cost in ฿, as written on the report
const ICE = {
    B1: {
        '01/04/2026': 120, '02/04/2026': 180, '03/04/2026': 180, '04/04/2026': 240,
        '05/04/2026': 240, '06/04/2026': 240, '07/04/2026': 180, '08/04/2026': 180,
        '09/04/2026': 120, '10/04/2026': 240, '11/04/2026': 180, '12/04/2026': 180,
        '13/04/2026': 180, '14/04/2026': 180, '15/04/2026': 0, '16/04/2026': 180,
        '17/04/2026': 180, '18/04/2026': 120, '19/04/2026': 120, '20/04/2026': 150,
        '21/04/2026': 120, '22/04/2026': 180, '23/04/2026': 120, '24/04/2026': 120,
        '25/04/2026': 180, '26/04/2026': 180, '27/04/2026': 120, '28/04/2026': 120,
        '29/04/2026': 150, '30/04/2026': 210
    },
    B2: {
        '18/04/2026': 60, '19/04/2026': 60, '20/04/2026': 90, '21/04/2026': 120,
        '22/04/2026': 60, '23/04/2026': 120, '24/04/2026': 120, '25/04/2026': 120,
        '26/04/2026': 60, '27/04/2026': 120, '28/04/2026': 120, '29/04/2026': 120,
        '30/04/2026': 120
    }
};

const EXPECTED_TOTAL = { B1: 4890, B2: 1290 };

// Guard: the table above must match the owner's count before anything is written.
for (const branch of Object.keys(ICE)) {
    const sum = Object.values(ICE[branch]).reduce((s, v) => s + v, 0);
    if (sum !== EXPECTED_TOTAL[branch]) {
        throw new Error(`${branch} ice table sums to ฿${sum}, expected ฿${EXPECTED_TOTAL[branch]}`);
    }
}

/** Normalises "1/4/2026" and "01/04/2026" to the same key. */
const dateKey = (d) => String(d).split('/').map(p => p.trim().padStart(2, '0')).join('/');

function fixBranch(branch) {
    const file = path.join(__dirname, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
    const wb = XLSX.readFile(file);
    const ws = wb.Sheets[SHEET];
    if (!ws) throw new Error(`${SHEET} sheet missing in ${branch}`);

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const headerIdx = grid.findIndex(r => r && r.includes('Date'));
    if (headerIdx === -1) throw new Error(`${branch}/${SHEET}: no header row`);

    // Column positions differ between monthly layouts — always resolve by name.
    const col = {};
    grid[headerIdx].forEach((h, i) => { if (h) col[h] = i; });
    const iExp = col['Expenses (฿)'];
    const iCash = col['Cash (฿)'];
    const iNet = col['Cash-Exp (฿)'];
    if (iExp === undefined) throw new Error(`${branch}/${SHEET}: no "Expenses (฿)" column`);

    const changes = [];
    const seen = new Set();

    for (let i = headerIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        if (!r || !r[0] || ['TOTAL', 'AVG/DAY', 'AVG'].includes(String(r[0]))) continue;
        const key = dateKey(r[0]);
        if (!(key in ICE[branch])) continue;
        seen.add(key);

        const want = ICE[branch][key];
        const have = Number(r[iExp]) || 0;
        if (have === want) continue;

        r[iExp] = want;
        // net is cash-in-hand after the day's payout; it has to move with the expense
        if (iNet !== undefined) r[iNet] = (Number(r[iCash]) || 0) - want;
        changes.push(`  ${key}  ฿${have} → ฿${want}`);
    }

    const missing = Object.keys(ICE[branch]).filter(k => !seen.has(k));
    const total = Object.keys(ICE[branch]).reduce((s, k) => s + ICE[branch][k], 0);

    console.log(`\n=== ${branch} ${SHEET} — ${changes.length} day(s) corrected, total ฿${total.toLocaleString()}`);
    changes.forEach(c => console.log(c));
    if (missing.length) console.log(`  ⚠️  no sheet row for: ${missing.join(', ')}`);

    if (!DRY_RUN && changes.length) {
        wb.Sheets[SHEET] = XLSX.utils.aoa_to_sheet(grid);
        XLSX.writeFile(wb, file);
        console.log(`  ✅ written to ${path.basename(file)}`);
    }
    return changes.length;
}

const touched = ['B1', 'B2'].reduce((s, b) => s + fixBranch(b), 0);
console.log(DRY_RUN ? `\n--dry: ${touched} change(s) pending, nothing written.` : `\n✅ ${touched} day(s) corrected.`);
