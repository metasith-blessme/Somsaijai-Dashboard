# Used fruit columns + B1 Sep fruit mix-up (approved by Parn, 20/10/2026)

Parn: "back to use real data if it says pineapple book pineapple, if they writ additional. i need used fruit data".
Revenue, cash, QR, expenses and Total Cups do not change for any branch or month.

## B4 Sep26 Used columns (19 cells, `../batch_2026-10-20_B4SepPineapple/fix_b4_sep_fruit.js --used`)
Used = cups, as on every other row. Used Mango no longer counts mangosteen (20-30/09); Used Apple -> Used Pineapple
(25, 27, 28, 29/09); 30/09 Used Coco (Raw) 5 -> 0 and Used Watermelon 9 -> 14.

## B1 Sep26 (84 cells: cups + Used, `fix_b1_sep_fruit.js`)
Source `../batch_2026-10-01_SepSalesExpenses/b1_sales_transcription.json` (B1 Sep photos), matched to each row by Source Note.
`commit_sep26.js` checked "apple" before "pineapple" and booked "Water" (55) and "Volcano water" (109) as Coconut.
Month: Apple 223 -> 149, Pineapple 0 -> 74, Coconut 371 -> 281, Watermelon 622 -> 712. The script replays the old mapping
and stops unless every current cell came from it.

## Other branches checked
B2 Sep26, B3 Sep26: cups match the sheets (code-based mapping). Oct26 (all branches) was imported with exact written labels.

## Cost effect (Sep26 fruit COGS split by usage), vs 5e5c777
B1 +2,165, B2 +54, B3 -631, B4 -1,588. Oct26 carry-forward losses move for B2 and B4.

## Mapping fixes
- `commit_sep26.js`: one `sheetFruit()` for B1/B4: pineapple and mangosteen before apple/mango, Water/Volcano water = watermelon,
  Volcano X = X. (One-off writer, marked do-not-re-run.)
- LINE bot: a crossed-out printed label with a written fruit keeps the written fruit and its sales (`label_crossed_out`),
  and the day is flagged for review. Prompt version line-bot-ocr-4.

## Open (not changed)
- Oct26 Used columns are empty on all branches, so Oct fruit cost is split by revenue, not usage.
- B1 Sep: 27 handwritten "volcano water" cups (26-29/09) are in revenue but not in any cup column or Total Cups.
- B1 Sep: two rows dated 23/09 (photos _8 and _9, _9 probably 22/09); no 22/09 row.
- Mangosteen/rambutan cups on B1-B3 have no column (B3 Sep: Mangosteen 117, Rambutan 17), so they are not in fruit usage.
