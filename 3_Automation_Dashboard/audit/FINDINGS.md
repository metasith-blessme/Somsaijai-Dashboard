# Somsaijai Financial Audit — Jan to 5 Aug 2026

Reconciling the dashboard Excels against two independent sources: the owner's hand-kept
Google Sheet "ส้มใส่ใจ" (Dec 25 – Mar 26, B1) and the expense slip archive.

Run it yourself:

```bash
cd 3_Automation_Dashboard
node audit/sheet_rows.js      # self-check on the sheet parser
node audit/reconcile.js       # B1 Excel vs owner's Google Sheet, day by day
node audit/expense_gap.js     # sizes the unrecorded-spend hole per branch/month
node audit/build_statement.js # writes audit/statement.csv
```

---

## 1. Where the cash went

Two leaks, and together they account for the empty account.

| | Amount |
|---|---:|
| Owner distributions paid out Dec 25 – Mar 26 | **฿413,306** |
| Estimated spend that left the account with no slip in the ledger | **฿442,301** |
| **Combined** | **฿855,607** |

The statement's closing balance on the books is ฿426,054. Subtract the ฿442,301 of
unrecorded spend and it lands near zero — which matches what you actually see in the account.
The money is not missing; roughly half was legitimately distributed and roughly half was
spent without ever being written down.

### 1a. 100% of profit was distributed, every single month

From the owner's own sheet — the distribution equals the net margin exactly, four months running:

| Month | Net profit | Blessme 60% | Ming 40% | Total paid | Retained |
|---|---:|---:|---:|---:|---:|
| Dec 25 | 79,935 | 47,961 | 31,974 | 79,935 | **0** |
| Jan 26 | 126,279 | 75,767 | 50,512 | 126,279 | **0** |
| Feb 26 | 142,589 | 85,553 | 57,036 | 142,589 | **0** |
| Mar 26 | 64,503 | 38,702 | 25,801 | 64,503 | **0** |
| **Total** | **413,306** | **247,984** | **165,323** | **413,306** | **0** |

This is the liquidity problem stated precisely. The business was never allowed to keep a
single baht of its own earnings, so every month started from nothing and every fruit purchase
had to be funded by that month's sales. There is no buffer for a slow week, and no capital to
open B2 or B3 from retained earnings.

### 1b. The Dec distribution is miscategorised as ice

In `B1 / Daily_Expenses`, dated 02/01/2026:

| Bucket | Category | Description | Amount |
|---|---|---|---:|
| COGS | Ice | ส่วนแบ่ง60เปอ | 47,961 |
| COGS | Ice | ค่าส่วนแบ่งกำไรเมน 40เปอ | 32,000 |

฿79,961 of owner drawings booked as cost of goods. This breaks the rule in CLAUDE.md
(distributions must be `EXCLUDED` / `Profit Distribution`), it understates December profit,
and it is why the books blamed ice for cash that actually went to the partners.

---

## 2. Revenue accuracy (B1, Jan–Mar, vs the owner's sheet)

Very good. Two fully independent records, 90 days, only 4 disagreements:

| Day | Owner's sheet | Excel | Diff |
|---|---:|---:|---:|
| 2 Jan | 11,045 | 11,105 | +60 |
| 18 Jan | 9,280 | 9,220 | −60 |
| 25 Jan | 11,210 | 12,210 | **+1,000** |
| 27 Feb | 11,325 | 13,325 | **+2,000** |

Net overstatement **฿3,000**. The ±60 pair on 2/18 Jan offsets exactly and looks like a
transposition between two days. The 1,000 and 2,000 are round numbers — likely a typed digit.
March reconciles to the baht. **Revenue is not where the money went.**

## 3. Cost side is where the data fails

`expense_gap.js` benchmarks each branch-month against B1's own verified COGS ratio (38.9%,
derived from the three months that do have real slips) plus contracted fixed costs.

| Branch | Month | Revenue | Recorded cost | Expected | Unrecorded | |
|---|---|---:|---:|---:|---:|---|
| B1 | Feb26 | 340,060 | 141,306 | 206,377 | 65,071 | suspect |
| B1 | Mar26 | 286,925 | 103,148 | 185,692 | 82,544 | suspect |
| B2 | Mar26 | 10,130 | 0 | 3,943 | 3,943 | **phantom month** |
| B2 | Apr26 | 69,260 | 50,052 | 90,961 | 40,909 | suspect |
| B2 | May26 | 167,381 | 52,830 | 129,157 | 76,327 | **SEVERE** |
| B2 | Jun26 | 115,770 | 60,400 | 109,066 | 48,666 | suspect |
| B2 | Jul26 | 135,960 | 59,000 | 116,926 | 57,926 | suspect |
| B3 | Jul26 | 171,897 | 69,500 | 136,415 | 66,915 | suspect |
| | | | | **Total** | **442,301** | |

