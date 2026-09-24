# Clues for finding the two ฿3,200 watermelon slips — plus what the search turned up

## What to look for

| | Slip 1 | Slip 2 |
|---|---|---|
| Payment date | on or just before **27/07/2026** | on or just before **28/07/2026** |
| Amount | **฿3,200.00** | **฿3,200.00** |
| Likely supplier | นาง ศิริพร สวัสดิ์กว้าน | นาง ศิริพร สวัสดิ์กว้าน |
| PromptPay | xxx-xxx-5654 | xxx-xxx-5654 |
| Expected memo | แตงโม 40 ลูก (40 × ฿80) | แตงโม 40 ลูก (40 × ฿80) |
| Likely account | KBank xxx-x-x6560-x or BBL 098-9-xxx249 | same |

Your ฿80 × 40 = ฿3,200 reasoning is sound and matches the ฿80/ลูก rate evidenced on nine other slips across July and August. The amount is entirely plausible — the issue is only that no document in the repository supports these two rows.

## The Jul26 folder does not contain them

All 83 images in `B1/2_Expenses/Jul26/` are accounted for:

- **77** are cited by a Jul26 ledger row
- **6** are cited by nothing — and none of the six is a watermelon payment

The six uncited files are:

| File | Date | Amount | Memo |
|---|---|---:|---|
| `_1` | 24/07 | 2,636 | ฝา 509 · นมข้นหวาน 785 · นมข้นจืด 1,342 |
| `_2` | 24/07 | 3,084 | ฝา 502 · นมข้นหวาน 2,582 |
| `_3` | 24/07 | 1,225 | ฝา 474 · นมข้นจืด 751 |
| `_9` | 26/07 | 1,015 | เครื่องสกัดเย็น 1 เครื่อง |
| `_72` | 22/07 | 9,000 | Salary b2 wei 20days 450/day |
| `_73` | 22/07 | 7,500 | Salary b3 mike 15days 500/day |

So if those two watermelon payments happened, **their slips were never uploaded** — check the LINE album or K PLUS history directly.

## Correction to my earlier concern

Three of those six *are* booked, correctly, just not in B1 — which is the branch allocation working as intended:

- `_72` ฿9,000 → **B2** Daily_Expenses, 22/07, OPEX/Salary ✓
- `_73` ฿7,500 → **B3** Daily_Expenses, 22/07, OPEX/Salary ✓
- `_9` ฿1,015 → B1, 26/07, Investment (audit fix, reclassified from COGS/Packaging) ✓

My earlier search was B1-only and would have wrongly flagged these. They are fine.

## Genuinely missing — ฿6,945 not booked in any workbook

These three payments appear in **no row of B1, B2 or B3**:

| File | Date | Amount | Contents |
|---|---|---:|---|
| `_1` | 24/07/2026 | 2,636 | lids ฿509 + sweetened condensed milk ฿785 + evaporated milk ฿1,342 |
| `_2` | 24/07/2026 | 3,084 | lids ฿502 + sweetened condensed milk ฿2,582 |
| `_3` | 24/07/2026 | 1,225 | lids ฿474 + evaporated milk ฿751 |
| | | **6,945** | |

All three reconcile exactly against their own memo lines. All three are packaging + condensed milk, which under the existing treatment splits between COGS/Packaging and COGS/Coconut.

This is the opposite error to the watermelon one: **understated cost**, three real payments with real evidence that never reached the books. It is a separate July correction and needs its own owner authorisation.

## Net effect on July, if both corrections are made

| | Amount |
|---|---:|
| Remove unsupported watermelon rows | −6,400 |
| Add the three missing Shopee payments | +6,945 |
| **Net change to July COGS** | **+545** |

Close to a wash in total, but the category mix shifts materially: watermelon down ฿6,400, packaging and coconut up ฿6,945.

## The quantity conflict still stands

The ledger rows say **40 ลูก / ฿3,200** for 27-7 and 28-7. Slip 110 says **50 ลูก / ฿4,000** for 26-7 and 28-7. Whichever way the missing slips resolve, these two records disagree about how many melons arrived in late July. Finding the slips settles it; until then slip 110 should not be imported.
