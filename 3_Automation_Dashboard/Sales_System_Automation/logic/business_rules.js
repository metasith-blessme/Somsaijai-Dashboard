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

// Costs per unit (baskets/pcs) for contribution calculation
const COSTS = {
    orange: 700,
    watermelon: 35,
    apple: 30,
    mango: 150,
    coconut: 35,
    young: 50,
    guava: 30,
    pineapple: 30
};

const PROFIT_SHARE_RATIO = {
    B1: 0.60,
    B2: 0.70
};

const MING_SHARE_RATIO = {
    B1: 0.40,
    B2: 0.30
};

/**
 * Calculates theoretical revenue based on cup counts
 */
function calculateTheoreticalRevenue(r) {
    const or_100 = r.or_100 || 0;
    const or_60 = Math.max(0, (r.or || 0) - or_100);
    
    return (
        or_60 * PRICES.orange +
        or_100 * PRICES.orange_premium +
        (r.wm || 0) * PRICES.watermelon +
        (r.mg || 0) * PRICES.mango +
        (r.ap || 0) * PRICES.apple +
        (r.co || 0) * PRICES.coconut +
        (r.yco || 0) * PRICES.young +
        (r.guava || 0) * PRICES.guava +
        (r.pineapple || 0) * PRICES.pineapple
    );
}

/**
 * Calculates unit economics (contribution margin) for a record
 */
function calculateContribution(r) {
    const revenue = r.rev || 0;
    const variableCosts = 
        (r.uo || 0) * COSTS.orange +
        (r.uw || 0) * COSTS.watermelon +
        (r.uap || 0) * COSTS.apple +
        (r.umg || 0) * COSTS.mango +
        (r.exp || 0); // Include ice/staff as variable ops cost

    return {
        revenue,
        costs: variableCosts,
        margin: revenue - variableCosts,
        margin_pct: revenue > 0 ? ((revenue - variableCosts) / revenue) * 100 : 0
    };
}

/**
 * Run audit verification on a single sales record
 */
