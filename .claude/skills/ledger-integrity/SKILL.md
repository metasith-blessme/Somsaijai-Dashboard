---
name: ledger-integrity
description: Rules for adding, changing, or auditing rows in the Som Sai Jai expense ledger (Daily_Expenses in the branch Excels). Use before booking any expense from a bank slip or receipt photo, before writing any audit/fix_*.js script, and whenever asked to check the books for double-booking, missing costs, or wrong-month entries.
---

# Ledger integrity

The Excel `Daily_Expenses` sheets are the source of truth for money. Every rule here exists
because the books were already broken that way once.

## Before you add a row, search for it

Booking a payment that is already booked is the single most common failure in this ledger.
It has happened three separate ways:

| Shape | Real case | Why it slipped through |
|---|---|---|
| **Exact** | 28/01/26 rows 45-47 pasted again as 48-50 (฿4,886) | nothing checked for same-day repeats |
| **Split** | Apr26 payroll: `Employee 1` ฿19,000 + `Employee 2` ฿12,000 alongside the `[bank]` ฿31,000 | `reconcile_bank.js` matches 1 bank line to 1 ledger row, never 1-to-N |
| **Re-add** | 31/07/26 ฿2,000 Lalamove added by an audit labelled "missing entry" | the audit script never looked for an existing row |

Run `node audit/find_duplicates.js` first. It reports all three shapes and edits nothing.

## Never delete on the ledger alone — confirm against the bank

Two rows with the same amount on the same day are **not** proof of a duplicate. Of ten
candidates found in the Jan–Jul 26 books, **five were real double payments**:

- 23/01 and 26/01 — Lalamove charged twice the same day, one minute apart
- 05/03 ฿7,312 ×2 — two *different* payees (ณัชชา and ชัยวัฒน์)
- 22/06 ฿700 — three separate transfers that day
- 21/06 Shopee ฿1,210 ×2 — two orders, 13:48 and 13:49

Deleting those would have destroyed real cost. The test is the statement: **N ledger rows
against 1 bank payment = duplicate. N rows against N payments = keep.**

Reading the statements:

```bash
cd "Bank Statement" && pdftotext -layout -upw "<password>" STM_*.pdf <dest>.txt
```

The PDF layout wraps: a row's date can land on its own line with the amount on the next.
A naive `grep '05-03-26.*โอนเงิน'` silently misses those and you will conclude money is
missing when it is not. Join date-only lines to the next line before parsing, then check
your row count against the `รวมถอนเงิน` / `รวมฝากเงิน` totals printed on page 1.

## Cash is a blind spot, not a discrepancy

Only ~7% of expenses (฿148,695 of ฿2.19M) can be traced to a bank line. The shop takes
cash and often pays staff and suppliers straight out of the till, so ฿713,419 of cash
sales never reached the bank. That gap is **mostly booked expenses paid in cash** — if it
were unbooked spending the business would show a ฿337k loss, which it does not.

So: absence of a bank record proves nothing. Never treat "not in the statement" as
"not real". Ask the owner instead.

## Jan–Mar 26 is the owner's own bookkeeping — do not "fix" it

The owner kept January, February and March by hand, without any AI involvement, and has
confirmed those months are accurate. Rows there marked `(ปรับตามงบการเงินเจ้าของ)` come
straight from his own accounts.

**Never move a row into Jan/Feb/Mar, and never restate one, without asking him first.**
On 2026-08-28 a ฿24,600 payroll row was moved Apr26 → Mar26 on the strength of its own
description ("เงินเดือนพนักงาน 3 คน มี.ค. 26"). His March wage figure is ฿27,600 and was
already complete; the move was reverted.

"Do not fix it silently" is the rule — not "the book is always right". Ask, and let the
evidence decide. When a bank slip and a Q1 book line describe the same cost, search the
statements for **both** figures before choosing:

