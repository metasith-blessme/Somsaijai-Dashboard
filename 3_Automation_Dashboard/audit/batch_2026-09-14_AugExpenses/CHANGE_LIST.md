# Proposed change list — August 2026 expenses

**Batch:** BATCH-2026-09-14-AUG-EXPENSES · **129 rows** · **฿432666.22**

> Nothing has been written. This is the change list for your approval.

## Reconciliation

| | Amount |
|---|---:|
| Paid across 113 slips | 504,860.22 |
| Less coconut cash refund | −500.00 |
| **Net to account for** | **504,360.22** |

| Disposition | Amount |
|---|---:|
| Booked as August rows | 432666.22 |
| Excluded (profit share, out-of-scope, cash float) | 23634.00 |
| Deferred to a separate July correction | 48060.00 |
| **Total** | **504,360.22** |

**Difference: ฿0.00**

## By branch

| Branch | Amount |
|---|---:|
| B1 | 287942.86 |
| B2 | 65405.33 |
| B3 | 79318.03 |

## By branch, bucket and category

| Branch | Bucket | Category | Amount |
|---|---|---|---:|
| B1 | COGS | Apple | 13174.00 |
| B1 | COGS | Coconut | 17075.00 |
| B1 | COGS | Durain | 4830.00 |
| B1 | COGS | Guava | 23960.00 |
| B1 | COGS | MIXED (Mango / Sticky Rice / Soybean) | 2850.00 |
| B1 | COGS | MIXED (Packaging / Coconut) | 5153.00 |
| B1 | COGS | MIXED | 895.00 |
| B1 | COGS | Mango | 28600.00 |
| B1 | COGS | Orange | 22010.00 |
| B1 | COGS | Other | 1152.34 |
| B1 | COGS | Packaging | 21481.00 |
| B1 | COGS | Pineapple | 11778.00 |
| B1 | COGS | Sticky Rice | 10170.00 |
| B1 | COGS | Transportation | 17000.00 |
| B1 | COGS | Watermelon | 28400.00 |
| B1 | OPEX | Other OPEX | 8547.85 |
| B1 | OPEX | Rental | 39000.00 |
| B1 | OPEX | Salary | 31866.67 |
| B2 | COGS | Other | 792.33 |
| B2 | OPEX | Other OPEX | 4846.33 |
| B2 | OPEX | Rental | 29000.00 |
| B2 | OPEX | Salary | 30766.67 |
| B3 | COGS | Other | 792.33 |
| B3 | OPEX | Other OPEX | 4178.82 |
| B3 | OPEX | Rental | 22780.22 |
| B3 | OPEX | Salary | 51566.66 |

## Excluded — not booked anywhere

| Slip | Amount | Reason |
|---|---:|---|
| 25/26/27 | 5000.00 | cash withdrawn as operating float — asset, not expense; no petty-cash account exists |
| 82 | 12884.00 | Ming 30% July profit share — EXCLUDED / Profit Distribution / P&L amt 0 |
| 41 | 1500.00 | Durian shop investment — owner: out of scope, not booked |
| 8 | 4250.00 | owner: cut it off, not booked |

## Deferred — separate July correction, needs its own authorisation

| Slip | Amount | Reason |
|---|---:|---|
| 13 | 30000.00 | B2 June rent, paid 02/07 — July/June correction, needs duplicate check + closed-month authorisation |
| 111 | 3500.00 | owner: belongs to Jul26 — closed-month correction |
| 110 | 14560.00 | watermelon settlement — books to Aug26, but paired with removing two ฿3,200 July estimate rows |

## Also part of the July correction (not in the ฿48,060 above)

| Change | Amount |
|---|---:|
| Remove two unsupported Jul26 watermelon rows (27/07, 28/07) | −6,400.00 |
| Add three unbooked 24/07 Shopee payments (packaging ฿1,485 + coconut ฿5,460) | +6,945.00 |
| Add slip 111 B3 salary to Jul26 | +3,500.00 |
| **Net July change** | **+4,045.00** |

## Salary check

August salary across all three branches totals **฿111,500.00**, which matches the configured fixed-cost table (B1 35,000 + B2 30,000 + B3 46,500) exactly. Slips 101 (฿2,400 trainees) and 51 (฿300 event) sit on top of that, as expected — they are not part of the fixed establishment.

## Before this can be written

1. Your approval of these 129 rows.
2. A safe importer with backup, dry run, readback and rerun-equals-zero-changes. It does not exist yet — `process-expenses` remains unsafe and is not an option.
3. The July corrections above need separate authorisation, since Jul26 is closed.