function auditRecord(r) {
    const theoreticalRev = calculateTheoreticalRevenue(r);
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
    const branchNames = ['B1', 'B2'];
    
    // Find all months with sales records across any branch
    const monthsSet = new Set();
    branchNames.forEach(b => {
        if (data.branches[b] && data.branches[b].sales) {
            Object.keys(data.branches[b].sales).forEach(m => monthsSet.add(m));
        }
    });

    const months = Array.from(monthsSet).sort((a, b) => {
        const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const ya = parseInt(a.replace(/\D+/g, '')) || 0;
        const yb = parseInt(b.replace(/\D+/g, '')) || 0;
        if (ya !== yb) return ya - yb;
        return order.indexOf(a.substring(0, 3)) - order.indexOf(b.substring(0, 3));
    });

    const fullReport = {};
    const lossCarryForward = { B1: 0, B2: 0 };

    months.forEach(m => {
        const branchCalcs = {
            B1: { rev: 0, opex: 0, rental: 0, opex_list: [], raw_usage: {}, cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 },
            B2: { rev: 0, opex: 0, rental: 0, opex_list: [], raw_usage: {}, cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 }
        };
        
        let total_rev = 0;
        let total_cogs = 0;
        const fruit_summary = {};
        const daily_cogs = [];
        const fruit_sales = { orange: 0, orange_100: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, young: 0, guava: 0, pineapple: 0 };

        // 1. Calculate branch specifics (revenue, usage, cup sales)
        branchNames.forEach(b => {
            const salesRecords = (data.branches[b] && data.branches[b].sales[m]) || [];
            const usage = { orange: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, guava: 0, pineapple: 0 };
            
            salesRecords.forEach(r => {
                branchCalcs[b].rev += r.rev || 0;
                
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
                if (e.bucket === 'PENDING_REFUND') {
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
                    else if (cat.includes('Coconut')) fruit_costs['Coconut'] += e.amt;
                    else if (cat.includes('Guava')) fruit_costs['Guava'] += e.amt;
                    else if (cat.includes('Pineapple') || (e.desc && e.desc.toLowerCase().includes('pineapple'))) fruit_costs['Pineapple'] += e.amt;
                } else {
                    if (e.branch === 'B1') {
                        if (e.cat === 'Rental') {
                            branchCalcs.B1.rental += e.amt;
                        } else {
                            branchCalcs.B1.opex += e.amt;
                        }
                        branchCalcs.B1.opex_list.push(e);
                    } else if (e.branch === 'B2') {
                        if (e.cat === 'Rental') {
                            branchCalcs.B2.rental += e.amt;
                        } else {
                            branchCalcs.B2.opex += e.amt;
                        }
                        branchCalcs.B2.opex_list.push(e);
                    }
                }
            }
        });

        const b1Ratio = total_rev > 0 ? branchCalcs.B1.rev / total_rev : 0;
        const b2Ratio = total_rev > 0 ? branchCalcs.B2.rev / total_rev : 0;

        // 3. Allocate COGS proportionally or by usage (ADR 0001)
        cogsExpenses.forEach(e => {
            const cat = e.cat || 'Other';
            let fruitType = null;
            if (cat.includes('Orange')) fruitType = 'orange';
            else if (cat.includes('Watermelon')) fruitType = 'watermelon';
            else if (cat.includes('Mango')) fruitType = 'mango';
            else if (cat.includes('Apple')) fruitType = 'apple';
            else if (cat.includes('Coconut')) fruitType = 'coconut';
            else if (cat.includes('Guava')) fruitType = 'guava';
            else if (cat.includes('Pineapple') || (e.desc && e.desc.toLowerCase().includes('pineapple'))) fruitType = 'pineapple';

            if (fruitType) {
                const u1 = branchCalcs.B1.raw_usage[fruitType] || 0;
                const u2 = branchCalcs.B2.raw_usage[fruitType] || 0;
                const totUsage = u1 + u2;

                if (totUsage > 0) {
                    branchCalcs.B1.cogs += e.amt * (u1 / totUsage);
                    branchCalcs.B2.cogs += e.amt * (u2 / totUsage);
                } else {
                    branchCalcs.B1.cogs += e.amt * b1Ratio;
                    branchCalcs.B2.cogs += e.amt * b2Ratio;
                }
            } else {
                // Packaging, Ice, Transport, etc. are allocated by revenue shares
                branchCalcs.B1.cogs += e.amt * b1Ratio;
                branchCalcs.B2.cogs += e.amt * b2Ratio;
            }
        });

        // 4. Calculate Net Profit and partner payout with loss carry-forward (ADR 0002)
        branchNames.forEach(b => {
            const branchData = branchCalcs[b];
            
            // Raw Net Profit
            branchData.net = branchData.rev - branchData.opex - branchData.rental - branchData.cogs;
            
            // Apply Net Loss Carry-Forward
            branchData.loss_carry_forward = lossCarryForward[b];
            
            if (branchData.net < 0) {
                // If branch made a loss, quarantine it and carry it forward
                lossCarryForward[b] += Math.abs(branchData.net);
                branchData.adjusted_net = 0;
                branchData.share = 0;
                branchData.ming_share = 0;
            } else {
                // If branch made profit, offset against carry-forward loss
                const offset = Math.min(branchData.net, lossCarryForward[b]);
                branchData.adjusted_net = branchData.net - offset;
                lossCarryForward[b] -= offset;
                
                // Blessme profit share cut
                branchData.share = branchData.adjusted_net * PROFIT_SHARE_RATIO[b];
                // Ming profit share cut
                branchData.ming_share = branchData.adjusted_net * MING_SHARE_RATIO[b];
            }
        });

        const fruit_performance = [
            { name: 'Orange', rev: (fruit_sales.orange * PRICES.orange) + (fruit_sales.orange_100 * PRICES.orange_premium), cost: fruit_costs['Orange'], cups: fruit_sales.orange + fruit_sales.orange_100 },
            { name: 'Watermelon', rev: fruit_sales.watermelon * PRICES.watermelon, cost: fruit_costs['Watermelon'], cups: fruit_sales.watermelon },
            { name: 'Mango', rev: fruit_sales.mango * PRICES.mango, cost: fruit_costs['Mango'], cups: fruit_sales.mango },
            { name: 'Apple', rev: fruit_sales.apple * PRICES.apple, cost: fruit_costs['Apple'], cups: fruit_sales.apple },
            { name: 'Coconut', rev: fruit_sales.coconut * PRICES.coconut, cost: fruit_costs['Coconut'], cups: fruit_sales.coconut },
            { name: 'Young Coco', rev: fruit_sales.young * PRICES.young, cost: 0, cups: fruit_sales.young },
            { name: 'Guava', rev: fruit_sales.guava * PRICES.guava, cost: fruit_costs['Guava'], cups: fruit_sales.guava },
            { name: 'Pineapple', rev: fruit_sales.pineapple * PRICES.pineapple, cost: fruit_costs['Pineapple'], cups: fruit_sales.pineapple }
        ].map(f => ({ ...f, roi: f.cost > 0 ? ((f.rev - f.cost) / f.cost * 100).toFixed(1) + '%' : 'N/A' }));

        fullReport[m] = {
            total_rev,
            total_cogs,
            b1: {
                rev: branchCalcs.B1.rev,
                rental: branchCalcs.B1.rental,
                opex: branchCalcs.B1.opex,
                opex_list: branchCalcs.B1.opex_list,
                cogs: branchCalcs.B1.cogs,
                net: branchCalcs.B1.net,
                loss_carry_forward: branchCalcs.B1.loss_carry_forward,
                adjusted_net: branchCalcs.B1.adjusted_net,
                share: branchCalcs.B1.share,
                ming_share: branchCalcs.B1.ming_share
            },
            b2: {
                rev: branchCalcs.B2.rev,
                rental: branchCalcs.B2.rental,
                opex: branchCalcs.B2.opex,
                opex_list: branchCalcs.B2.opex_list,
                cogs: branchCalcs.B2.cogs,
                net: branchCalcs.B2.net,
                loss_carry_forward: branchCalcs.B2.loss_carry_forward,
                adjusted_net: branchCalcs.B2.adjusted_net,
                share: branchCalcs.B2.share,
                ming_share: branchCalcs.B2.ming_share
            },
            fruit_summary,
            daily_cogs,
            fruit_performance
        };
    });

    // 5. Add Annual Summary ('all')
    const annual = {
        total_rev: 0,
        total_cogs: 0,
        b1: { rev: 0, opex: 0, rental: 0, opex_list: [], cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 },
        b2: { rev: 0, opex: 0, rental: 0, opex_list: [], cogs: 0, net: 0, share: 0, ming_share: 0, loss_carry_forward: 0, adjusted_net: 0 },
        fruit_summary: {},
        daily_cogs: [],
        fruit_performance: []
    };

    months.forEach(m => {
        const r = fullReport[m];
        annual.total_rev += r.total_rev;
        annual.total_cogs += r.total_cogs;
        
        branchNames.forEach(b => {
            annual[b.toLowerCase()].rev += r[b.toLowerCase()].rev;
            annual[b.toLowerCase()].rental += r[b.toLowerCase()].rental || 0;
            annual[b.toLowerCase()].opex += r[b.toLowerCase()].opex;
            annual[b.toLowerCase()].cogs += r[b.toLowerCase()].cogs;
            annual[b.toLowerCase()].net += r[b.toLowerCase()].net;
            annual[b.toLowerCase()].share += r[b.toLowerCase()].share;
            annual[b.toLowerCase()].ming_share += r[b.toLowerCase()].ming_share || 0;
            annual[b.toLowerCase()].opex_list = annual[b.toLowerCase()].opex_list.concat(r[b.toLowerCase()].opex_list);
        });

        Object.keys(r.fruit_summary).forEach(cat => {
            annual.fruit_summary[cat] = (annual.fruit_summary[cat] || 0) + r.fruit_summary[cat];
        });
        
        annual.daily_cogs = annual.daily_cogs.concat(r.daily_cogs || []);
    });

    // Recalculate annual fruit performance from sums of sales and costs
    const annual_fruit_costs = { 'Orange': 0, 'Watermelon': 0, 'Mango': 0, 'Apple': 0, 'Coconut': 0, 'Guava': 0, 'Pineapple': 0 };
    const annual_fruit_sales = { orange: 0, orange_100: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, young: 0, guava: 0, pineapple: 0 };
    
    months.forEach(m => {
        const r = fullReport[m];
        r.fruit_performance.forEach(p => {
            if (annual_fruit_costs.hasOwnProperty(p.name)) {
                annual_fruit_costs[p.name] += p.cost || 0;
            }
        });
        
        branchNames.forEach(b => {
            (data.branches[b].sales[m] || []).forEach(record => {
                annual_fruit_sales.orange += (record.or || 0);
                annual_fruit_sales.orange_100 += (record.or_100 || 0);
                annual_fruit_sales.watermelon += (record.wm || 0);
                annual_fruit_sales.mango += (record.mg || 0);
                annual_fruit_sales.coconut += (record.co || 0);
                annual_fruit_sales.apple += (record.ap || 0);
                annual_fruit_sales.young += (record.yco || 0);
                annual_fruit_sales.guava += (record.guava || 0);
                annual_fruit_sales.pineapple += (record.pineapple || 0);
            });
        });
    });

    annual.fruit_performance = [
        { name: 'Orange', rev: (annual_fruit_sales.orange * PRICES.orange) + (annual_fruit_sales.orange_100 * PRICES.orange_premium), cost: annual_fruit_costs['Orange'], cups: annual_fruit_sales.orange + annual_fruit_sales.orange_100 },
        { name: 'Watermelon', rev: annual_fruit_sales.watermelon * PRICES.watermelon, cost: annual_fruit_costs['Watermelon'], cups: annual_fruit_sales.watermelon },
        { name: 'Mango', rev: annual_fruit_sales.mango * PRICES.mango, cost: annual_fruit_costs['Mango'], cups: annual_fruit_sales.mango },
        { name: 'Apple', rev: annual_fruit_sales.apple * PRICES.apple, cost: annual_fruit_costs['Apple'], cups: annual_fruit_sales.apple },
        { name: 'Coconut', rev: annual_fruit_sales.coconut * PRICES.coconut, cost: annual_fruit_costs['Coconut'], cups: annual_fruit_sales.coconut },
        { name: 'Young Coco', rev: annual_fruit_sales.young * PRICES.young, cost: 0, cups: annual_fruit_sales.young },
        { name: 'Guava', rev: annual_fruit_sales.guava * PRICES.guava, cost: annual_fruit_costs['Guava'], cups: annual_fruit_sales.guava },
        { name: 'Pineapple', rev: annual_fruit_sales.pineapple * PRICES.pineapple, cost: annual_fruit_costs['Pineapple'], cups: annual_fruit_sales.pineapple }
    ].map(f => ({ ...f, roi: f.cost > 0 ? ((f.rev - f.cost) / f.cost * 100).toFixed(1) + '%' : 'N/A' }));

    fullReport['all'] = annual;
    
    return fullReport;
}

module.exports = {
    PRICES,
    YIELDS,
    COSTS,
    calculateTheoreticalRevenue,
    calculateContribution,
    auditRecord,
    calculatePL
};
