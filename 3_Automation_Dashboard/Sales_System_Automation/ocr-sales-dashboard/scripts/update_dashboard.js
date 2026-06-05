const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { auditRecord } = require('../../logic/business_rules');

const ROOT_DIR = path.join(__dirname, '..', '..', '..', '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, '3_Automation_Dashboard');
const DATA_JSON = path.join(DASHBOARD_DIR, 'data.json');
const PARAMS_JSON = path.join(DASHBOARD_DIR, 'Sales_System_Automation', 'config', 'audit_params.json');

const BRANCHES = ['B1', 'B2'];
const MONTHS = ['Jan26', 'Feb26', 'Mar26', 'Apr26', 'May26', 'Jun26', 'Jul26', 'Aug26', 'Sep26', 'Oct26', 'Nov26', 'Dec26'];

function extractSheetData(filePath, sheetName) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const workbook = XLSX.readFile(filePath);
    const ws = workbook.Sheets[sheetName];
    if (!ws) return null;
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const rows = [];
    
    // Find Header Row (usually index 1 or 2)
    const headerRowIdx = json.findIndex(row => row && row.includes('Date'));
    if (headerRowIdx === -1) return null;
    
    const headers = json[headerRowIdx];
    const col = {};
    headers.forEach((h, i) => { if(h) col[h] = i; });

    for (let i = headerRowIdx + 1; i < json.length; i++) {
      const r = json[i];
      if (!r || !r[0] || ['TOTAL', 'AVG/DAY', 'AVG'].includes(String(r[0]))) continue;
      
      const rev = Number(r[col['Revenue (฿)']] || r[2]) || 0;
      const cash = Number(r[col['Cash (฿)']] || r[3]) || 0;
      const exp = Number(r[col['Expenses (฿)']] || r[4]) || 0;
      const scan = Number(r[col['Scan/Transfer (฿)']] || r[6]) || (rev - cash);
      const net = Number(r[col['Cash-Exp (฿)']] || r[5]) || (cash - exp);
      
      const or = Number(r[col['Orange']] || r[7]) || 0;
      const or_100 = Number(r[col['Orange (100)']] || 0);
      const wm = Number(r[col['Watermelon']] || (col['Orange (100)'] ? r[9] : r[8])) || 0;
      const mg = Number(r[col['Mango']] || (col['Orange (100)'] ? r[10] : r[9])) || 0;
      const co = Number(r[col['Coconut']] || (col['Orange (100)'] ? r[11] : r[10])) || 0;
      const ap = Number(r[col['Apple']] || (col['Orange (100)'] ? r[12] : r[11])) || 0;
      const yco = Number(r[col['Young Coco']] || (col['Orange (100)'] ? r[13] : r[12])) || 0;
      const guava = Number(r[col['Guava']] || 0);
      const pineapple = Number(r[col['Pineapple']] || 0);
      const tot = Number(r[col['Total Cups']] || (col['Orange (100)'] ? r[14] : r[13])) || (or + wm + mg + co + ap + yco + guava + pineapple);

      rows.push({
        d: String(r[0]), day: String(r[1] || ''),
        rev, cash, exp, net, scan,
        or, or_100, wm, mg, co, ap, yco, guava, pineapple, tot,
        bb: Number(r[col['Bot Big']]) || 0,
        bs: Number(r[col['Bot Small']]) || 0,
        uo: Number(r[col['Used Orange (basket)']]) || 0,
        uw: Number(r[col['Used Watermelon (pcs)']]) || 0,
        umg: Number(r[col['Used Mango']]) || 0,
        uco_meat: Number(r[col['Used Coco (Meat)']]) || 0,
        uco_water: Number(r[col['Used Coco (Water)']]) || 0,
        uco_conden: Number(r[col['Used Coco (Conden)']]) || 0,
        uco_raw: Number(r[col['Used Coco (Raw)']]) || 0,
        uap: Number(r[col['Used Apple']]) || 0,
        uguava: Number(r[col['Used Guava']]) || 0,
        upine: Number(r[col['Used Pineapple']]) || 0,
        uyco: Number(r[col['Used Young Coco']]) || 0
      });
    }
    return rows;
  } catch (e) { console.error(e); return null; }
}

function extractExpensesData(branch) {
  const filePath = path.join(DASHBOARD_DIR, `SomSaiJai_Dashboard_${branch}_2026.xlsx`);
  if (!fs.existsSync(filePath)) return [];
  try {
    const workbook = XLSX.readFile(filePath);
    const ws = workbook.Sheets['Daily_Expenses'];
    if (!ws) return [];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    const rows = [];
    for (let i = 3; i < json.length; i++) {
      const r = json[i];
      if (!r || !r[0]) continue;
      rows.push({
        date: String(r[0]),
        month: String(r[1]),
        bucket: String(r[2] || 'OPEX'),
        cat: String(r[3]),
        desc: String(r[4]),
        amt: Number(r[5]) || 0,
        branch
      });
    }
    return rows;
  } catch (e) { return []; }
}

function calculateAudit(result) {
  Object.keys(result.branches).forEach(branch => {
    Object.keys(result.branches[branch].sales).forEach(month => {
        result.branches[branch].sales[month].forEach(r => {
          r.audit = auditRecord(r);
        });
    });
  });
}

function update() {
  console.log('--- Starting Daily Update (Dynamic Mapping) ---');
  try {
    const params = JSON.parse(fs.readFileSync(PARAMS_JSON, 'utf8'));
    const result = {
        branches: {},
        expenses: []
    };

    BRANCHES.forEach(b => {
      result.branches[b] = { sales: {} };
      const excelPath = path.join(DASHBOARD_DIR, `SomSaiJai_Dashboard_${b}_2026.xlsx`);
      MONTHS.forEach(m => {
        const data = extractSheetData(excelPath, m);
        if (data && data.length > 0) result.branches[b].sales[m] = data;
      });
      result.expenses = result.expenses.concat(extractExpensesData(b));
    });

    calculateAudit(result);
    fs.writeFileSync(DATA_JSON, JSON.stringify(result, null, 2));
    console.log(`✅ Updated ${DATA_JSON}`);

    // Sync backup html
    console.log('--- Syncing SomSaiJai_Dashboard.html ---');
    execSync(`cd "${DASHBOARD_DIR}" && node sync_dashboard_html.js`, { stdio: 'inherit' });

    // Generate full report data
    console.log('--- Generating reports_data.json ---');
    execSync(`cd "${DASHBOARD_DIR}" && node gen_report.js`, { stdio: 'inherit' });

    execSync(`cd "${DASHBOARD_DIR}" && npx vercel --prod`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Update failed: ' + err.message);
  }
}
update();
