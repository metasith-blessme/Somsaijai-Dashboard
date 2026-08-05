# Somsaijai Financial Audit — Jan to 5 Aug 2026

Reconciling the dashboard Excels against two independent sources: the owner's hand-kept
Google Sheet "ส้มใส่ใจ" (Dec 25 – Mar 26, B1) and the expense slip archive.

Confirmed by owner 5 Aug 2026: opening bank balance ฿125,655.69; Apr payouts Ming ฿45,060
(10 May) and Blessme ฿50,345 (14 May); no payout for May or Jun; **B2/B3 have no slips by
design — their costs are allocated, not slip-backed.**

Run it yourself:

```bash
cd 3_Automation_Dashboard
node audit/sheet_rows.js      # self-check on the sheet parser
node audit/reconcile.js       # B1 Excel vs owner's Google Sheet, day by day
node audit/expense_gap.js     # group-level unrecorded spend + per-branch allocation check
node audit/build_statement.js # writes audit/statement.csv
```

---

## 1. Where the cash went

| | Amount |
|---|---:|
| Owner distributions Dec 25 – Apr 26 | **฿508,711** |
| Jan–Mar spend the Excel ledger never captured | **฿200,784** |

The statement closes at **฿356,304** on the books. But the Excel ledger is missing ฿200,784 of
Jan–Mar spend that your own Google Sheet records, so the realistic position is closer to
**฿155,520**. Compare that against your actual bank balance today — the remaining difference,
if any, is what still needs explaining.

### 1a. Profit was distributed at 100%, then stopped

| Month | Net profit | Blessme | Ming | Total paid | Retained |
|---|---:|---:|---:|---:|---:|
| Dec 25 | 79,935 | 47,961 | 31,974 | 79,935 | 0 |
| Jan 26 | 126,279 | 75,767 | 50,512 | 126,279 | 0 |
| Feb 26 | 142,589 | 85,553 | 57,036 | 142,589 | 0 |
| Mar 26 | 64,503 | 38,702 | 25,801 | 64,503 | 0 |
| Apr 26 | — | 50,345 *(14 May)* | 45,060 *(10 May)* | 95,405 | — |
| May 26 | — | 0 | 0 | **0** | — |
| Jun 26 | — | 0 | 0 | **0** | — |
| **Total** | | **298,329** | **210,382** | **508,711** | **0** |

Four consecutive months at exactly 100% of net margin, then an April payout, then a stop. The
business was never allowed to retain a baht of its own earnings, so every month had to fund
itself from that month's sales — no buffer for a slow week, and no capital to open B2 or B3
from retained earnings. **Stopping the May and June payouts was the correct instinct**; that
pause is the only reason there is any balance at all.

Lowest point on the statement: **฿59,411 on 2 Jan 2026**, the day the December payout went out.
About four days of B1 fruit purchasing.

### 1b. The Dec distribution is miscategorised as ice

In `B1 / Daily_Expenses`, dated 02/01/2026:

| Bucket | Category | Description | Amount |
|---|---|---|---:|
| COGS | Ice | ส่วนแบ่ง60เปอ | 47,961 |
| COGS | Ice | ค่าส่วนแบ่งกำไรเมน 40เปอ | 32,000 |

฿79,961 of owner drawings booked as cost of goods. Breaks the CLAUDE.md rule (distributions
must be `EXCLUDED` / `Profit Distribution`), understates December profit, and is why the books
blamed ice for money that went to the partners.

---

## 2. Revenue accuracy — good

Two fully independent records of B1 Jan–Mar, 90 days, only 4 disagreements:

| Day | Owner's sheet | Excel | Diff |
|---|---:|---:|---:|
| 2 Jan | 11,045 | 11,105 | +60 |
| 18 Jan | 9,280 | 9,220 | −60 |
| 25 Jan | 11,210 | 12,210 | **+1,000** |
| 27 Feb | 11,325 | 13,325 | **+2,000** |

Net overstatement **฿3,000**. The ±60 pair offsets exactly and looks like a transposition
between two days; the round 1,000 and 2,000 look like typed digits. March reconciles to the
baht. **Revenue is not where the money went.**

---

## 3. Cost side — two separate problems, often confused

Because costs are pooled and allocated (ADR 0001), a per-branch shortfall is **not** missing
money. Only the group total can reveal genuinely unrecorded spend. Separating the two:

### 3a. Bookkeeping gap: ฿200,784 (Jan–Mar, actual vs actual)

Your Google Sheet records what was really spent. The Excel ledger did not capture all of it:

| Month | Owner's sheet | Excel ledger | Shortfall |
|---|---:|---:|---:|
| Jan 26 | 148,126 | 120,780 *(excl. the ฿79,961 misfiled distribution)* | 27,346 |
| Feb 26 | 195,471 | 141,306 | 54,165 |
| Mar 26 | 222,422 | 103,148 | **119,273** |
| | | **Total** | **200,784** |

This is a bookkeeping gap, not lost cash — the money is accounted for in your sheet, it simply
never reached the dashboard. March is the worst month by far. Consequence: **the dashboard has
been overstating profit for Jan–Mar**, and the profit share paid on those months was overpaid.

