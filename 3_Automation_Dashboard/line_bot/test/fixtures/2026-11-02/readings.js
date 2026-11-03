/**
 * Human reading of the B1 Daily Shop Report for 2 Nov 2026 (staff Myat Chang, shift B-1).
 * This is not a Gemini result. Blank rows are null. Two printed prices are overwritten
 * by hand (Orange Premium 120 to 100, Volcano Watermelon 129 to 109), and one row is
 * written in under the table: "Pome (75) - 1 (Cash) 1 75".
 * Closing box as written: Net cash 2806, Ice 60, Scan 1650, Total 4516, Changes 1500.
 */

function observed(value) {
  return { raw: String(value), value, state: 'observed' };
}
function missing() {
  return { raw: null, value: null, state: 'missing' };
}

function row(item_raw, price_raw, cash, scan, qty, amount, extra = {}) {
  return {
    item_raw,
    price_raw,
    cash_qty: cash == null ? missing() : observed(cash),
    scan_qty: scan == null ? missing() : observed(scan),
    qty_raw: qty == null ? null : String(qty),
    qty_value: qty,
    qty_state: qty == null ? 'missing' : 'observed',
    amount_raw: amount == null ? null : String(amount),
    amount_value: amount,
    uncertain: false,
    ...extra,
  };
}

const menu_rows = [
  row('Orange Cup (Regular) [or]', 60, 6, 10, 16, 960),
  row('Orange Premium Cup 100% [pc_100]', 120, 1, null, 1, 100, { price_overridden_from: 120, price_overridden_to: 100 }),
  row('Watermelon Cup [wm]', 55, 11, 8, 19, 1045),
  row('Mango Cup [ma]', 90, null, null, null, null),
  row('Coconut Cup [co]', 60, 7, 2, 9, 540),
  row('Apple Cup [ap]', 60, 3, 1, 4, 240),
  row('Guava Cup [guava]', 65, 6, 2, 8, 520),
  row('Pomegranate Cup [pomegranate]', 150, 2, 2, 4, 600),
  row('Mangosteen Blended [se] [mangosteen]', 129, null, null, null, null),
  row('Rambutan Blended [rab] [rambutan]', 129, null, null, null, null),
  row('Lychee Blended [lychee] [litchi_lychee]', 129, null, null, null, null),
  row('Pear Cup [pear]', 60, null, null, null, null),
  row('Volcano Orange [volcano_orange]', 129, null, null, null, null),
  row('Volcano Watermelon [volcano_watermelon]', 129, 4, null, 4, 436, { price_overridden_from: 129, price_overridden_to: 109 }),
  row('Volcano Mango [volcano_mango]', 150, null, null, null, null),
  row('Volcano Apple [volcano_apple]', 129, null, null, null, null),
  row('Volcano Guava [volcano_guava]', 129, null, null, null, null),
  row('Grape Cup [grape]', 80, null, null, null, null),
  row('Mango Sticky Rice [mango_sticky_rice]', 99, null, null, null, null),
];

const pome = row('Pome (75)', 75, 1, null, 1, 75);

const b1 = {
  file: 'shop_report_b1_2nov.jpg',
  extraction: {
    document_type: 'sales_report',
    form_template: 'daily_shop_report',
    title_raw: 'SOMSAIJAI DAILY SHOP REPORT',
    orientation: 'upright',
    header: { date_raw: '2.11.2026', branch_raw: 'B-1', staff_raw: ['Myat Chang'], shift_raw: 'B-1', open_raw: '3.30PM', close_raw: '12AM' },
    sales: {
      cash_sales: observed(2806),
      scan_sales: observed(1650),
      total_sales: observed(4516),
      total_expense: missing(),
      net_sales: missing(),
      opening_cash: observed(1500),
      counted_cash: missing(),
      expected_cash: missing(),
      total_cups: missing(),
    },
    other: { ice: observed(60), other: missing() },
    notes: [],
    menu_rows,
    handwritten_additions: [pome],
    uncertainties: [],
  },
};

module.exports = { b1, pome };
