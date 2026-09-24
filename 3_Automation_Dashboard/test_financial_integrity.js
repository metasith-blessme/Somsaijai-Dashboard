const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculatePL, calculateTheoreticalRevenue, auditRecord } = require('./Sales_System_Automation/logic/business_rules');
const input = sales => ({ branches: { B1:{sales}, B2:{sales:{}}, B3:{sales:{}} }, expenses:[] });

test('SKU revenue preserves price eras and counts premium cups once, including annual totals', () => {
  const r=calculatePL(input({
    Jan26:[{d:'16/01/2026',or:10,wm:2},{d:'17/01/2026',or:10,wm:2}],
    Apr26:[{d:'01/04/2026',or:10,or_100:2}]
  }));
  const fruit=(m,n)=>r[m].fruit_performance.find(x=>x.name===n);
  assert.equal(fruit('Jan26','Orange').rev,1400);
  assert.equal(fruit('Jan26','Watermelon').rev,230);
  assert.equal(fruit('Apr26','Orange').rev,680);
  assert.equal(fruit('Apr26','Orange').cups,10);
  assert.equal(fruit('all','Orange').rev,2080);
  assert.equal(fruit('all','Orange').cups,30);
});

test('evidenced July B1 price and explicit bottle revenue reach both audit and SKU report', () => {
  const r={d:'03/07/2026',or:10,bottle_rev:400,rev:1100};
  assert.equal(calculateTheoreticalRevenue(r,'B1'),1100);
  assert.equal(auditRecord(r,'B1').rev_diff,0);
  assert.equal(calculatePL(input({Jul26:[r]})).Jul26.fruit_performance.find(x=>x.name==='Orange').rev,700);
  assert.equal(calculateTheoreticalRevenue({...r,d:'30/06/2026'},'B1'),1000);
  assert.equal(calculateTheoreticalRevenue({...r,d:'01/08/2026'},'B1'),1000);
  assert.equal(calculateTheoreticalRevenue(r,'B2'),1000);
});

test('annual loss balance is the closing balance; offsets sum actual monthly recovery', () => {
  const d=input({May26:[{rev:0}],Jun26:[{rev:40}],Jul26:[{rev:0}]});
  d.expenses=[
    {branch:'B1',month:'May26',bucket:'OPEX',cat:'Salary',amt:100},
    {branch:'B1',month:'Jul26',bucket:'OPEX',cat:'Salary',amt:20}
  ];
  const r=calculatePL(d);
  assert.equal(r.Jun26.b1.loss_carry_forward,100);
  assert.equal(r.Jun26.b1.loss_offset,40);
  assert.equal(r.Jun26.b1.closing_loss,60);
  assert.equal(r.Jul26.b1.closing_loss,80);
  assert.equal(r.all.b1.loss_carry_forward,80);
  assert.equal(r.all.b1.closing_loss,80);
  assert.equal(r.all.b1.loss_offset,40);
  assert.equal(r.all.b1.share,0);
  assert.equal(r.all.b2.closing_loss,0);
});

test('unknown Young Coco cost remains unknown in monthly and annual reporting', () => {
  const r=calculatePL(input({Jul26:[{d:'03/07/2026',yco:2,rev:180}]}));
  for(const m of ['Jul26','all']) {
    const f=r[m].fruit_performance.find(x=>x.name==='Young Coco');
    assert.equal(f.cost,null);
    assert.equal(f.roi,'N/A');
  }
});
