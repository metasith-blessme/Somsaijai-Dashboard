/**
 * Human reading of the 16 Oct 2026 photos. This is not a Gemini result.
 * A blank or an unstable digit is null. Nothing here was filled in to make a total balance.
 */

function observed(value, raw) {
  return { raw: raw == null ? String(value) : String(raw), value, state: 'observed' };
}
function unclear(raw, alternatives) {
  return { raw, value: null, state: 'ambiguous', alternatives: alternatives || [] };
}
function unread() {
  return { raw: null, value: null, state: 'illegible' };
}
function missing() {
  return { raw: null, value: null, state: 'missing' };
}

const shopMenu = [
  ['Orange Cup (Regular)', 90],
  ['Orange Premium Cup (100%)', 120],
  ['Watermelon Cup', 55],
  ['Mango Cup', 90],
  ['Coconut Cup', 60],
  ['Apple Cup', 60],
  ['Guava Cup', 75],
  ['Pineapple Cup', 75],
  ['Mangosteen Blended', 129],
  ['Mangosteen Lychee Blended', 129],
  ['Rambutan Blended', 129],
  ['Volcano Mix Fruit', 150],
  ['Volcano Orange', 129],
  ['Volcano Watermelon', 129],
  ['Volcano Mango', 129],
  ['Volcano Apple', 129],
  ['Volcano Guava', 129],
  ['Volcano Pineapple', 129],
  ['Mango Sticky Rice', null],
].map(([item_raw, price_raw]) => ({
  item_raw,
  price_raw,
  cash_qty: unread(),
  scan_qty: unread(),
  qty_raw: null,
  qty_value: null,
  qty_state: 'illegible',
  amount_raw: null,
  amount_value: null,
  uncertain: true,
}));

const shop = {
  file: 'shop_report_tae_16oct.png',
  extraction: {
    document_type: 'sales_report',
    form_template: 'daily_shop_report',
    title_raw: 'SOMSAIJAI DAILY SHOP REPORT',
    orientation: 'rotated',
    image_quality: 'rotated',
    header: { date_raw: '16/10/2026', branch_raw: null, staff_raw: [], shift_raw: null, open_raw: null, close_raw: null },
    sales: {
      cash_sales: unread(),
      scan_sales: unread(),
      total_sales: unread(),
      total_expense: unread(),
      net_sales: unread(),
      opening_cash: unread(),
      counted_cash: unread(),
      expected_cash: unread(),
      total_cups: missing(),
    },
    other: { ice: missing(), other: missing() },
    notes: [],
    menu_rows: shopMenu,
    handwritten_additions: [],
    shift_expenses: [],
    uncertainties: [
      'photo is rotated 90 degrees',
      'staff names on the shift box were not legible',
      'no branch code is printed on this form',
      'opening cash was not stable across zooms, so it was not recorded',
      'tally marks and the sales THB column were not stable enough to record',
      'shift expense cash and scan were not stable enough to record',
    ],
  },
};

function b1Row(item, price, qty, uncertain) {
  return {
    item_raw: item,
    price_raw: price,
    qty_raw: qty == null ? null : String(qty),
    qty_value: qty,
    qty_state: qty == null ? 'missing' : 'observed',
    uncertain: !!uncertain,
    cash_qty: unread(),
    scan_qty: unread(),
    amount_raw: null,
    amount_value: null,
  };
}

const b1 = {
  file: 'sales_record_b1_16oct.png',
  extraction: {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    title_raw: 'SOM SAI JAI Daily Sales Record',
    orientation: 'upright',
    header: { date_raw: '16/10/26', branch_raw: 'B-1', staff_raw: [], shift_raw: null },
    sales: {
      cash_sales: unclear('1964+1', [1964, 1965]),
      scan_sales: observed(1125),
      total_sales: unclear('3089 / 3090', [3089, 3090]),
      total_expense: missing(),
      net_sales: missing(),
      opening_cash: missing(),
      counted_cash: missing(),
      expected_cash: missing(),
      total_cups: missing(),
    },
    other: { ice: observed(120), other: missing() },
    notes: [],
    menu_rows: [
      b1Row('Orange', 80, 8, true),
      b1Row('Watermelon', 55, 10, false),
      b1Row('Apple', 60, 7, false),
      b1Row('Mango', 90, 2, true),
      b1Row('Coconut', 60, 3, false),
      b1Row('Pineapple', 75, null, false),
      {
        ...b1Row('Guava', 65, 15, true),
        price_overridden_from: 65,
        price_overridden_to: 80,
      },
      b1Row('Mangosteen', 129, 1, true),
      b1Row('Mangosteen & Lychee', 129, 1, true),
      b1Row('Rambutan', 129, 1, true),
    ],
    handwritten_additions: [
      { item_raw: 'Grape', price_raw: 80, qty_state: 'missing', struck: true, uncertain: true },
      { item_raw: 'Pomegranate', price_raw: 150, qty_state: 'missing', uncertain: true },
    ],
    uncertainties: [
      'cash total has an extra mark after 1964',
      'grand total is written both as 3089 and 3090',
      'tally strokes were not used as cup counts where they disagreed with the written total qty',
      'Guava printed price 65 is crossed out and 80 is written',
      'Pomegranate 150 is handwritten; its quantity is only a dash',
      'a Grape 80 note is crossed out',
    ],
  },
};

function b2Row(item, price, cash, scan) {
  return {
    item_raw: item,
    price_raw: price,
    cash_qty: cash == null ? missing() : observed(cash, `(${cash})`),
    scan_qty: scan == null ? missing() : observed(scan, `(${scan})`),
    qty_raw: null,
    qty_value: null,
    qty_state: 'missing',
    amount_raw: null,
    amount_value: null,
    uncertain: false,
  };
}

const b2 = {
  file: 'sales_record_b2_16oct.png',
  extraction: {
    document_type: 'sales_report',
    form_template: 'daily_sales_record',
    title_raw: 'SOM SAI JAI Daily Sales Record',
    orientation: 'upright',
    header: { date_raw: '16/10/26', branch_raw: 'B-2', staff_raw: [], shift_raw: null },
    sales: {
      cash_sales: observed(2143),
      scan_sales: observed(1315),
      total_sales: unclear('3458 or 4058', [3458, 4058]),
      total_expense: missing(),
      net_sales: missing(),
      opening_cash: missing(),
      counted_cash: missing(),
      expected_cash: missing(),
      total_cups: missing(),
    },
    other: { ice: observed(60), other: missing() },
    notes: ['2743 - 60 = 2683'],
    menu_rows: [
      b2Row('Orange', 80, 6, 2),
      b2Row('Watermelon', 55, 15, 5),
      b2Row('Apple', 60, 2, 0),
      b2Row('Mango', 90, 5, 2),
      b2Row('Coconut', 60, 3, 7),
      b2Row('Pineapple', 75, null, null),
      b2Row('Guava', 65, 2, 2),
      b2Row('Mangosteen', 129, 2, 0),
      b2Row('Mangosteen & Lychee', 129, 2, 1),
      b2Row('Rambutan', 129, null, null),
    ],
    handwritten_additions: [],
    uncertainties: [
      'Total Qty column was not stable enough to record; on this form that column holds baht, so those digits were not copied into cup counts',
      'grand total was read as 3458 in a zoom of the payment box and as 4058 on a full-frame look',
      '2143 + 1315 = 3458, which is why 3458 is one of the two readings',
      'the note 2743 - 60 = 2683 is written on the page; 2743 is not the cash total 2143',
    ],
  },
};

module.exports = { shop, b1, b2 };
