/**
 * SomSaiJai Central Business Logic
 * Single source of truth for pricing, yields, revenue, and P&L calculations.
 */

const fs = require('fs');
const path = require('path');

// Load dynamic parameters from config file
const PARAMS_PATH = path.join(__dirname, '..', 'config', 'audit_params.json');
let params = {
    yields: { orange: 29.3, watermelon: 3.5, apple: 0.5, mango: 0.5 },
    prices: { orange: 60, orange_premium: 100, watermelon: 50, apple: 60, mango: 90, coconut: 60, young: 90, guava: 60, pineapple: 60 },
    thresholds: { revenue_pct: 0.05, revenue_abs: 500, stock_pct: 0.10 }
};

if (fs.existsSync(PARAMS_PATH)) {
    try {
        params = JSON.parse(fs.readFileSync(PARAMS_PATH, 'utf8'));
    } catch (e) {
        console.error('Failed to parse audit_params.json, using defaults.', e);
    }
}

const PRICES = params.prices;
const YIELDS = params.yields;


const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Jul26' -> a sortable/comparable integer. -1 for anything unparseable. */
function monthIndex(m) {
    const mi = MONTH_ORDER.indexOf(String(m).substring(0, 3));
    if (mi < 0) return -1;
    const year = parseInt(String(m).replace(/\D+/g, ''), 10) || 0;
    return year * 12 + mi;
}

// Profit share went to a flat 70/30 (Blessme/Ming) on every branch from Jul26.
// B1 ran 60/40 before that, and months already closed must keep reporting the
// rate that was actually paid — so this is looked up per (branch, month), never
// applied retroactively.
const PROFIT_SHARE_EFFECTIVE_MONTH = 'Jul26';
const PROFIT_SHARE_CURRENT = 0.70;
const PROFIT_SHARE_LEGACY = {
    B1: 0.60,
    B2: 0.70,
    B3: 0.70,
    B4: 0.70
};

/** Blessme's cut of net profit for a branch in a given month. Ming gets the rest. */
function profitShareFor(branch, month) {
    if (monthIndex(month) >= monthIndex(PROFIT_SHARE_EFFECTIVE_MONTH)) return PROFIT_SHARE_CURRENT;
    return PROFIT_SHARE_LEGACY[branch] !== undefined ? PROFIT_SHARE_LEGACY[branch] : PROFIT_SHARE_CURRENT;
}

// Partner profit-share payouts are a distribution OF profit, never a cost of earning it.
// ponytail: matches the two shapes actually seen in the books — an explicit
// "ส่วนแบ่งกำไร"/"ปันผล", and a bare "ส่วนแบ่ง" next to a profit-share ratio
// (60/40 for B1, 70/30 for B2/B3). Widen only if a real payout slips through.
const PROFIT_SHARE_PATTERNS = [
    /ส่วนแบ่งกำไร/,
    /ปันผล/,
    /profit\s*(share|distribution)/i,
    /ส่วนแบ่ง.{0,12}(60|40|70|30)\s*(%|เปอ)/
];

// Buckets that are carried in the raw data for traceability but excluded from P&L.
const NON_PL_BUCKETS = ['PENDING_REFUND', 'EXCLUDED'];

function isProfitDistribution(desc) {
    return !!desc && PROFIT_SHARE_PATTERNS.some(p => p.test(desc));
}

/**
 * Normalizes a single raw expense row. Returns a NEW object, never mutates input.
 * Profit-share payouts are reclassed to EXCLUDED / amt 0 so they can never reach
 * COGS or OPEX, regardless of how they were categorized at data entry.
 */
function normalizeExpense(e) {
    if (!isProfitDistribution(e.desc)) return e;
    return {
        ...e,
        bucket: 'EXCLUDED',
        cat: 'Profit Distribution',
        amt: 0,
        original_amt: e.amt,
        original_cat: e.cat
    };
}

// B1 opened on higher prices and cut them on 17 Jan 2026 (owner-confirmed 2026-08-28).
// Days 1-16 average ฿74.0/cup against ฿56.2 at today's list; from the 17th it settles at
// ฿60.6 and stays there. Only orange and watermelon were on the menu in that window.
// Without this, every one of those 16 days trips the anti-cheat flag for a price change
// that was deliberate — ฿31,845 of "unexplained" revenue that was never unexplained.
const PRICE_ERAS = [
  // B1 paper reports show ฿70 throughout July. Other branches / later months need confirmation.
  { from: '01/07/2026', until: '01/08/2026', branch: 'B1', prices: { orange: 70 } },
  { until: '17/01/2026', prices: { orange: 80, watermelon: 65 } },
];

