const qa = require('/workspace/ssj-mang/3_Automation_Dashboard/line_bot/lib/qa');
const data = require('/workspace/ssj-mang/3_Automation_Dashboard/data.json');
const now = Date.parse('2026-10-19T17:30:00+07:00');
const note = qa.compactSales(data, { now });
const cases = [
  [true, 'B4 mangosteen in October?', /75/],
  [true, 'B3 October revenue', /97,?420/],
  [true, 'B1 September total', /135,?223/],
  [true, 'all branches revenue this month', /314,?915/],
  [true, 'B2 12 Oct', /6,?260/],
  [true, 'ยอดขาย B4 เดือนกันยายน', /12,?435/],
  [false, 'How much did B4 sell yesterday?', null],
  [false, 'what is B4? where I send B4 report photo?', null],
];
(async () => {
  for (const [owner, q, want] of cases) {
    const messages = qa.buildChatMessages({ owner, question: q, salesContext: owner ? note : null });
    let a;
    try { a = await qa.askMinimax({ apiKey: process.env.MINIMAX_API_KEY, model: 'MiniMax-M2', messages, timeoutMs: 60000 }); }
    catch (e) { a = 'ERROR ' + e.message; }
    const ok = owner ? want.test(a) : !/\d{3,}|฿/.test(a);
    console.log(`${ok ? 'PASS' : 'FAIL'} [${owner ? 'owner' : 'staff'}] ${q}\n   -> ${a.replace(/\n/g, ' ')}`);
  }
})();
