const test = require('node:test');
const assert = require('node:assert');
const { KEYWORDS } = require('../lib/adapter');
const cats = memo => [...new Set(KEYWORDS.filter(k => k.test.test(memo)).map(k => k.cat))];

// B4 Sep 2026: pineapple was booked as Apple and mangosteen as Mango by plain substring matches.
test('pineapple expense is Pineapple only, not Apple', () => {
  assert.deepStrictEqual(cats('pineapple 5kg'), ['Pineapple']);
  assert.deepStrictEqual(cats('Pineapple'), ['Pineapple']);
  assert.deepStrictEqual(cats('apple 10kg'), ['Apple']);
});
test('mangosteen expense is never booked as Mango', () => {
  assert.ok(!cats('mangosteen 3kg').includes('Mango'));
  assert.deepStrictEqual(cats('mango 2kg'), ['Mango']);
  assert.deepStrictEqual(cats('มะม่วง'), ['Mango']);
});

// Parn 20/10/2026: book the fruit staff wrote, never a crossed-out printed label.
test('a crossed-out printed label keeps the written fruit and is held for review', () => {
  const { handwritingFlags } = require('../lib/forms');
  const flags = handwritingFlags({ item_raw: 'Volcano Water', label_crossed_out: 'Coconut', struck: false });
  assert.ok(flags.some(f => f.kind === 'label_shift' && /Coconut/.test(f.text)));
  assert.deepStrictEqual(handwritingFlags({ item_raw: 'Pineapple' }), []);
});