/** Prices in force on a record's date. Falls back to the current list. */
function pricesOn(dateStr, branch) {
  const [d, m, y] = String(dateStr || '').split('/').map(Number);
  if (!d || !m || !y) return PRICES;
  const stamp = y * 10000 + m * 100 + d;
  for (const era of PRICE_ERAS) {
    if (era.branch && era.branch !== branch) continue;
    const [sd, sm, sy] = (era.from || '01/01/0001').split('/').map(Number);
    const [ed, em, ey] = era.until.split('/').map(Number);
    if (stamp >= sy * 10000 + sm * 100 + sd && stamp < ey * 10000 + em * 100 + ed) return { ...PRICES, ...era.prices };
  }
  return PRICES;
}

/**
 * Calculates theoretical revenue based on cup counts
 */
function fruitRevenue(r, branch) {
  const PRICES = pricesOn(r.d, branch);
    const or_100 = r.or_100 || 0;
    const or_60 = Math.max(0, (r.or || 0) - or_100);
    
    return {
        orange: or_60 * PRICES.orange + or_100 * PRICES.orange_premium,
        watermelon: (r.wm || 0) * PRICES.watermelon,
        mango: (r.mg || 0) * PRICES.mango,
        apple: (r.ap || 0) * PRICES.apple,
        coconut: (r.co || 0) * PRICES.coconut,
        young: (r.yco || 0) * PRICES.young,
        guava: (r.guava || 0) * PRICES.guava,
        pineapple: (r.pineapple || 0) * PRICES.pineapple
    };
}

function calculateTheoreticalRevenue(r, branch = r.branch) {
    // Include only source-entered bottle revenue; do not guess prices from bottle counts.
    return Object.values(fruitRevenue(r, branch)).reduce((s, v) => s + v, 0) + (r.bottle_rev || 0);
}

/**
 * Run audit verification on a single sales record
 */
function auditRecord(r, branch = r.branch) {
    const theoreticalRev = calculateTheoreticalRevenue(r, branch);
    const diff = r.rev - theoreticalRev;
    return {
        theoretical_rev: theoreticalRev,
        rev_diff: diff,
        is_flagged: Math.abs(diff) > params.thresholds.revenue_abs
    };
}

/**
 * Compiles P&L reports (including B1/B2 profit sharing, Hybrid COGS, Net Loss Carry-Forward)
 */
