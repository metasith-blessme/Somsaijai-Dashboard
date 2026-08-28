// parseNote must keep the WHOLE memo, not just its first line.
//
// The orange supplier writes quantity on lines 2-3 of the memo. A `.`-based capture kept
// only line 1 and dropped them, which is how ฿194,201 of orange (44% of spend) ended up
// with no quantity recorded. These cases are taken verbatim from real K PLUS slips.
const assert = require('assert');
const { parseNote } = require('./Sales_System_Automation/process_expenses.js');

const slip = (memo) => [
    'โอนเงินสำเร็จ', '17 มิ.ย. 69  14:39 น.',
    'นาย เมธาสิทธิ์ จ', 'ธ.กสิกรไทย', 'xxx-x-x6560-x',
    'นาย ชัยวัฒน์ เศวตโชติ', 'ธ.กรุงเทพ', 'xxx-x-x2813-x',
    'เลขที่รายการ:', '016168143935BOR03555',
    'จำนวน:', '16,445.00 บาท',
    'ค่าธรรมเนียม:', '0.00 บาท',
    'บันทึกช่วยจำ: ' + memo,
    '',
    'ผู้รับเงินสามารถสแกนคิวอาร์โค้ดนี้เพื่อ', 'ตรวจสอบสถานะการโอนเงิน',
].join('\n');

// 1. the case that was silently truncated — all three lines must survive
const orange = parseNote(slip('รอบ 09/06/69\nส้ม 23x22กก  506กกx30  15,180บาท\nค่าขนส่ง 23ตะกร้า x 55  1265'));
assert.ok(orange.includes('รอบ 09/06/69'), 'lost the round date');
assert.ok(orange.includes('23x22กก'), 'lost the crate count — this is the bug');
assert.ok(orange.includes('506กกx30'), 'lost the kilos and unit price');
assert.ok(orange.includes('ค่าขนส่ง'), 'lost the freight line');

// 2. a plain one-line memo still works
assert.strictEqual(parseNote(slip('ฝรั่ง 1 ตะกร้า')), 'ฝรั่ง 1 ตะกร้า');

// 3. the footer must not be swallowed into the note
assert.ok(!parseNote(slip('มังคุด 3 ตะกร้า')).includes('ผู้รับเงิน'), 'footer leaked into the note');

// 4. no memo at all
assert.strictEqual(parseNote('โอนเงินสำเร็จ\nจำนวน: 500.00 บาท'), 'Unknown');

// 5. quantity must be parseable out of the result — the whole point of keeping it
const m = orange.match(/(\d+)\s*[xX×]\s*(\d+)\s*กก/);
assert.ok(m && +m[1] * +m[2] === 506, `expected 23x22 = 506 kg, got ${orange}`);

console.log('✅ parseNote OK — multi-line memos keep their quantity lines');
