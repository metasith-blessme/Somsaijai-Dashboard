const fs=require('fs');
let S={};
for(const f of fs.readdirSync('.').filter(x=>/^extraction/.test(x)))
  (JSON.parse(fs.readFileSync(f,'utf8')).slips||[]).forEach(s=>S[s.idx]=s);

const split3=t=>{const c=Math.round(t*100),b=Math.floor(c/3),r=c-b*3;const p=[b,b,b];for(let i=0;i<r;i++)p[i]++;return p.map(x=>x/100);};
const rows=[], excluded=[], deferred=[];
const add=(idx,branch,bucket,cat,amt,desc,date,month)=>rows.push({idx,branch,bucket,cat,amt:+amt.toFixed(2),desc,date:date||S[idx].date_norm,month:month||'Aug26'});

// --- owner-directed special handling -------------------------------------
// Salary pool: slips 25+26+27 = 91,500 -> 86,500 expense + 5,000 cash float
add(25,'B1','OPEX','Salary',24300,'ค่าแรง/เงินเดือนพนักงาน ส.ค. (owner allocation from pooled transfers 25/26/27)','31/08/2026');
add(26,'B2','OPEX','Salary',23200,'เงินเดือนพนักงาน ส.ค. (owner allocation from pooled transfers 25/26/27)','01/09/2026','Aug26');
add(27,'B3','OPEX','Salary',39000,'เงินเดือนพนักงาน ส.ค. (owner allocation from pooled transfers 25/26/27)','03/09/2026','Aug26');
excluded.push({idx:'25/26/27',amt:5000,why:'cash withdrawn as operating float — asset, not expense; no petty-cash account exists'});
add(72,'B3','OPEX','Salary',5000,'B3 Aug pre-salary: arkar 3,000 + HtunKyaw 2,000','13/08/2026');
// Ming manager wage 20,000 equally
{const [a,b,c]=split3(20000);
 add(98,'B1','OPEX','Salary',a,'Ming manager wage Aug (1/3 of ฿20,000; slips 98+64)','04/08/2026');
 add(98,'B2','OPEX','Salary',b,'Ming manager wage Aug (1/3 of ฿20,000; slips 98+64)','04/08/2026');
 add(98,'B3','OPEX','Salary',c,'Ming manager wage Aug (1/3 of ฿20,000; slips 98+64)','04/08/2026');}
// equal-split six
[[42,3065,'OPEX','Other OPEX','เครื่องสกัดเย็น 1,142 + เต็นท์ 1,923'],
 [18,2377,'COGS','Other','ค่าใช้จ่ายดำเนินงาน (ผู้จัดการซื้อ, ไม่มีบันทึกในสลิป)'],
 [101,2400,'OPEX','Salary','Salary trainee: k 800, chang 1,200, mai 400'],
 [51,300,'OPEX','Salary','Salary special event 1 person'],
 [21,190,'OPEX','Other OPEX','ค่าปริ้นเอกสาร'],
 [35,145,'OPEX','Other OPEX','ป้าย QR code ใหม่ 4 อัน']].forEach(([i,t,bk,ct,d])=>{
   const p=split3(t); ['B1','B2','B3'].forEach((br,k)=>add(i,br,bk,ct,p[k],d+' (1/3 equal split)'));});