> Mar26 wages: his book said ฿27,600, a slip said ฿24,600. ฿27,600 appears **nowhere** in
> 863 transactions across both accounts; ฿24,600 is on the statement (01/04 15:12 to AUNG
> MIN PHAY). Owner chose the slip. The ฿27,600 line was removed and the ฿24,600 moved into
> Mar26, giving March wages of ฿43,600 (฿24,600 + Ming's ฿19,000).

So a Q1 figure with no bank trace is not automatically wrong — cash is normal here — but
it is not automatically right either. Put both numbers in front of him and let him pick.

Months from Apr26 onward are OCR- and audit-assembled and are fair game to correct.

## Always write quantity + unit on a fruit purchase

COGS is allocated by **actual usage** (owner's choice, 2026-08-28), so a purchase row is
only useful if it says how much was bought, not just what it cost. Today 30% of fruit spend
(฿266,273) cannot be tied to any quantity because the description is only a date:

```
bad   รอบ 27/04/69                    ← ฿21,600 for an unknown amount of orange
good  ส้ม 30x22กก 660กกx30 19,800บาท   ← crates × kg, total kg, ฿/kg
```

Orange is the worst at 44% unquantified. Run `node audit/fruit_purchases.js` for the
current per-month, per-fruit picture; it normalises units and reports what it could not
parse rather than guessing.

Known conversions: **1 orange ลัง / ตะกร้า = 22 kg** (owner-confirmed). The supplier writes
crate-maths inline (`30x22กก` = 660 kg), so parsers must handle the compound form — a plain
"first number before กก" reads 22 and undercounts thirty-fold.

## Which month a cost belongs to

Book to the month the cost was **incurred**, not the month the transfer cleared. Payroll
paid on the 1st settles the prior month; a fruit supplier on credit is settled days later.

When a description names its own month (`เงินเดือนพนักงาน 3 คน มี.ค. 26`) that wins over
the date column. `find_duplicates.js` section C catches the mismatch.

## Closed months keep the numbers that were paid

Profit share for Jan–Apr 26 was calculated and paid at the time. Later audits added costs
retroactively, so today's P&L is *lower* than what was distributed:

```
ม.ค.  P&L 126,571  จ่ายจริง 126,279
ก.พ.  P&L 130,639  จ่ายจริง 142,589
มี.ค. P&L  11,120  จ่ายจริง  64,503
เม.ย. P&L  26,053  จ่ายจริง  95,405
```

Do **not** treat the difference as an overpayment to claw back. Same principle as
`profitShareFor()`: a closed month reports what was actually paid.

## Who is who

`audit/FINDINGS.md` (before 2026-08-28) misidentifies these. Trust this table:

| Channel | Side |
|---|---|
| ฐนกร — TTB X6747, พร้อมเพย์ X4482 | Blessme |
| ฐิติภูมิ สิงห์ — SCB X0159, พร้อมเพย์ X8850 | **Blessme** (also funded B3, also receives rent) |
| MR. AUNG MIN PHAY (เมน / Ming) — X7485 | Ming — partner **and** employee |

Ming is Burmese and is often paid in **cash**, so his profit share frequently has no bank
trace at all. Jan ฿50,511.60 and Feb ฿57,035.60 were paid this way — they reconcile to
exactly 40% of those months' profit, but appear nowhere in the statements.

## Writing a fix script

Follow `audit/fix_passthrough.js` and `audit/fix_duplicates.js`:

- dry run by default, `--apply` to write, back the workbook up first
- match on `(date, category, amount)` — never on a row index, which shifts
- make it **idempotent**: guard so a second run is a no-op, and prove it by re-running.
  `fix_q1.js` once double-booked ฿100,000 because it hardcoded "already booked" as `0`
- then `npm test` → `npm run update-dashboard -- --no-deploy` → check the numbers →
  `npm run deploy`

## Feb26 cup counts are derived, not counted

The orange:watermelon ratio in Feb26 sits at 1.43–1.46 on **every one of 28 days**
(σ = 0.009). Every other month swings 0.7–3.5 (σ ≈ 0.5). Real customers do not behave
that way — February's daily cup counts were back-calculated from revenue at a flat
฿60/cup and split on a fixed ratio.

The monthly **total** is sound: 5,643 in the ledger against 5,659 the owner counted, a
0.28% gap. What is synthetic is the daily distribution and the per-fruit split.

Consequences:
- Feb26's ฿24,560 revenue-vs-cups gap is an artifact of that generation, not a real one
- Feb26 fruit *usage* is modelled too, so per-SKU cost conclusions drawn from it are
  circular — they return the assumption they were built on
- Do not use Feb26 for SKU-level margin work. Monthly totals are fine.

A tempting fix — setting watermelon to ฿60 — makes February fit to 0.4% and pushes every
other month to −2%…−5%. It fits because ฿60/cup is exactly what generated February. It is
not a real price. Left at ฿50.

## Menu prices are effective-dated

B1 opened dearer and cut prices on **17 Jan 2026**: orange ฿80 → ฿60, watermelon ฿65 → ฿50
(owner-confirmed). `PRICE_ERAS` / `pricesOn(date)` in `business_rules.js` handles this the
same way `profitShareFor()` handles the share change — add an era, never edit a historical
price.

Before this, all 16 pre-change days tripped the anti-cheat flag over a deliberate price
cut. Jan26's gap fell from 15.2% to 3.5% and flagged days from 26 to 13.

## There is a third payment account you cannot see

The two statements in `Bank Statement/` are the K-Bank business accounts (SA8285, SA5601).
Money also moves from the owner's **personal SCB account, xxx-xxx904-2** — B2's July rent
(฿25,000, 20 Jul, memo "ค่าเช่าที่ b2 เดือน 7") and part of the B3 fit-out were paid from
it, and neither appears in any statement here.

On 2026-08-28 this produced a false alarm: ฿79,000 of July rent was reported as "booked
with no payment" when B2's ฿25,000 was simply paid from an account not in evidence. The
rule two sections up — *absence of a bank record proves nothing* — applies to this too.

So say "not in the K-Bank statements", never "not paid". Ask for the slip.

## Rent comes from the lease, not from a round number

`CLAUDE.md`'s per-branch "fixed costs" are a summary, not a source. B3's July rent was
booked at ฿19,000 from that line while the lease says ฿13,146.16 — a ฿5,854 overstatement
that made B3's first month look worse than it was (net 15,168 -> 21,022 once corrected).

The B3 lease (quotation MWA01, `~/Downloads/platinumpopcontract.JPG`) prices three periods
and each total is rent + 7% VAT + common area + insurance, so the payable is never the
headline rent. From Aug 2026 it is ฿18,780.22/month, not ฿19,000.

Before booking rent, check the lease or the slip. A round number in the ledger with a
generic description ("Rent B3") is a template entry and should be treated as unverified.

## The quantity was never missing — the parser dropped it

`process_expenses.js` `parseNote()` captured the memo with `/บันทึกช่วยจำ:\s*(.*)/`. `.` does
not match newlines in JS, so on a multi-line memo it kept line 1 and discarded the rest:

```
บันทึกช่วยจำ: รอบ 09/06/69          ← kept
ส้ม 23x22กก  506กกx30  15,180บาท     ← dropped
ค่าขนส่ง 23ตะกร้า x 55  1265         ← dropped
```

That single regex is why 44% of orange spend (฿194,201) has no quantity: the orange
supplier puts crates, kilos and unit price on lines 2-3, exactly the lines that were lost.
Fixed to read to the blank line or slip footer, covered by `test_parse_note.js`.

The file also had no `module.exports` and ran its whole OCR sweep on `require`, so none of
its parsers could be tested — which is how the bug survived. Parsers are exported now and
the pipeline is behind `require.main === module`.

**Historic rows are not repaired by this.** Feb–Jun 26 entries still carry only a date;
their quantities have to be read back off the slip images in `B1/2_Expenses/<month>/`.
Jul26 onward is already complete.

Orange specifics worth knowing:
- main supplier is **นาย ชัยวัฒน์ เศวตโชติ** (BBL X2813), fruit trucked from อ.ฝาง, so each
  payment is fruit + freight in one transfer — 26 payments, ฿393,843 across Jan–Jul
- other names appear when orange runs short at short notice; don't assume every orange row
  is his
- the arithmetic is `crates × 22kg × ฿/kg + crates × freight/crate`, e.g. ฿16,445 =
  23×22×30 + 23×55. Solving it recovers a crate count when the memo is missing, but it is
  ambiguous for most amounts — verify against the slip, never book a solved figure alone

## Recovering a quantity that parseNote dropped

`ocr_bin` still works and is far cheaper than reading slip images by eye:

```bash
cd 3_Automation_Dashboard
find ../B1/2_Expenses/<Month> -iname '*.jpg' -print0 | while IFS= read -r -d '' f; do
  ./ocr_bin "$f" > "$OUT/$(basename "$f").txt"; done
grep -l "16,445.00" "$OUT"/*.txt | xargs grep -A6 บันทึกช่วยจำ
```

269 images take a couple of minutes and the memo comes out intact, quantity lines and
all. `audit/restore_orange_qty.js` used this to put the quantities back on ten orange rows
and split two mixed-fruit slips; orange spend without a quantity fell from 44% to 12%.

What is genuinely unrecoverable: the ฿49,560 slip of 02/04 has **no memo written on it at
all**, and the ฿2,250 Jun26 row came from an audit un-bundling, not a slip.

## Orange suppliers

| Who | Sells | Price incl. freight |
|---|---|---|
| นาย ชัยวัฒน์ เศวตโชติ (BBL X2813) | main supplier, trucked from อ.ฝาง, by the 22 kg crate | ฿16 → ฿32.5/kg |
| นาง ศิริพร สวัสดิ์กว้าน (KTB X3340) | mainly watermelon; sells orange by the kilo when the main supplier runs short | ฿30.2/kg |

Two of ศิริพร's slips carry watermelon **and** orange on one transfer and must be split —
฿7,700 (05/03) and ฿5,890 (23/03). Reading only the first line of those memos books the
whole amount as watermelon, which is exactly what happened before 2026-08-28.

The main supplier's price is remarkably stable within an era: every slip from Apr–Jul
lands at ฿32.3–32.7/kg. A slip far off that band is worth a second look.
