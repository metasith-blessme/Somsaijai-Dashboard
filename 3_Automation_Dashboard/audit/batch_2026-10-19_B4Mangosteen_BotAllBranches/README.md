# B4 Mangosteen column + LINE bot knows all branches (approved by Parn, 19/10/2026)

## 1. B4 Mangosteen column
- B4 Sep26–Dec26 get two new columns after Pineapple: `Mangosteen` (cups) and `Mangosteen (฿)`. Applied by `add_b4_mangosteen.js`.
- **Sep26:** the mangosteen cups had been booked inside **Mango**. They were moved out of Mango into Mangosteen: 34 cups, ฿4,386 at 129. Mango went from 40 to 6.
- **Oct26:** the mangosteen cups were counted only in Total Cups. They are now in Mangosteen: 75 cups, ฿9,726 (129 each, or 180 for no-ice). Mango is unchanged.
- **Unchanged:** revenue, cash, scan, expenses and Total Cups. Sep stays ฿12,435 (143 cups) and Oct stays ฿43,100 (492 cups).
- **Workbook check:** cell by cell, the only changes are the two new columns and nine Sep26 Mango cells.
- **Not changed (flag):** B4 Sep26 also has pineapple cups booked inside Apple, for example 27/09 Apple 4 when the sheet shows Pineapple 4. This is left as is until Parn decides.
- `update_dashboard.js` writes `mangosteen_rev` only for rows on sheets that have a `Mangosteen (฿)` column.
- `safe_import_sales.js` accepts `mangosteen_rev`. The bot's photo import already maps mangosteen to `mangosteen`, which now has a column on B4.

## 2. LINE bot
- **Why it failed before:**
  - The owner's sales note covered only the **last 14 days** and only **B1–B3**, with date, revenue, cash and scan.
  - On 17 Oct, before the Oct publishes, that window held one B3 day and nothing for B1 or B2. September was always outside the window, and B4 was never included. So the bot correctly said it did not have the figures.
  - This is a code-path diagnosis. Vercel Hobby keeps runtime logs for only 1 hour, so there are no logs from earlier.
- **The note now:**
  - Still comes from the same live `data.json` as the dashboard, so it stays current after each publish.
  - Covers every published day for every branch: all-branch month totals, branch month totals (days, revenue, cash, scan, shift expenses), cups by fruit (plus mangosteen revenue), booked expenses by bucket and category (no descriptions), and one compact daily line per branch-month.
  - Is about 23k characters. If it gets too long, the oldest daily lines are dropped first; month totals are always kept.
- **Rules kept:**
  - Sales numbers only in Parn's 1:1 chat. Staff get no sales note and no data fetch.
  - Menu, price and recipe questions get "ask Parn".
  - Replies stay to 1–3 short sentences.
- **Photo flow:**
  - Branch codes B-4, B-04, B4 and "สาขา 4" are read as B4. "B-5" is read as B4 (Parn: B4 staff write B-5).
  - B4 opened on 19/09/2026.
  - The group config accepts `:B4`.
  - The bot's commit now includes the B4 workbook.
- **Tests:** `npm test` passes (5 + 104).
- **Live MiniMax check:** `ai_test.js` passed 8 of 8:
  - B4 Oct mangosteen = 75 cups / ฿9,726
  - B3 Oct = ฿97,420
  - B1 Sep = ฿135,223
  - All branches Oct = ฿314,915
  - B2 12 Oct = ฿6,260
  - B4 Sep = ฿12,435
  - Two staff questions got no numbers.