// slip 42 packaging half -> shared pool
add(42,'B1','COGS','Packaging',2704,'หลอดเล็ก 1,318 + หลอดใหญ่ 1,386');
// branch-stated
add(104,'B1','OPEX','Rental',35000,'ค่าเช่า B1 เดือน august');
['B1','B2','B3'].forEach(br=>add(104,br,'OPEX','Rental',4000,'ค่าเช่า stock เดือน august (1/3 split)'));
add(113,'B2','OPEX','Rental',20000,'ค่าเช่าที่ B2 เดือน august (part 1 of 2)');
add(112,'B2','OPEX','Rental',5000,'ค่าเช่าที่ B2 เดือน august (part 2 of 2)');
add(38,'B3','OPEX','Rental',18780.22,'ค่าเช่า B3 เดือน august (MWA01)');
add(80,'B3','OPEX','Other OPEX',1500,'B3 washing fee');
add(102,'B1','OPEX','Other OPEX',3721,'Police fee 2,000 + other equipment 1,721');
// equal-split OPEX porterage
{const p=split3(150);['B1','B2','B3'].forEach((br,k)=>add(105,br,'OPEX','Other OPEX',p[k],'ค่ายกของ (1/3 equal split)'));}
// CAPEX-as-OPEX, branch stated
add(45,'B1','OPEX','Other OPEX',1495.50,'กล้องวงจรปิด 1 ตัว');
add(45,'B3','OPEX','Other OPEX',1495.50,'กล้องวงจรปิด 1 ตัว');
add(46,'B2','OPEX','Other OPEX',1495,'กล้องวงจรปิด 1 ตัว');
add(63,'B1','OPEX','Other OPEX',527,'โต๊ะพับ 1 ตัว');
add(70,'B2','OPEX','Other OPEX',547,'โต๊ะ 1 ตัว');
add(81,'B1','OPEX','Other OPEX',1220,'อุปกรณ์ตกแต่งร้าน (50:50 B1/B2)');
add(81,'B2','OPEX','Other OPEX',1220,'อุปกรณ์ตกแต่งร้าน (50:50 B1/B2)');
add(84,'B1','OPEX','Other OPEX',401,'โต๊ะ 594 + เขียง 208 (equal split B1/B2)');
add(84,'B2','OPEX','Other OPEX',401,'โต๊ะ 594 + เขียง 208 (equal split B1/B2)');
// excluded / out of scope / deferred
excluded.push({idx:82,amt:12884,why:'Ming 30% July profit share — EXCLUDED / Profit Distribution / P&L amt 0'});
excluded.push({idx:41,amt:1500,why:'Durian shop investment — owner: out of scope, not booked'});
excluded.push({idx:8,amt:4250,why:'owner: cut it off, not booked'});
deferred.push({idx:13,amt:30000,why:'B2 June rent, paid 02/07 — July/June correction, needs duplicate check + closed-month authorisation'});
deferred.push({idx:111,amt:3500,why:'owner: belongs to Jul26 — closed-month correction'});
deferred.push({idx:110,amt:14560,why:'watermelon settlement — books to Aug26, but paired with removing two ฿3,200 July estimate rows'});

// mixed COGS slips split into real categories by their evidenced subtotals
add(48,'B1','COGS','Mango',2600,'มะม่วง 52 โล (2 ตะกร้า) กิโลละ 50');
add(48,'B1','COGS','Sticky Rice',200,'ข้าวเหนียวมูน 2 โล โลละ 100');
add(48,'B1','COGS','Other',50,'ถั่วเหลือง 1 ถุง');
add(58,'B1','COGS','Packaging',1352,'หลอดเล็ก 659 (20 แพค) + หลอดใหญ่ 1 ลัง 693');
add(58,'B1','COGS','Coconut',1322,'นมข้นจืด 659 + 663');
add(59,'B1','COGS','Packaging',430,'ฝา');
add(59,'B1','COGS','Coconut',2049,'นมข้นหวาน 717x2 = 1,434 + นมข้นจืด 615');
add(60,'B1','COGS','Packaging',895,'ฝา 439 + ทิชชู 456');

// --- shared-pool COGS: every remaining slip ------------------------------
const handled=new Set([25,26,27,72,98,64,42,18,101,51,21,35,104,113,112,38,80,102,105,45,46,63,70,81,84,82,41,8,13,111,110,48,58,59,60]);
const catMap={97:['Coconut',7600]};
Object.values(S).filter(s=>!handled.has(s.idx)).forEach(s=>{
  const amt = catMap[s.idx]?catMap[s.idx][1]:s.amount;
  const cat = catMap[s.idx]?catMap[s.idx][0]:(s.proposed_category||'Other');
  add(s.idx,'B1','COGS',cat,amt,(s.memo_lines||[]).join(' / ')||'(no memo)');
});

const tot=rows.reduce((a,r)=>a+r.amt,0);
const byBranch={}; rows.forEach(r=>byBranch[r.branch]=(byBranch[r.branch]||0)+r.amt);
fs.writeFileSync('change_list.json',JSON.stringify({batch_id:'BATCH-2026-09-14-AUG-EXPENSES',rows,excluded,deferred,totals:{rows:rows.length,amount:+tot.toFixed(2),byBranch}},null,2));
console.log('proposed rows:',rows.length,' total ฿'+tot.toFixed(2));
console.log('by branch:',Object.entries(byBranch).map(([k,v])=>k+' '+v.toFixed(2)).join('  '));
console.log('excluded:',excluded.reduce((a,x)=>a+x.amt,0).toFixed(2),' deferred:',deferred.reduce((a,x)=>a+x.amt,0).toFixed(2));
const grand=tot+excluded.reduce((a,x)=>a+x.amt,0)+deferred.reduce((a,x)=>a+x.amt,0);
console.log('grand total accounted: ฿'+grand.toFixed(2)+'  (batch paid ฿504,860.22 + slip97 ฿500 refund = '+(504860.22-500).toFixed(2)+')');