function calculatePL(data) {
    const branchNames = Object.keys(data.branches || {}).sort();
    
    // Find all months with sales records across any branch
    const monthsSet = new Set();
    branchNames.forEach(b => {
        if (data.branches[b] && data.branches[b].sales) {
            Object.keys(data.branches[b].sales).forEach(m => monthsSet.add(m));
        }
    });

    const months = Array.from(monthsSet).sort((a, b) => monthIndex(a) - monthIndex(b));

    const fullReport = {};
    const lossCarryForward = {};
    branchNames.forEach(b => lossCarryForward[b] = 0);

    months.forEach(m => {
        const branchCalcs = {};
        branchNames.forEach(b => {
            branchCalcs[b] = { rev: 0, opex: 0, rental: 0, daily_exp: 0, opex_list: [], raw_usage: {}, cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 };
        });
        
        let total_rev = 0;
        let total_cogs = 0;
        const fruit_summary = {};
        const daily_cogs = [];
        const fruit_sales = { orange: 0, orange_100: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, young: 0, guava: 0, pineapple: 0 };
        const fruit_revenue = { orange: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, young: 0, guava: 0, pineapple: 0 };

        // 1. Calculate branch specifics (revenue, usage, cup sales)
        branchNames.forEach(b => {
            const salesRecords = (data.branches[b] && data.branches[b].sales[m]) || [];
            const usage = { orange: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, guava: 0, pineapple: 0 };
            
            salesRecords.forEach(r => {
                Object.entries(fruitRevenue(r, b)).forEach(([fruit, revenue]) => { fruit_revenue[fruit] += revenue; });
                branchCalcs[b].rev += r.rev || 0;
                // Cash paid out at the stall each day — mostly ice (~฿120/day), which never
                // reaches the expense ledger. Already branch-specific, so no allocation.
                branchCalcs[b].daily_exp += r.exp || 0;

                fruit_sales.orange += (r.or || 0);
                fruit_sales.orange_100 += (r.or_100 || 0);
                fruit_sales.watermelon += (r.wm || 0);
                fruit_sales.mango += (r.mg || 0);
                fruit_sales.coconut += (r.co || 0);
                fruit_sales.apple += (r.ap || 0);
                fruit_sales.young += (r.yco || 0);
                fruit_sales.guava += (r.guava || 0);
                fruit_sales.pineapple += (r.pineapple || 0);

                usage.orange += (r.uo || 0);
                usage.watermelon += (r.uw || 0);
                usage.mango += (r.umg || 0);
                usage.apple += (r.uap || 0);
                usage.coconut += (r.uco_raw || 0) + (r.uco_meat || 0) + (r.uco_water || 0) + (r.uco_conden || 0);
                usage.guava += (r.uguava || 0);
                usage.pineapple += (r.upine || 0);
            });
            
            branchCalcs[b].raw_usage = usage;
            total_rev += branchCalcs[b].rev;
        });

        // 2. Parse expenses for this month
        const cogsExpenses = [];
        const fruit_costs = { 'Orange': 0, 'Watermelon': 0, 'Mango': 0, 'Apple': 0, 'Coconut': 0, 'Guava': 0, 'Pineapple': 0 };

        (data.expenses || []).forEach(e => {
            if (e.month === m) {
                if (NON_PL_BUCKETS.includes(e.bucket) || (monthIndex(m) >= monthIndex('Sep26') && e.bucket === 'CAPEX')) {
                    // ponytail: excluded from COGS/OPEX, kept in raw data for reconciliation tracking
                } else if (e.bucket === 'COGS') {
                    total_cogs += e.amt;
                    cogsExpenses.push(e);
                    
                    const cat = e.cat || 'Other';
                    fruit_summary[cat] = (fruit_summary[cat] || 0) + e.amt;
                    daily_cogs.push({ date: e.date, desc: e.desc, cat: e.cat, amt: e.amt });
                    
                    if (cat.includes('Orange')) fruit_costs['Orange'] += e.amt;
                    else if (cat.includes('Watermelon')) fruit_costs['Watermelon'] += e.amt;
                    else if (cat.includes('Mango')) fruit_costs['Mango'] += e.amt;
                    else if (cat.includes('Apple')) fruit_costs['Apple'] += e.amt;
                    // A coconut cup is meat + water + sweetened condensed (Goodwill) +
                    // evaporated (Falcon). Milk/Conden is bought only for it, so it is part
                    // of coconut's cost — excluding it read as a 525% ROI when the real
                    // figure is 312%. Owner-confirmed 2026-08-28.
                    else if (cat.includes('Coconut') || cat === 'Milk/Conden') fruit_costs['Coconut'] += e.amt;
                    else if (cat.includes('Guava')) fruit_costs['Guava'] += e.amt;
                    else if (cat.includes('Pineapple') || (e.desc && e.desc.toLowerCase().includes('pineapple'))) fruit_costs['Pineapple'] += e.amt;
                } else {
                    if (branchCalcs[e.branch]) {
                        if (e.cat === 'Rental') {
                            branchCalcs[e.branch].rental += e.amt;
                        } else {
                            branchCalcs[e.branch].opex += e.amt;
                        }
                        branchCalcs[e.branch].opex_list.push(e);
                    }
                }
            }
        });

        const branchRatios = {};
        branchNames.forEach(b => {
            branchRatios[b] = total_rev > 0 ? branchCalcs[b].rev / total_rev : 0;
        });

        // 3. Allocate COGS proportionally or by usage (ADR 0001)
        cogsExpenses.forEach(e => {
            const cat = e.cat || 'Other';
            let fruitType = null;
            if (cat.includes('Orange')) fruitType = 'orange';
            else if (cat.includes('Watermelon')) fruitType = 'watermelon';
            else if (cat.includes('Mango')) fruitType = 'mango';
            else if (cat.includes('Apple')) fruitType = 'apple';
            else if (cat.includes('Coconut') || cat === 'Milk/Conden') fruitType = 'coconut';
            else if (cat.includes('Guava')) fruitType = 'guava';
            else if (cat.includes('Pineapple') || (e.desc && e.desc.toLowerCase().includes('pineapple'))) fruitType = 'pineapple';

            if (fruitType) {
                const usages = {};
                let totUsage = 0;
                const activeBranches = [];
                const passiveBranches = [];
                let passiveRatioSum = 0;

                branchNames.forEach(b => {
                    const u = branchCalcs[b].raw_usage[fruitType] || 0;
                    usages[b] = u;
                    if (u > 0) {
                        totUsage += u;
                        activeBranches.push(b);
                    } else {
                        // Check if branch has NO raw usage recorded at all for ANY fruit (e.g. B3 POS-only reporting)
                        const totalRawUsage = Object.values(branchCalcs[b].raw_usage || {}).reduce((s, v) => s + (v || 0), 0);
                        if (totalRawUsage === 0) {
                            passiveBranches.push(b);
                            passiveRatioSum += branchRatios[b];
                        }
                    }
                });

                if (passiveBranches.length > 0 && activeBranches.length > 0) {
                    // Passive branches take their revenue ratio share of fruit COGS
                    passiveBranches.forEach(b => {
                        branchCalcs[b].cogs += e.amt * branchRatios[b];
                    });
                    // Active branches split the remaining fruit cost proportionally by actual usage
                    const remainingAmt = e.amt * (1 - passiveRatioSum);
                    activeBranches.forEach(b => {
                        branchCalcs[b].cogs += remainingAmt * (usages[b] / totUsage);
                    });
                } else if (totUsage > 0) {
                    branchNames.forEach(b => {
                        branchCalcs[b].cogs += e.amt * (usages[b] / totUsage);
                    });
                } else {
                    branchNames.forEach(b => {
                        branchCalcs[b].cogs += e.amt * branchRatios[b];
                    });
                }
            } else if (e.branch && (cat.includes('Sticky Rice') || cat.includes('Durian'))) {
                // Direct COGS to specific branch (e.g. B3 exclusive items)
                if (branchCalcs[e.branch]) {
                    branchCalcs[e.branch].cogs += e.amt;
                }
            } else {
                // Packaging, Ice, Transport, etc. are allocated by revenue shares
                branchNames.forEach(b => {
                    branchCalcs[b].cogs += e.amt * branchRatios[b];
                });
            }
        });

        // 4. Calculate Net Profit and partner payout with loss carry-forward (ADR 0002)
        branchNames.forEach(b => {
            const branchData = branchCalcs[b];
            const blessmeRatio = profitShareFor(b, m);
            branchData.share_pct = blessmeRatio;

            // Raw Net Profit
            branchData.net = branchData.rev - branchData.opex - branchData.rental - branchData.cogs - branchData.daily_exp;
            
            // Apply Net Loss Carry-Forward
            branchData.loss_carry_forward = lossCarryForward[b];
            branchData.loss_offset = 0;
            
            if (branchData.net < 0) {
                // If branch made a loss, quarantine it and carry it forward
                lossCarryForward[b] += Math.abs(branchData.net);
                branchData.adjusted_net = 0;
                branchData.share = 0;
                branchData.ming_share = 0;
            } else {
                // If branch made profit, offset against carry-forward loss
                const offset = Math.min(branchData.net, lossCarryForward[b]);
                branchData.loss_offset = offset;
                branchData.adjusted_net = branchData.net - offset;
                lossCarryForward[b] -= offset;
                
                // Blessme profit share cut
                branchData.share = branchData.adjusted_net * blessmeRatio;
                // Ming profit share cut
                branchData.ming_share = branchData.adjusted_net * (1 - blessmeRatio);
            }
            branchData.closing_loss = lossCarryForward[b];
        });

        const fruit_performance = [
            { name: 'Orange', rev: fruit_revenue.orange, cost: fruit_costs['Orange'], cups: fruit_sales.orange },
            { name: 'Watermelon', rev: fruit_revenue.watermelon, cost: fruit_costs['Watermelon'], cups: fruit_sales.watermelon },
            { name: 'Mango', rev: fruit_revenue.mango, cost: fruit_costs['Mango'], cups: fruit_sales.mango },
            { name: 'Apple', rev: fruit_revenue.apple, cost: fruit_costs['Apple'], cups: fruit_sales.apple },
            { name: 'Coconut', rev: fruit_revenue.coconut, cost: fruit_costs['Coconut'], cups: fruit_sales.coconut },
            { name: 'Young Coco', rev: fruit_revenue.young, cost: null, cups: fruit_sales.young },
            { name: 'Guava', rev: fruit_revenue.guava, cost: fruit_costs['Guava'], cups: fruit_sales.guava },
            { name: 'Pineapple', rev: fruit_revenue.pineapple, cost: fruit_costs['Pineapple'], cups: fruit_sales.pineapple }
        ].map(f => ({ ...f, roi: f.cost > 0 ? ((f.rev - f.cost) / f.cost * 100).toFixed(1) + '%' : 'N/A' }));

        fullReport[m] = {
            total_rev,
            total_cogs,
            fruit_summary,
            daily_cogs,
            fruit_performance
        };
        branchNames.forEach(b => {
            fullReport[m][b.toLowerCase()] = {
                rev: branchCalcs[b].rev,
                rental: branchCalcs[b].rental,
                opex: branchCalcs[b].opex,
                daily_exp: branchCalcs[b].daily_exp,
                opex_list: branchCalcs[b].opex_list,
                cogs: branchCalcs[b].cogs,
                net: branchCalcs[b].net,
                loss_carry_forward: branchCalcs[b].loss_carry_forward,
                closing_loss: branchCalcs[b].closing_loss,
                loss_offset: branchCalcs[b].loss_offset,
                adjusted_net: branchCalcs[b].adjusted_net,
                share: branchCalcs[b].share,
                ming_share: branchCalcs[b].ming_share,
                share_pct: branchCalcs[b].share_pct
            };
        });
    });

    // 5. Add Annual Summary ('all')
    const annual = {
        total_rev: 0,
        total_cogs: 0,
        fruit_summary: {},
        daily_cogs: [],
        fruit_performance: []
    };
    branchNames.forEach(b => {
        annual[b.toLowerCase()] = { rev: 0, opex: 0, rental: 0, daily_exp: 0, opex_list: [], cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 };
    });

    months.forEach(m => {
        const r = fullReport[m];
        annual.total_rev += r.total_rev;
        annual.total_cogs += r.total_cogs;
        
        branchNames.forEach(b => {
            annual[b.toLowerCase()].rev += r[b.toLowerCase()].rev;
            annual[b.toLowerCase()].rental += r[b.toLowerCase()].rental || 0;
            annual[b.toLowerCase()].opex += r[b.toLowerCase()].opex;
            annual[b.toLowerCase()].daily_exp += r[b.toLowerCase()].daily_exp || 0;
            annual[b.toLowerCase()].cogs += r[b.toLowerCase()].cogs;
            annual[b.toLowerCase()].net += r[b.toLowerCase()].net;
            annual[b.toLowerCase()].adjusted_net += r[b.toLowerCase()].adjusted_net || 0;
            annual[b.toLowerCase()].share += r[b.toLowerCase()].share;
            annual[b.toLowerCase()].ming_share += r[b.toLowerCase()].ming_share || 0;
            annual[b.toLowerCase()].opex_list = annual[b.toLowerCase()].opex_list.concat(r[b.toLowerCase()].opex_list);
        });

        Object.keys(r.fruit_summary).forEach(cat => {
            annual.fruit_summary[cat] = (annual.fruit_summary[cat] || 0) + r.fruit_summary[cat];
        });
        
        annual.daily_cogs = annual.daily_cogs.concat(r.daily_cogs || []);
    });

    // B1 paid 60/40 before Jul26 and 70/30 after, so the year-to-date label is the
    // blended rate actually paid, not whichever rate happens to be current.
    branchNames.forEach(b => {
        const a = annual[b.toLowerCase()];
        a.closing_loss = a.loss_carry_forward = lossCarryForward[b];
        a.loss_offset = months.reduce((s, m) => s + fullReport[m][b.toLowerCase()].loss_offset, 0);
        a.share_pct = a.adjusted_net > 0 ? a.share / a.adjusted_net : profitShareFor(b, months[months.length - 1]);
    });

    // Sum the dated monthly results instead of repricing the whole year at today's menu.
    const annualFruits = {};
    months.forEach(m => fullReport[m].fruit_performance.forEach(f => {
        const a = annualFruits[f.name] ||= { name: f.name, rev: 0, cost: 0, cups: 0 };
        a.rev += f.rev;
        a.cups += f.cups;
        a.cost = a.cost === null || f.cost === null ? null : a.cost + f.cost;
    }));
    annual.fruit_performance = Object.values(annualFruits).map(f => ({ ...f,
        roi: f.cost > 0 ? ((f.rev - f.cost) / f.cost * 100).toFixed(1) + '%' : 'N/A'
    }));

    fullReport['all'] = annual;
    
    return fullReport;
}

module.exports = {
    PRICES,
    YIELDS,
    NON_PL_BUCKETS,
    PROFIT_SHARE_EFFECTIVE_MONTH,
    monthIndex,
    profitShareFor,
    isProfitDistribution,
    normalizeExpense,
    pricesOn,
    calculateTheoreticalRevenue,
    auditRecord,
    calculatePL
};
