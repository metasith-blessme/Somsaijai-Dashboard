// Run: node test_expense_rules.js
// Guards the two rules that silently corrupt the P&L when broken:
//   1. partner profit-share payouts never land in COGS/OPEX
//   2. EXCLUDED rows are skipped by calculatePL (not swept into OPEX)
const assert = require('assert');
const { normalizeExpense, isProfitDistribution, calculatePL, profitShareFor, monthIndex } = require('./Sales_System_Automation/logic/business_rules');

const row = (over) => ({ date: '02/01/2026', month: 'Jan26', bucket: 'COGS', cat: 'Ice', desc: '', amt: 1000, branch: 'B1', ...over });

// --- isProfitDistribution: the shapes actually found in the books ---
assert.ok(isProfitDistribution('ส่วนแบ่ง60เปอ'), 'bare share + 60% ratio');
assert.ok(isProfitDistribution('ค่าส่วนแบ่งกำไรเมน 40เปอ'), 'explicit profit share');
assert.ok(isProfitDistribution('ปันผล Q1'), 'dividend');
assert.ok(isProfitDistribution('Profit Share July'), 'english');
assert.ok(!isProfitDistribution('ค่าส้ม 20 ลัง'), 'plain orange purchase is not a payout');
assert.ok(!isProfitDistribution('ค่าเช่า+สต๊อกร้าน'), 'rent+stock is not a payout');
assert.ok(!isProfitDistribution(''), 'empty desc');
assert.ok(!isProfitDistribution(undefined), 'missing desc');

// --- normalizeExpense: reclass to EXCLUDED/0, keep the original for the audit trail ---
const payout = normalizeExpense(row({ desc: 'ส่วนแบ่ง60เปอ', amt: 47961 }));
assert.strictEqual(payout.bucket, 'EXCLUDED');
assert.strictEqual(payout.cat, 'Profit Distribution');
assert.strictEqual(payout.amt, 0);
assert.strictEqual(payout.original_amt, 47961, 'original amount preserved for reporting');
assert.strictEqual(payout.original_cat, 'Ice');

// immutability: the input row is untouched
const input = row({ desc: 'ปันผล', amt: 5000 });
normalizeExpense(input);
assert.strictEqual(input.amt, 5000, 'normalizeExpense must not mutate its input');
assert.strictEqual(input.bucket, 'COGS');

// a normal cost passes through unchanged
const orange = row({ cat: 'Orange', desc: 'ค่าส้ม 20 ลัง', amt: 6680 });
assert.deepStrictEqual(normalizeExpense(orange), orange);

// --- calculatePL: EXCLUDED must not reach COGS or OPEX ---
const sales = { d: '01/01/2026', rev: 10000, or: 100, wm: 80, tot: 180, uo: 4, uw: 3 };
const pl = calculatePL({
    branches: { B1: { sales: { Jan26: [sales] } }, B2: { sales: {} }, B3: { sales: {} } },
    expenses: [
        row({ cat: 'Orange', desc: 'ค่าส้ม', amt: 2000 }),
        row({ bucket: 'OPEX', cat: 'Rental', desc: 'Rent', amt: 3000 }),
        normalizeExpense(row({ desc: 'ส่วนแบ่งกำไร 60เปอ', amt: 99999 })),
        row({ bucket: 'EXCLUDED', cat: 'Profit Distribution', desc: 'hand-entered payout', amt: 88888 })
    ]
}).Jan26;

assert.strictEqual(pl.total_cogs, 2000, 'payouts must stay out of COGS');
assert.strictEqual(pl.b1.rental, 3000, 'real rent still counted');
assert.strictEqual(pl.b1.opex, 0, 'payouts must not be swept into OPEX');
assert.strictEqual(pl.b1.net, 10000 - 2000 - 3000, 'net excludes payouts entirely');

// --- allocation stays exhaustive: per-branch COGS must sum to total_cogs ---
const shared = calculatePL({
    branches: {
        B1: { sales: { Jan26: [{ rev: 6000, uo: 6, tot: 100 }] } },
        B2: { sales: { Jan26: [{ rev: 4000, uo: 2, tot: 70 }] } },
        B3: { sales: {} }
    },
    expenses: [
        row({ cat: 'Orange', desc: 'ค่าส้ม', amt: 800 }),   // by usage: 6/8 vs 2/8
        row({ cat: 'Packaging', desc: 'แก้ว', amt: 1000 })  // by revenue: 60/40
    ]
}).Jan26;

assert.strictEqual(shared.b1.cogs + shared.b2.cogs + shared.b3.cogs, shared.total_cogs, 'allocation loses no baht');
assert.strictEqual(shared.b1.cogs, 600 + 600, 'orange by usage + packaging by revenue');
assert.strictEqual(shared.b2.cogs, 200 + 400);

// --- profit share: flat 70/30 from Jul26, history keeps the rate actually paid ---
assert.strictEqual(profitShareFor('B1', 'Jun26'), 0.60, 'B1 was 60/40 before Jul26');
assert.strictEqual(profitShareFor('B1', 'Jul26'), 0.70, 'B1 switches to 70/30 in Jul26');
assert.strictEqual(profitShareFor('B1', 'Aug26'), 0.70, 'and stays there');
assert.strictEqual(profitShareFor('B2', 'Apr26'), 0.70, 'B2 was always 70/30');
assert.strictEqual(profitShareFor('B3', 'Jul26'), 0.70, 'B3 was always 70/30');
assert.ok(monthIndex('Jan27') > monthIndex('Dec26'), 'month index crosses the year boundary');

// the switch must show up in the payout, not just the lookup
const shareRun = calculatePL({
    branches: { B1: { sales: { Jun26: [{ rev: 10000 }], Jul26: [{ rev: 10000 }] } }, B2: { sales: {} }, B3: { sales: {} } },
    expenses: []
});
const satang = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.01, `${msg} (got ${a}, want ${b})`);
satang(shareRun.Jun26.b1.share, 6000, 'Jun26 pays Blessme 60%');
satang(shareRun.Jun26.b1.ming_share, 4000, 'Jun26 pays Ming 40%');
satang(shareRun.Jul26.b1.share, 7000, 'Jul26 pays Blessme 70%');
satang(shareRun.Jul26.b1.ming_share, 3000, 'Jul26 pays Ming 30%');
satang(shareRun.Jun26.b1.share + shareRun.Jun26.b1.ming_share, shareRun.Jun26.b1.adjusted_net, 'split is exhaustive');
satang(shareRun.all.b1.share_pct, 0.65, 'annual label is the blended rate actually paid');

console.log('✅ expense rules OK');
