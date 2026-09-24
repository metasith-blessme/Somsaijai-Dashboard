// Read-only reconciliation. Run from any directory; JSON goes to stdout only.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const XLSX = require('xlsx');
const { dailyRows, parseDate } = require('./sheet_rows');
const { normalizeExpense, calculatePL, calculateTheoreticalRevenue, pricesOn } = require('../Sales_System_Automation/logic/business_rules');
const root = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const data = read('data.json'), reports = read('reports_data.json'), source = read('audit/gsheet_source.json');
const branches = ['B1', 'B2', 'B3'], months = ['Jan26','Feb26','Mar26','Apr26','May26','Jun26','Jul26','Aug26'];
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
const money = n => Math.round((n + Number.EPSILON) * 100) / 100;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function differences(a, b, prefix = '') {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a-b) < 0.005 ? [] : [{path:prefix,a,b}];
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => differences(a[k], b[k], `${prefix}/${k}`));
  return a === b ? [] : [{path:prefix,a,b}];
}
assert.equal(differences({a:100},{a:102}).length,1);
assert.equal(differences({a:100},{a:100}).length,0);
assert.equal(differences({a:100},{}).length,1);
assert.equal(sum([{x:100},{x:-20}],r=>r.x),80);

const out = { scope:'Jan-Aug26; read-only; internal consistency is not proof of source completeness', files:[], monthly:[], sourceDifferences:[], fieldDifferences:[], invalidRows:[], formulaErrors:[], formulaInputs:[], expenseDifferences:[], sourceCoverage:[], julyVariances:[], skuCalculation:[], group:[], distributions:[] };
const protectedFiles = ['data.json','reports_data.json','index.html','SomSaiJai_Dashboard.html','stock_ledger.json', 'Sales_System_Automation/logic/business_rules.js',...branches.map(b=>`SomSaiJai_Dashboard_${b}_2026.xlsx`)];
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
out.files = protectedFiles.map(file=>({file,sha256:hash(file)}));
const normalizedExpenses = [];
const fields = {'Revenue (฿)':'rev','Cash (฿)':'cash','Expenses (฿)':'exp','Scan/Transfer (฿)':'scan','Cash-Exp (฿)':'net','Orange':'or','Orange (100)':'or_100','Watermelon':'wm','Mango':'mg','Coconut':'co','Apple':'ap','Young Coco':'yco','Guava':'guava','Pineapple':'pineapple','Total Cups':'tot','Bottle Revenue (฿)':'bottle_rev','Bot Big':'bb','Bot Small':'bs','Used Orange (basket)':'uo','Used Watermelon (pcs)':'uw','Used Mango':'umg','Used Coco (Meat)':'uco_meat','Used Coco (Water)':'uco_water','Used Coco (Conden)':'uco_conden','Used Coco (Raw)':'uco_raw','Used Apple':'uap','Used Guava':'uguava','Used Pineapple':'upine','Used Young Coco':'uyco'};
for (const branch of branches) {
  const workbook = XLSX.readFile(path.join(root,`SomSaiJai_Dashboard_${branch}_2026.xlsx`));
  for (const [sheet,ws] of Object.entries(workbook.Sheets)) for(const [cell,v] of Object.entries(ws)) {
    if(v?.t === 'e') out.formulaErrors.push({branch,sheet,cell,value:v.w || v.v});
    if(v?.f && months.includes(sheet) && /^[C-EGH-Z]/.test(cell)) out.formulaInputs.push({branch,sheet,cell,formula:v.f,cached:v.v});
  }
  const expenses = XLSX.utils.sheet_to_json(workbook.Sheets.Daily_Expenses,{header:1,defval:null});
  expenses.forEach((r,i)=>{
    if(!r[0] || r[0]==='Date' || i<2)return;
    if(!parseDate(r[0])){out.invalidRows.push({branch,sheet:'Daily_Expenses',row:i+1,raw:r});return;}
    normalizedExpenses.push(normalizeExpense({date:String(r[0]),month:String(r[1]),bucket:String(r[2]||'OPEX'),cat:String(r[3]),desc:String(r[4]),amt:Number(r[5])||0,branch}));
  });
  for (const month of months) {
    const ws=workbook.Sheets[month], raw=ws?XLSX.utils.sheet_to_json(ws,{header:1,defval:null}):[];
    const header=raw.find(r=>r.includes('Date')) || [];
    const excel=dailyRows(ws), generated=data.branches[branch].sales[month]||[], report=reports[month]?.[branch.toLowerCase()];
    const keys=generated.map(r=>parseDate(r.d)?.key);
    for(const key of keys) if(!key || keys.indexOf(key)!==keys.lastIndexOf(key))out.invalidRows.push({branch,month,date:key,reason:'invalid or duplicate generated date'});
    let scanDerived=0,netDerived=0;
    for(const e of excel){
      const r=generated.find(r=>parseDate(r.d)?.key===e.date.key), row=raw.findIndex(x=>parseDate(x[0])?.key===e.date.key)+1;
      if(!r){out.fieldDifferences.push({branch,month,row,reason:'Excel day missing from data.json'});continue;}
      for(const [h,k]of Object.entries(fields)){
        const c=header.indexOf(h); if(c<0)continue;
        const v=e.raw[c];
        if(v===null || v===undefined){if(k==='scan')scanDerived++;if(k==='net')netDerived++;continue;}
        if(typeof v!=='number' || typeof r[k]!=='number' || Math.abs(v-r[k])>0.005)out.fieldDifferences.push({branch,month,cell:XLSX.utils.encode_col(c)+row,field:k,excel:v,generated:r[k]});
      }
    }
    const exp=normalizedExpenses.filter(e=>e.branch===branch&&e.month===month);
    const active=exp.filter(e=>!['EXCLUDED','PENDING_REFUND'].includes(e.bucket));
    out.monthly.push({branch,month,days:excel.length,jsonDays:generated.length,excelRevenue:sum(excel,r=>r.revenue),jsonRevenue:sum(generated,r=>r.rev),reportRevenue:report?.rev??null,revenueDifference:sum(generated,r=>r.rev)-sum(excel,r=>r.revenue),ledgerRows:exp.length,ledgerCOGS:money(sum(active.filter(e=>e.bucket==='COGS'),e=>e.amt)),ledgerOther:money(sum(active.filter(e=>e.bucket!=='COGS'),e=>e.amt)),dailyExpense:sum(excel,r=>r.expenses),allocatedCOGS:money(report?.cogs||0),reportedNet:money(report?.net||0),scanDerivedDays:scanDerived,netDerivedDays:netDerived,theoreticalRevenue:sum(generated,r=>calculateTheoreticalRevenue(r,branch)),theoreticalGap:sum(generated,r=>r.rev-calculateTheoreticalRevenue(r,branch)),cashSplitGap:sum(generated,r=>r.rev-r.cash-r.scan)});
    if(branch==='B1'&&source[month]){
      for(const [day,rev,cash,scan] of source[month]){
        const e=excel.find(x=>x.date.day===day);
        if(!e || e.revenue!==rev || (cash!==null&&e.cash!==cash))out.sourceDifferences.push({branch,month,day,sourceRevenue:rev,excelRevenue:e?.revenue,revDifference:e?e.revenue-rev:null,sourceCash:cash,excelCash:e?.cash});
      }
      out.sourceCoverage.push({branch,month,source:'audit/gsheet_source.json (saved 2026-08-05; not re-fetched)',sourceDays:source[month].length,sourceRevenue:sum(source[month],r=>r[1]),excelRevenue:sum(excel,r=>r.revenue)});
    }
    if(month==='Jul26')out.julyVariances.push(...generated.map(r=>({branch,date:r.d,rev:r.rev,theoretical:calculateTheoreticalRevenue(r,branch),gap:r.rev-calculateTheoreticalRevenue(r,branch)})));
  }
}
const canonical=e=>JSON.stringify(Object.fromEntries(Object.entries(e).sort(([a],[b])=>a.localeCompare(b))));
out.expenseDifferences=differences(normalizedExpenses.map(canonical).sort(),data.expenses.map(canonical).sort());
out.reportDifferences=differences(calculatePL(data),reports);
const html=fs.readFileSync(path.join(root,'SomSaiJai_Dashboard.html'),'utf8');
const embedded=html.match(/const BUILT_IN = (\{[\s\S]*?\n\});/);
out.backupDataMatches=!!embedded&&same(JSON.parse(embedded[1]),data);
for(const month of months.filter(m=>reports[m])){
  const r=reports[month], es=normalizedExpenses.filter(e=>e.month===month&&!['EXCLUDED','PENDING_REFUND'].includes(e.bucket));
  const ledger=sum(es,e=>e.amt), daily=sum(branches,b=>r[b.toLowerCase()].daily_exp), net=sum(branches,b=>r[b.toLowerCase()].net);
  out.group.push({month,revenue:r.total_rev,ledger:money(ledger),dailyExpense:daily,cost:money(ledger+daily),net:money(net),arithmeticDifference:money(r.total_rev-ledger-daily-net),cogsAllocationDifference:money(sum(branches,b=>r[b.toLowerCase()].cogs)-r.total_cogs),capexInOpex:money(sum(es.filter(e=>e.bucket==='CAPEX'||e.cat==='Investment'),e=>e.amt))});
  const records=branches.flatMap(b=>(data.branches[b].sales[month]||[]).map(r=>({...r,branch:b})));
  const datePricedOrange=sum(records,x=>Math.max(0,(x.or||0)-(x.or_100||0))*pricesOn(x.d,x.branch).orange+(x.or_100||0)*pricesOn(x.d,x.branch).orange_premium);
  const datePricedWatermelon=sum(records,x=>(x.wm||0)*pricesOn(x.d,x.branch).watermelon);
  out.skuCalculation.push({month,orangeReport:r.fruit_performance.find(f=>f.name==='Orange').rev,orangeDailyMethod:datePricedOrange,orangeDifference:money(r.fruit_performance.find(f=>f.name==='Orange').rev-datePricedOrange),premiumCups:sum(records,x=>x.or_100||0),watermelonReport:r.fruit_performance.find(f=>f.name==='Watermelon').rev,watermelonDailyMethod:datePricedWatermelon});
  out.distributions.push({month,calculatedBlessme:money(sum(branches,b=>r[b.toLowerCase()].share)),calculatedMing:money(sum(branches,b=>r[b.toLowerCase()].ming_share)),calculatedTotal:money(sum(branches,b=>r[b.toLowerCase()].adjusted_net)),recordedHistoricalPayment:source._distributions[month]||null});
}
const b3=fs.readFileSync(path.join(root,'../B3/Sale/July26/Sale b3 July.md'),'utf8');
const b3Rows=[...b3.matchAll(/(\d+)\.7\.2026\/\s*(\d+)/g)].map(m=>({day:+m[1],rev:+m[2]}));
out.sourceCoverage.push({branch:'B3',month:'Jul26',source:'B3/Sale/July26/Sale b3 July.md (revenue-only transcription)',sourceDays:b3Rows.length,sourceRevenue:sum(b3Rows,r=>r.rev),excelRevenue:out.monthly.find(r=>r.branch==='B3'&&r.month==='Jul26').excelRevenue});
out.b3SourceDifferences=b3Rows.filter(x=>data.branches.B3.sales.Jul26.find(r=>parseDate(r.d).day===x.day)?.rev!==x.rev);
out.julyVariances.sort((a,b)=>Math.abs(b.gap)-Math.abs(a.gap));
out.expenseRows=data.expenses.length;
out.annualSKU=reports.all.fruit_performance;
out.cashArithmeticDifferences = branches.flatMap(branch=>Object.entries(data.branches[branch].sales).flatMap(([month,rs])=>rs.filter(r=>Math.abs(r.rev-r.cash-r.scan)>0.005).map(r=>({branch,month,date:r.d,revenue:r.rev,cash:r.cash,scan:r.scan,difference:r.rev-r.cash-r.scan}))));
out.lossChecks=[];
for(const branch of branches){
  let opening=0;
  for(const month of months.filter(m=>reports[m])){
    const r=reports[month][branch.toLowerCase()], adjusted=Math.max(0,r.net-opening);
    out.lossChecks.push({branch,month,openingDifference:money(r.loss_carry_forward-opening),adjustedDifference:money(r.adjusted_net-adjusted),splitDifference:money(r.share+r.ming_share-adjusted)});
    opening=Math.max(0,opening-r.net);
  }
  out.lossChecks.push({branch,month:'all',closingLoss:money(opening),annualReportedLoss:reports.all[branch.toLowerCase()].loss_carry_forward});
}
// Scenario only: the joint-payroll interpretation needs owner confirmation.
const scenario=structuredClone(data);
const payroll=scenario.expenses.filter(e=>e.branch==='B1'&&e.month==='Jun26'&&e.cat==='Salary'&&e.amt===48400);
if(payroll.length===1){
  payroll[0].amt=24000;
  const alternative=calculatePL(scenario);
  out.junePayrollScenario=['Jun26','Jul26'].map(month=>({month,branch:'B1',currentNet:money(reports[month].b1.net),scenarioNet:money(alternative[month].b1.net),currentDistributable:money(reports[month].b1.adjusted_net),scenarioDistributable:money(alternative[month].b1.adjusted_net)}));
  assert.equal(money(alternative.Jun26.b1.net-reports.Jun26.b1.net),24400,'scenario must change net by the expense difference');
}
out.sourceFilesUnchanged=out.files.every(x=>hash(x.file)===x.sha256);
assert.ok(out.sourceFilesUnchanged,'read-only audit changed a protected file');
console.log(JSON.stringify(out,null,2));
