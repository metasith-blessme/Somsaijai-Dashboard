# Duplicate check — slip 110 watermelon settlement vs existing ledger

**Run:** 15 Sep 2026 · **Scope:** `Daily_Expenses`, all three branch workbooks
**Result:** ONE UNRESOLVED CONFLICT. Not safe to import slip 110 as-is.

## Method

Searched all three branch workbooks for `Watermelon` category rows. B2 and B3 have none — all watermelon is booked to B1. Matched on category rather than description text, because one July row omits the word แตงโม from its description and a text-only search misses it.

## Existing B1 Jul26 watermelon — 7 rows, ฿36,880

| Booked | Amount | Delivery dates named in the row | Source slip |
|---|---:|---|---|
| 08/07 | 6,880 | 3-7, 6-7 | July_260802_40 |
| 17/07 | 7,200 | 10-7, 11-7 | July_260802_57 |
| 17/07 | 4,000 | 14-7 | July_260802_59 |
| 20/07 | 4,000 | 17-7 | July_260802_67 |
| 23/07 | 8,400 | 20-7, 22-7, 23-7 | July_260802_81 |
| 27/07 | 3,200 | **none — 40 ลูก only** | July_260802_13 |
| 28/07 | 3,200 | **none — 40 ลูก only** | July_260802_18 |

## Slip 110 claims (paid 03/08/2026, ฿14,560)

| Delivery | Qty | Amount | Accounting month |
|---|---:|---:|---|
| 26-7-2569 | 50 ลูก | 4,000 | Jul26 |
| 28-7-2569 | 50 ลูก | 4,000 | Jul26 |
| 31-7-2569 | 40 ลูก | 3,200 | Jul26 |
| 3-8-2569 | 42 ลูก | 3,360 | Aug26 |

## Findings

**1. 31 July — clean.** No existing row covers a 31 July delivery. New cost, no conflict.

**2. 26 and 28 July — CONFLICT, unresolved.** The two existing rows booked on 27/07 and 28/07 are the only July rows that name no delivery date; they record the payment date only. They sit exactly where slip 110 places its 26-7 and 28-7 deliveries.

|  | Existing rows | Slip 110 |
|---|---|---|
| Dates | booked 27/07 and 28/07 | delivered 26-7 and 28-7 |
| Quantity | 40 ลูก each | 50 ลูก each |
| Amount | 3,200 each | 4,000 each |
| Source | July album, two separate slips | August album, one settlement |

The quantities and amounts **differ**, so these are not identical records. Two readings remain open:

- **(a) Separate deliveries.** Four genuine late-July deliveries — 40 ลูก paid in July and 50 ลูก settled in August. Nothing is duplicated; slip 110's ฿11,200 of July cost is all new.
- **(b) Same deliveries, counted twice.** The August settlement re-covers deliveries already paid and booked in July, at a different count. Booking slip 110 would double-count up to ฿8,000.

Same date and amount alone would only be a candidate; here not even the amounts match, so resemblance proves nothing either way. Per OCR_RULES §6 this is not resolvable from the documents in hand.

**3. The owner's "book it to August" instruction does not remove this risk.** It changes which month a second booking would land in, not whether one occurs. An owner-approved period exception cannot convert a duplicate into a non-duplicate.

## What would settle it

Either of these closes the question without guesswork:

- The two July source slips `LINE_ALBUM_Cost July_260802_13.jpg` and `_18.jpg` — reading their notes would show which deliveries they actually paid for. Both files exist in `B1/2_Expenses/Jul26/`.
- Owner confirmation that late July had deliveries on 26, 27, 28 **and** 28 July at two different quantities.

## Status of the other two settlements

Slips 73 and 74 cover deliveries on 3, 6, 9, 11 and 14 August. **Aug26 currently holds zero watermelon rows**, so neither slip conflicts with anything booked. Both are clear to proceed.

---

# RESOLVED — and it uncovered a pre-existing error in the July book

I opened the two cited July source slips. **Neither is a watermelon payment.**

| Cited file | What the slip actually is | Amount |
|---|---|---:|
| `July_260802_13.jpg` | Shopee — `แก้ว1ลัง ไม่สกรีน641(1000ใบ)` + `ภูเขา 974*2 1,948 (1000ใบ)` → **cups/packaging** | **฿2,589** |
| `July_260802_18.jpg` | นาง ประนอม คุ้มเจริญ — `ฝรั่ง 3 ตะกร้า` → **guava** | **฿3,000** |

Neither the category, the item, nor the amount matches the watermelon rows that cite them.

## Both real payments are already booked correctly, elsewhere

| Booked | Category | Description | Amount |
|---|---|---|---:|
| 27/07 | Packaging | `Shopee (ทีมจัดซื้อ) [bank SA5601]` | 2,589 |
| 28/07 | Guava | `ฝรั่ง (นาง ประนอม) [bank]` | 3,000 |

These came in via bank-statement reconciliation and are correct. Nothing is missing from July.

## So what are the two watermelon rows?

| Booked | Category | Description | Amount |
|---|---|---|---:|
| 27/07 | Watermelon | `แตงโม 40 ลูก (LINE_ALBUM_Cost July_260802_13.jpg)` | 3,200 |
| 28/07 | Watermelon | `แตงโม 40 ลูก (LINE_ALBUM_Cost July_260802_18.jpg)` | 3,200 |

**฿6,400 of watermelon cost whose cited evidence does not exist.** The files they point to are different payments that are already booked under their own correct rows.

Slip 110 independently evidences that late-July watermelon *was* delivered — 50 ลูก on 26-7 and 50 ลูก on 28-7 — and that it was **settled on 3 August**, not in July. The most probable reading: those deliveries were pre-booked into July at an estimated 40 ลูก / ฿3,200 with source references copy-pasted from neighbouring rows, and the actual settlement arrived later on slip 110.

## Consequence for this batch

These two rows sit exactly where slip 110's 26-7 and 28-7 lines fall. **If slip 110 is booked while they remain, those melons are counted twice** — regardless of whether slip 110 goes to July or August, because the phantom rows are in July either way. The owner's "book it to August" instruction does not prevent this.

## Recommendation — owner decision required

1. **Verify the two ฿6,400 rows against a payment.** If no slip, bank line or cash voucher supports them, they are unsupported cost and July watermelon is overstated by ฿6,400 (booked ฿36,880 → ฿30,480).
2. **Do not import slip 110 until this is settled.** Once resolved, slip 110's four delivery lines can be booked cleanly, since 31-7 and 3-8 conflict with nothing.
3. This is a **correction to a closed month**, so under OCR_RULES §7 it needs explicit owner authorisation and must be recorded with before/after values and the reason — separately from this batch's import.

## Scope note — is this systemic?

82 ledger rows cite a source file. Five source files are cited by two rows each; all five are legitimate audit splits where one slip was correctly divided into two lines (mango + investment, coconut + Lalamove, guava + delivery, mango + pineapple, two freight charges). Those are fine.

The `_13` / `_18` pair is a different failure — not a split, but two rows pointing at unrelated documents. I verified these two by opening the images. **The other 80 citations have not been opened and are therefore unverified.** I am not claiming the July book is otherwise clean; I am claiming this one pair is wrong.
