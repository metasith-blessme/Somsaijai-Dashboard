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
