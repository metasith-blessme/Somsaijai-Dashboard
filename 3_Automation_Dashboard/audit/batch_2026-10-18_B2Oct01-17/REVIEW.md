# B2 sales 1–17 Oct 2026: review (NOT published)

**To publish: 17 days, ฿63,924** (cash 41,158 + QR 22,766). Ice 1,110 goes under Expenses.
Built from Parn's 17 photos on 2026-10-18. Nothing is committed or pushed.

**How ice is handled:** cash and revenue are booked **before ice**, with ice under Expenses. This is how B1 Oct was done.
On 8 days (1–6, 8 and 10 Oct), staff took the ice off the written cash and grand totals. I added it back for those days.
That's why the total is ฿510 more than the grand totals written on the sheets (63,414).

| Date | Cash | QR | Grand to publish | Ice | Sheet grand | Item-sum check |
|---|---:|---:|---:|---:|---:|---|
| 01 Oct (Thu) | 1,890 | 809 | 2,699 | 60 | 2,639 (after ice) | OK |
| 02 Oct (Fri) | 2,090 | 1,274 | 3,364 | 60 | 3,304 (after ice) | QR items +60 |
| 03 Oct (Sat) | 2,699 | 1,605 | 4,304 | 60 | 4,244 (after ice) | OK |
| 04 Oct (Sun) | 2,263 | 1,345 | 3,608 | 60 | 3,548 (after ice) | cash items -10 |
| 05 Oct (Mon) | 1,890 | 885 | 2,775 | 60 | 2,715 (after ice) | OK |
| 06 Oct (Tue) | 1,529 | 705 | 2,234 | 60 | 2,174 (after ice) | OK |
| 07 Oct (Wed) | 1,525 | 1,080 | 2,605 | 60 | 2,605 | OK |
| 08 Oct (Thu) | 1,115 | 965 | 2,080 | 60 | 2,020 (after ice) | OK |
| 09 Oct (Fri) | 2,730 | 470 | 3,200 | 60 | 3,200 | OK |
| 10 Oct (Sat) | 4,759 | 2,305 | 7,064 | 90 | 6,974 (after ice) | OK |
| 11 Oct (Sun) | 4,625 | 1,380 | 6,005 | 60 | 6,005 | OK |
| 12 Oct (Mon) | 4,050 | 2,210 | 6,260 | 120 | 6,260 | OK |
| 13 Oct (Tue) | 1,984 | 2,035 | 4,019 | 60 | 4,019 | OK |
| 14 Oct (Wed) | 1,690 | 795 | 2,485 | 60 | 2,485 | OK |
| 15 Oct (Thu) | 1,937 | 1,693 | 3,630 | 60 | 3,630 | OK |
| 16 Oct (Fri) | 2,743 | 1,315 | 4,058 | 60 | 4,058 | OK |
| 17 Oct (Sat) | 1,639 | 1,895 | 3,534 | 60 | 3,534 | OK |
| **Total** | **41,158** | **22,766** | **63,924** | **1,110** | **63,414** | |

## Needs Parn's call

1. **Ice basis.** OK to publish before ice (63,924), the same as B1? Publishing the written after-ice totals would give 63,414, but then ice would be counted twice once it's also under Expenses.
2. **2 Oct mango QR.** There are 2 tallies (and Total Qty is 3), but 120 is written, not 180. I booked the written QR of 1,274; the items add up to 1,334 (+60).
3. **4 Oct cash.** Items add up to 2,253, but 2,263 is written (−10). I used the written figure. Also, "Guava – cash – 129 – ||" is in the Other (expense) box. I read it as **2 Volcano Guava sales**, not an expense, and that fits the cash total.
4. **13 Oct.** The sheet says B-1, but Parn confirmed it's B2, so it's booked as B2.
5. **Small reads (no money impact):** On 6 Oct, the apple cash mark was scribbled out, so I read it as 0. On 10 Oct, there are only tallies; the orange and watermelon cash/QR split comes from the tallies and fits both totals exactly.

## How items are booked (same as B1)
- Volcano Guava (129) → Guava. Apple no ice (120) → Apple. Orange 120 (no ice) → Orange, and also Orange (100).
- Grape (80/120), Pear (60) and Pomegranate (150) count only in Total Cups; each row's Source Note lists them.

## Repo check (origin/main 0594016)
- The B2 workbook's `Oct26` sheet exists, but it has **0 data rows** and still uses the old 18-column layout. `data.json` has no B2 Oct26 yet. **Nothing will be overwritten.**
- Dry runs pass: the prep step reports 18 → 32 columns (Sep26 layout), and safe_import reports "B2/Oct26: +17 days ฿63,924".
- FYI: B2 Sep26 was booked using the after-ice cash on several days (e.g. 13, 17, 28 Sep), so ice is counted twice there. That's not in this change.

## Files (all in /workspace/b2oct)
- `sheets.json`: transcription. `build.js` builds `b2_oct26_sales_change_list.json` and `review_body.md`, which has the per-day item detail.
- `prep_b2_oct26_sheet.js`: moves Oct26 to the Sep26 layout. It stops if any B2 Oct row already exists.
- `publish_b2_oct.sh`: **not run.** On its own it builds and verifies in a fresh worktree. With `--push` it commits, pushes to main and reads back the live data (17 rows / 63,924).
- Photos are saved as `B2/1_Sale/Oct26/B2_Daily_Sales_DD-10-2026.jpg`. Audit files go in `3_Automation_Dashboard/audit/batch_2026-10-18_B2Oct01-17/`: sheets.json, build.js, prep script, change list, and this file as REVIEW.md.
