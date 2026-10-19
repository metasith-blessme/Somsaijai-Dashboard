# B4 Sep 2026: fruit-column fix (approved by Parn, 20/10/2026)

Source: original sheets in `B4/sale/Sep26/` (LINE album, photos _1 to _11). Every Sep day was checked.
Revenue, cash, QR, expenses and Total Cups do not change (Sep stays ฿12,435, 143 cups).

| Day | Cell | Was | Now | Sheet |
|---|---|---|---|---|
| 25/09 | M9 Apple / P9 Pineapple | 2 / 0 | 0 / 2 | Pineapple 1 cash + 1 scan |
| 27/09 | M10 Apple / P10 Pineapple | 4 / 0 | 0 / 4 | Pineapple 2 cash + 2 scan |
| 28/09 | M11 Apple / P11 Pineapple | 1 / 0 | 0 / 1 | Pineapple 1 scan |
| 29/09 | M12 Apple / P12 Pineapple / K12 Mango | 4 / 0 / 0 | 0 / 3 / 1 | Pineapple 2 cash + 1 scan; Mango 1 scan (QR 797 = 2x80 + 2x50 + 90 + 60 + 3x129) |
| 30/09 | L13 Coconut / J13 Watermelon | 5 / 9 | 0 / 14 | "Coconut" crossed out, written "Volcano Water(melon)" 109: 3 cash + 2 scan |

19-23/09 were already correct.
Sep totals: apple 16 -> 5, pineapple 0 -> 10, mango 6 -> 7, coconut 5 -> 0, watermelon 49 -> 54.

## Cause
`get_fruit_category` in `audit/batch_2026-10-01_SepSalesExpenses/consolidate_audit.py` (Sep onboarding import) used plain
substring checks with "mango" before "mangosteen" and "apple" before "pineapple", so pineapple went to Apple and
mangosteen to Mango. Fixed: longer names are checked first, and "Volcano Water" maps to Watermelon.
The LINE bot's expense keywords (`line_bot/lib/adapter.js`) had the same pattern; now `(?<!pine)apple` and
`mango(?!steen)`, tested in `line_bot/test/fruit_keywords.test.js`. The bot's sales-form mapping was already correct.

## Not changed (needs Parn's decision)
The Used-* columns (W-AE) still hold the old split (Used Mango includes mangosteen, Used Apple includes pineapple,
30/09 Used Coco (Raw) 5). These drive the shared fruit COGS split across branches, so fixing them changes Sep profit
and profit shares for B1-B4 (and Oct carry-forwards for B2/B4). Preview: `fix_b4_sep_fruit.js` `ALL` list (30 cells).
