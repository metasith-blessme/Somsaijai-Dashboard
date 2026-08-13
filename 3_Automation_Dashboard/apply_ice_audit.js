// Applies verified ice values from ice_audit.json to the branch Excels.
// Only dates present in the audit file are touched; anything not yet verified is
// left exactly as recorded, so this is safe to re-run as the audit is filled in.
//
// Run: node apply_ice_audit.js [--dry]
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const AUDIT = JSON.parse(fs.readFileSync(path.join(__dirname, 'ice_audit.json'), 'utf8'));
const DRY_RUN = process.argv.includes('--dry');
const COL_NAMES = { exp: 'Expenses (฿)', cash: 'Cash (฿)', net: 'Cash-Exp (฿)' };

const dateKey = (d) => String(d).split('/').map(p => p.trim().padStart(2, '0')).join('/');

function applyMonth(wb, branch, month, wanted) {
    const ws = wb.Sheets[month];
    if (!ws) throw new Error(`${branch}: sheet ${month} missing`);

    const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const headerIdx = grid.findIndex(r => r && r.includes('Date'));
    if (headerIdx === -1) throw new Error(`${branch}/${month}: no header row`);

    // Layouts differ per month — always resolve columns by name, never by offset.
    const col = {};
    grid[headerIdx].forEach((h, i) => { if (h) col[h] = i; });
    const iExp = col[COL_NAMES.exp];
    if (iExp === undefined) throw new Error(`${branch}/${month}: no "${COL_NAMES.exp}" column`);
    const iCash = col[COL_NAMES.cash];
    const iNet = col[COL_NAMES.net];

    const changes = [];
    const seen = new Set();

    for (let i = headerIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        if (!r || !r[0] || ['TOTAL', 'AVG/DAY', 'AVG'].includes(String(r[0]))) continue;
        const key = dateKey(r[0]);
        if (!(key in wanted)) continue;
        seen.add(key);

        const want = wanted[key];
        const have = Number(r[iExp]) || 0;
        if (have === want) continue;

        r[iExp] = want;
        if (iNet !== undefined && iCash !== undefined) r[iNet] = (Number(r[iCash]) || 0) - want;
        changes.push({ key, have, want });
    }

    const missing = Object.keys(wanted).filter(k => !seen.has(k));
    if (missing.length) console.log(`  ⚠️  ${branch}/${month}: no sheet row for ${missing.join(', ')}`);

    if (changes.length) {
        console.log(`\n=== ${branch} ${month} — ${changes.length} correction(s)`);
        changes.forEach(c => console.log(`  ${c.key}  ฿${c.have} → ฿${c.want}`));
        const delta = changes.reduce((s, c) => s + (c.want - c.have), 0);
        console.log(`  net change: ${delta >= 0 ? '+' : ''}฿${delta}`);
        if (!DRY_RUN) wb.Sheets[month] = XLSX.utils.aoa_to_sheet(grid);
    } else {
        console.log(`=== ${branch} ${month} — already correct (${Object.keys(wanted).length} days verified)`);
    }
    return changes.length;
}

let total = 0;
for (const branch of ['B1', 'B2', 'B3']) {
    const months = AUDIT[branch];
    if (!months || Object.keys(months).length === 0) continue;

    const file = path.join(__dirname, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
    const wb = XLSX.readFile(file);
    let touched = 0;
    for (const [month, wanted] of Object.entries(months)) {
        touched += applyMonth(wb, branch, month, wanted);
    }
    if (touched && !DRY_RUN) {
        XLSX.writeFile(wb, file);
        console.log(`  ✅ ${path.basename(file)} written`);
    }
    total += touched;
}

console.log(DRY_RUN ? `\n--dry: ${total} correction(s) pending.` : `\n✅ ${total} correction(s) applied.`);