From Apr onward the group total is fully recorded (Apr +74,025, May +8,669, Jun +89,478,
Jul +25,870 versus benchmark), so the recent months look healthy.

### 3b. Allocation gap: ฿442,301 sitting in the wrong branch

| Branch | Position |
|---|---:|
| B1 holds more cost than its own trade justifies | **+฿508,318** |
| B2 + B3 hold less than theirs requires | **−฿442,301** |

Shared purchases are bought centrally and booked against B1, but never allocated out. So:

- **B1's profit is understated** — it carries the whole group's fruit and packaging.
- **B2 and B3's profit is overstated** — they show revenue with barely any cost.
- Profit share was paid on those distorted figures. B2/B3 run 70/30 while B1 runs 60/40, so the
  misallocation shifted money between the partners as well as inflating the total.

This is the single highest-value fix available: run the ADR 0001 allocation across Apr–Jul and
restate. No new data is needed — the cost is already recorded, just in the wrong column.

---

## 4. Structural defects

| # | Defect | Impact |
|---|---|---|
| 1 | `Fixed_Expenses` holds placeholder data — Rent = Electricity = Water = 12,324 | Rent was really 30,000 (Jan) / 35,000 (Feb–Mar). The 12,324 is *warehouse* rent (ค่าเช่าคลัง) copied into three columns. |
| 2 | B1 and B2 `Fixed_Expenses` are byte-identical | B2's fixed costs are B1's, and wrong for B1 too. |
| 3 | `Fixed_Expenses` stops at Mar26 | Apr–Jul fixed costs absent from that table. |
| 4 | `Summary` says Jan expenses = ฿2,940 | Not derived from the ledger; contradicts `Daily_Expenses` by three orders of magnitude. |
| 5 | B2 `Mar26` contains one day of B1's March data (1 Mar, ฿10,130) | B2 opened 18 April. Phantom revenue in a month it did not trade. |
| 6 | 21 May missing from **both** B1 and B2 | A real trading day absent from both branches. |
| 7 | Jan + Feb have no daily cash/transfer split (59 days) | Recoverable — the owner's Google Sheet has all 59 days. |
| 8 | B1 `Daily_Expenses`: 36 rows "Unknown", 6 month-label mismatches, 4 zero amounts | 46 unusable rows. |
| 9 | Three different sheet layouts across months | Header on row 2 (Jan–Jun), row 1 (Jul), absent (B2 Mar26). Silently corrupts any naive reader — it corrupted the first pass of this audit. |
| 10 | Aug 1–4 not entered anywhere | Current month has no data. |

---

## 5. The statement

`audit/statement.csv` — 1,085 entries in the format of your sample, single shared account,
branch tagged per row:

```
วันที่ | สาขา | รายละเอียด | ประเภท | รายรับ | รายจ่าย | ยอดรวม
```

| | |
|---|---:|
| Opening balance (actual, 1 Jan 2026) | 125,655.69 |
| Total in | 2,568,936 |
| Total out | 2,338,288 |
| — of which owner distributions | 508,711 |
| Closing balance (on the books) | **356,304** |
| Less Jan–Mar spend missing from the ledger | −200,784 |
| **Realistic position** | **~155,520** |
| Lowest point | **59,411 on 02/01/2026** |
| Closing balance had nothing been distributed | 865,015 |

Jan–Mar payout *dates* are assumed (2nd of the following month) and marked `[วันที่ประมาณ]` in
the CSV; the amounts are from your sheet. Dec and Apr dates are confirmed.

---

## 6. Liquidity plan

**Pay the business first, the partners last.**

1. **Set a working capital floor of ฿400,000** (~one month of group-wide cash-out). No
   distribution may take the balance below it. Nothing else here matters if this is skipped.

2. **No distribution is affordable right now.** Realistic position ~฿155,520 against a
   ฿400,000 floor. Continuing the May/June pause is correct until the floor is rebuilt.

3. **Distribute quarterly, not monthly**, and only from cash above the floor:

   ```
   distributable = cash_balance − 400,000 − next_month_fixed_costs
   if distributable <= 0: no distribution
   else: split per branch profit share (B1 60/40, B2 & B3 70/30)
   ```

4. **Restate before distributing again.** Jan–Mar profit was overstated by up to ฿200,784, and
   B2/B3 profit is overstated by the ฿442,301 allocation gap. Offset the resulting overpayment
   against future distributions rather than requesting repayment.

5. **Fix the allocation, not the slips.** Since B2/B3 costs are allocated by design, the fix is
   to run ADR 0001 across Apr–Jul — not to hunt for slips that were never meant to exist.

---

## 7. Still open

- **Actual bank balance today** — compare against the ~฿155,520 realistic figure. Any remaining
  difference is the part still unexplained.
- **Jan–Mar payout dates** — amounts are confirmed, dates assumed. Only affects the shape of the
  running balance, not the totals.
- **Apr–Jul expenses in the owner's sheet** — the sheet stops at March. If it was kept past
  then, it would let the Apr–Jul ledger be verified the same actual-vs-actual way.
