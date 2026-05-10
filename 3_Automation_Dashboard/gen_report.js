const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const params = JSON.parse(fs.readFileSync('Sales_System_Automation/config/audit_params.json', 'utf8'));

// Dynamically extract all months that have sales data across any branch
let monthsSet = new Set();
['B1', 'B2'].forEach(b => {
    if (data.branches[b] && data.branches[b].sales) {
        Object.keys(data.branches[b].sales).forEach(m => monthsSet.add(m));
    }
});
let months = Array.from(monthsSet).sort((a, b) => {
    const order = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return order.indexOf(a.substring(0, 3)) - order.indexOf(b.substring(0, 3));
});

let fullReport = {};

months.forEach(m => {
    let b1_rev = 0, b1_opex_total = 0, b1_opex_list = [];
    let b2_rev = 0, b2_opex_total = 0, b2_opex_list = [];
    let total_cogs = 0;
    let fruit_summary = {};
    let daily_cogs = [];
    let fruit_sales = { orange: 0, orange_100: 0, watermelon: 0, mango: 0, coconut: 0, apple: 0, young: 0, guava: 0, pineapple: 0 };

    ['B1', 'B2'].forEach(b => {
        data.branches[b].sales[m]?.forEach(r => {
            if (b === 'B1') b1_rev += r.rev; else b2_rev += r.rev;
            fruit_sales.orange += (r.or || 0);
            fruit_sales.orange_100 += (r.or_100 || 0);
            fruit_sales.watermelon += (r.wm || 0);
            fruit_sales.mango += (r.mg || 0);
            fruit_sales.coconut += (r.co || 0);
            fruit_sales.apple += (r.ap || 0);
            fruit_sales.young += (r.yco || 0);
            fruit_sales.guava += (r.guava || 0);
            fruit_sales.pineapple += (r.pineapple || 0);
        });
    });

    let fruit_costs = { 'Orange': 0, 'Watermelon': 0, 'Mango': 0, 'Apple': 0, 'Coconut': 0, 'Pineapple': 0 };
    data.expenses.forEach(e => {
        if (e.month === m) {
            if (e.bucket === 'COGS') {
                total_cogs += e.amt;
                let cat = e.cat || 'Other';
                fruit_summary[cat] = (fruit_summary[cat] || 0) + e.amt;
                daily_cogs.push({ date: e.date, desc: e.desc, cat: e.cat, amt: e.amt });
                
                if (cat.includes('Orange')) fruit_costs['Orange'] += e.amt;
                else if (cat.includes('Watermelon')) fruit_costs['Watermelon'] += e.amt;
                else if (cat.includes('Mango')) fruit_costs['Mango'] += e.amt;
                else if (cat.includes('Apple')) fruit_costs['Apple'] += e.amt;
                else if (cat.includes('Coconut')) fruit_costs['Coconut'] += e.amt;
                else if (e.desc.toLowerCase().includes('pineapple')) fruit_costs['Pineapple'] += e.amt;
            } else {
                if (e.branch === 'B1') { b1_opex_total += e.amt; b1_opex_list.push(e); }
                else { b2_opex_total += e.amt; b2_opex_list.push(e); }
            }
        }
    });

    const total_rev = b1_rev + b2_rev;
    const b1_ratio = total_rev > 0 ? b1_rev / total_rev : 0;
    const b2_ratio = total_rev > 0 ? b2_rev / total_rev : 0;
    const b1_share_cogs = total_cogs * b1_ratio;
    const b2_share_cogs = total_cogs * b2_ratio;

    // Profit Sharing (Blessme Cut)
    const b1_net = b1_rev - b1_opex_total - b1_share_cogs;
    const b2_net = b2_rev - b2_opex_total - b2_share_cogs;
    const b1_blessme = Math.max(0, b1_net * 0.60);
    const b2_blessme = Math.max(0, b2_net * 0.70);

    const fruit_performance = [
        { name: 'Orange', rev: (fruit_sales.orange * params.prices.orange) + (fruit_sales.orange_100 * params.prices.orange_premium), cost: fruit_costs['Orange'], cups: fruit_sales.orange + fruit_sales.orange_100 },
        { name: 'Watermelon', rev: fruit_sales.watermelon * params.prices.watermelon, cost: fruit_costs['Watermelon'], cups: fruit_sales.watermelon },
        { name: 'Mango', rev: fruit_sales.mango * params.prices.mango, cost: fruit_costs['Mango'], cups: fruit_sales.mango },
        { name: 'Apple', rev: fruit_sales.apple * params.prices.apple, cost: fruit_costs['Apple'], cups: fruit_sales.apple },
        { name: 'Coconut', rev: fruit_sales.coconut * params.prices.coconut, cost: fruit_costs['Coconut'], cups: fruit_sales.coconut },
        { name: 'Young Coco', rev: fruit_sales.young * params.prices.young, cost: 0, cups: fruit_sales.young },
        { name: 'Guava', rev: fruit_sales.guava * (params.prices.guava || 60), cost: 0, cups: fruit_sales.guava },
        { name: 'Pineapple', rev: fruit_sales.pineapple * (params.prices.pineapple || 60), cost: fruit_costs['Pineapple'], cups: fruit_sales.pineapple }
    ].map(f => ({ ...f, roi: f.cost > 0 ? ((f.rev - f.cost) / f.cost * 100).toFixed(1) + '%' : 'N/A' }));

    fullReport[m] = {
        total_rev, total_cogs,
        b1: { rev: b1_rev, opex: b1_opex_total, opex_list: b1_opex_list, cogs: b1_share_cogs, net: b1_net, share: b1_blessme },
        b2: { rev: b2_rev, opex: b2_opex_total, opex_list: b2_opex_list, cogs: b2_share_cogs, net: b2_net, share: b2_blessme },
        fruit_summary, daily_cogs, fruit_performance
    };
});

// Add Full Year Summary
const all_months = Object.keys(fullReport);
const annual = {
    total_rev: 0, total_cogs: 0,
    b1: { rev: 0, opex: 0, opex_list: [], cogs: 0, net: 0 },
    b2: { rev: 0, opex: 0, opex_list: [], cogs: 0, net: 0 },
    fruit_summary: {}, daily_cogs: [], fruit_performance: []
};

all_months.forEach(m => {
    const r = fullReport[m];
    annual.total_rev += r.total_rev;
    annual.total_cogs += r.total_cogs;
    annual.b1.rev += r.b1.rev;
    annual.b1.opex += r.b1.opex;
    annual.b1.cogs += r.b1.cogs;
    annual.b1.net += r.b1.net;
    annual.b2.rev += r.b2.rev;
    annual.b2.opex += r.b2.opex;
    annual.b2.cogs += r.b2.cogs;
    annual.b2.net += r.b2.net;
    
    Object.keys(r.fruit_summary).forEach(cat => {
        annual.fruit_summary[cat] = (annual.fruit_summary[cat] || 0) + r.fruit_summary[cat];
    });
});
fullReport['all'] = annual;

fs.writeFileSync('reports_data.json', JSON.stringify(fullReport, null, 2));
console.log('Final Recalculation Complete with Proportional Stock and Annual Summary.');