Root cause is simple: **B2 has 1 expense slip in the entire archive and B3 has none in the
path the pipeline reads.** B1 has 405 slips across Jan–Jul and its recent months reconcile
fine. You cannot audit a cost you never photographed.

Because of this, **every B2 and B3 profit figure to date is overstated**, and the profit
share paid on those figures was overpaid.

---

## 4. Structural defects found

| # | Defect | Impact |
|---|---|---|
| 1 | `Fixed_Expenses` holds placeholder data — Rent = Electricity = Water = 12,324 | Rent was really 30,000 (Jan) / 35,000 (Feb–Mar). The 12,324 is *warehouse* rent (ค่าเช่าคลัง) copied into three columns. |
| 2 | B1 and B2 `Fixed_Expenses` are byte-identical | B2's fixed costs are B1's, and wrong for B1 too. |
| 3 | `Fixed_Expenses` stops at Mar26 | Apr–Jul fixed costs absent from that table entirely. |
| 4 | `Summary` says Jan expenses = ฿2,940 | Not derived from the ledger; contradicts `Daily_Expenses` by three orders of magnitude. |
| 5 | B2 `Mar26` contains one day of B1's March data (1 Mar, ฿10,130) | B2 opened 18 April. Phantom revenue in a month it did not trade. |
| 6 | 21 May missing from **both** B1 and B2 | A real trading day absent from both branches. |
| 7 | Jan + Feb have no daily cash/transfer split (59 days) | Recoverable — the owner's Google Sheet has all 59 days. |
| 8 | B1 `Daily_Expenses`: 36 rows "Unknown", 6 month-label mismatches, 4 zero amounts | 46 unusable rows. |
| 9 | Three different sheet layouts across months | Header on row 2 (Jan–Jun), row 1 (Jul), absent (B2 Mar26). Silently corrupts any naive reader — it corrupted the first version of this audit. |
| 10 | Aug 1–4 not entered anywhere | Current month has no data. |
| 11 | B3 slips live in `B3/Sale`, `B3/Expense` | Pipeline reads `1_Sale` / `2_Expenses`, so B3 sources are never picked up. |

---

## 5. The statement

`audit/statement.csv` — 1,083 entries in the format of your sample, single shared account,
branch tagged per row:

```
วันที่ | สาขา | รายละเอียด | ประเภท | รายรับ | รายจ่าย | ยอดรวม
```

| | |
|---|---:|
| Opening balance | 100,000 *(assumed from ต้นทุน — replace with the real 1-Jan figure)* |
| Total in | 2,568,936 |
| Total out | 2,242,883 |
| — of which owner distributions | 413,306 |
| Closing balance (on the books) | 426,054 |
| Lowest point | **42,295 on 02/01/2026** |
| Closing balance had nothing been distributed | 839,360 |

The lowest point is the day the December distribution was paid. The account fell to ฿42,295 —
about four days of B1 fruit purchasing. That is how close to the edge this has been running.

To regenerate with your real opening balance: `node audit/build_statement.js 250000`

---

## 6. Liquidity plan

**The rule to adopt: pay the business first, the partners last.**

1. **Set a working capital floor.** Peak monthly cash-out across all three branches is
   ~฿400,000. A one-month floor is **฿400,000**; a conservative 1.5-month floor is ฿600,000.
   No distribution may take the balance below the floor. Nothing else on this list matters if
   this one is skipped.

2. **Distribute quarterly, not monthly**, and only from cash actually above the floor.
   Monthly distribution of 100% of a number derived from incomplete cost data is what created
   this situation.

3. **Rebuild the floor before the next payout.** Current book balance ฿426,054 is already
   near a one-month floor — but it is overstated by the ~฿442,301 of unrecorded spend, so the
   true position is likely close to zero. Assume **no distribution is affordable right now**
   until the real bank balance is confirmed.

4. **Recover the B2/B3 overpayment.** Profit share on B2 and B3 was paid against overstated
   profit (their costs were never recorded). Once B2/B3 costs are reconstructed, restate those
   months and offset the excess against future distributions rather than requesting repayment.

5. **Photograph every B2 and B3 slip from today.** This is the cheapest fix on the list and
   without it none of the above can be verified next quarter.

### Suggested distribution formula

```
distributable = cash_balance − working_capital_floor − next_month_fixed_costs
if distributable <= 0: no distribution this quarter
else: Blessme 60% / Ming 40% of distributable   (B1 rates; 70/30 for B2, B3)
```

---

## 7. What is still blocked

- **Real opening bank balance at 1 Jan 2026** — the ฿100,000 used is an assumption taken from
  ต้นทุน in the owner's sheet. Every balance in the statement shifts by the difference.
- **Actual payout records for Apr–Jul** — only Dec–Mar distributions are documented. If
  payouts continued at 100% through July, the leak is materially larger than ฿413,306.
- **B2 and B3 expense slips** — until these exist, ฿442,301 is an estimate, not a fact, and
  B2/B3 profit cannot be stated with confidence.
