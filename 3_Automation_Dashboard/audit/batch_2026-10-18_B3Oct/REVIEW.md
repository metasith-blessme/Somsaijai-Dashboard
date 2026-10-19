# B3 sales Oct 2026 (Daily Shop Report): review (NOT published)

**Ready to publish: 13 days, ฿84,481** (1–9, 11, 13, 15, 16 Oct). Expenses come to 1,385.
14 Oct is already live (6,821). It matches the photo exactly and will not be touched.
The two "12 Oct" sheets are held back until Parn decides (issue 1).
Built from Parn's 16 photos on 2026-10-18. Nothing is committed or pushed.

**How it's booked (same as B3 Sep and the live 14 Oct):**
- Revenue is Total sales, before expenses.
- Cash and Scan come from the Closing summary.
- Expenses are the Total expense figure. That includes non-ice items, as Sep did with Falcon and Delivery.
- Volcano X counts under the X fruit column.
- Orange Premium goes in Orange (100).
- Blended drinks, Volcano Mix, sticky rice, Pear, Grape, Pomegranate and cold-pressed juice count only in Total Cups, and each row's note lists them.

| Date | Cash | Scan | Total sales (publish) | Expenses | Item sum vs total | Status |
|---|---:|---:|---:|---:|---|---|
| 01 Oct (Thu) | 3,654 | 932 | 4,586 | 55 | OK | in change list |
| 02 Oct (Fri) | 4,851 | 1,935 | 6,786 | 110 | +90 | in change list |
| 03 Oct (Sat) | 3,899 | 2,724 | 6,623 | 55 | OK | in change list |
| 04 Oct (Sun) | 6,269 | 3,314 | 9,583 | 254 (Ice 110 + Condensed Milk 144) | +177 | in change list |
| 05 Oct (Mon) | 3,083 | 1,765 | 4,848 | 251 (Ice 55 + Meiji Milk 72 + Falcon 124) | -1 | in change list |
| 06 Oct (Tue) | 3,023 | 1,257 | 4,280 | 110 | OK | in change list |
| 07 Oct (Wed) | 3,407 | 1,330 | 4,737 | 55 | OK | in change list |
| 08 Oct (Thu) | 4,377 | 2,192 | 6,569 | 55 | -49 | in change list |
| 09 Oct (Fri) | 6,973 | 2,410 | 9,383 | 110 | -68 | in change list |
| 11 Oct (Sun) | 4,290 | 2,584 | 6,874 | 55 | -85 | in change list |
| "12" Oct sheet A (Tae/Tun Kyaw) | 3,475 | 2,441 | 5,916 | 110 | -50 | **HOLD: Parn to decide** |
| 12 Oct sheet B (Arkar/Tae/Kyaw) | 4,581 | 1,537 | 6,118 | 110 | OK | **HOLD: Parn to decide** |
| 13 Oct (Tue) | 5,531 | 3,342 | 8,873 | 110 | +1 | in change list |
| 14 Oct (Wed) | 5,361 | 1,460 | 6,821 | 55 | OK | already live, no change |
| 15 Oct (Thu) | 4,202 | 1,465 | 5,667 | 110 | -3 | in change list |
| 16 Oct (Fri) | 4,328 | 1,344 | 5,672 | 55 | -55 | in change list |

## Needs Parn's call
1. **Two "12 Oct" sheets.**
   - Sheet A says "1?.10.2026", but the day digit is written exactly like the month's "10", so it reads more like **10 Oct**, which is missing.
   - Sheet B clearly says 12.10.26.
   - Options:
     - (a) A = 10 Oct, B = 12 Oct: +12,034, total **96,515**.
     - (b) B only as 12 Oct: total 90,599.
     - (c) Both as two shifts of 12 Oct: total 96,515.
     - (d) Hold both: total 84,481.
2. **Item sums vs written totals.** I used the written totals.
   - 4 Oct: items are 177 higher. Scan matches exactly, so the gap is all in cash.
   - 2 Oct: items are 90 higher. Scan matches exactly, so again the gap is in cash.
   - Smaller gaps where items come out lower: 11 Oct −85, 9 Oct −68, 16 Oct −55, 12A −50, 8 Oct −49.
   - On 16 Oct the items add up to exactly the written *net* (5,617), not the total.
3. **Your first read vs the sheets.**
   - 9 Oct is cash **6,973** / total **9,383** (not 6,873 / 9,283). Its net of 9,273 is correct.
   - 11 Oct net is written as 6,824, but it should be 6,819. Publishing doesn't use the net.
4. **Missing days:** 10 Oct (unless it's sheet A) and 17 Oct.
5. **Small reads:**
   - 4 Oct sticky rice "5 / 1" is read as 5 × 99 + 1 × 180, and Pomegranate (4) is assumed to be 150.
   - 13 Oct has a row "apple & pear" at 60 × 8, counted as extra cups only.
   - 12A has Pear at 80 (other days it's 60).
   - 4 Oct and 13 Oct have no Sales THB column filled in, so I used qty × price.

## Repo check (origin/main 687c636)
- The B3 workbook's `Oct26` sheet is already on the Sep26 layout. It has **only** the 14/10 row (6,821 / 5,361 / 1,460 / 55, no cups), and `data.json` matches.
- Nothing will be overwritten. The publish script stops if Oct26 has changed, and it checks that 14/10 stays identical.
- Dry-run import: "B3/Oct26: +13 days ฿84,481".
- Optional, not in the plan: the photo has the cups for 14 Oct (88 total). Adding them would mean editing the live row, so I'd only do it if Parn asks.

## Files (in /workspace/b3oct)
- `sheets.json`: transcription of all 16 sheets.
- `build.js`: builds `b3_oct26_sales_change_list.json`. Run it with `--day12=hold|A10_B12|B12|both12`.
- `publish_b3_oct.sh --day12=<choice> [--push]`: **not run.**
  - Photos go to `B3/1_Sale/Oct26/B3_Daily_Shop_Report_DD-10-2026.jpg`.
  - Audit files go to `3_Automation_Dashboard/audit/batch_2026-10-18_B3Oct/`.
  - It checks the live dashboard afterwards.
