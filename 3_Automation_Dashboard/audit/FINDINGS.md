# Somsaijai Financial Audit — rebased against main, 2026-08-15

Continuation of the original Jan–Aug financial audit (PR #2, `worktree-finance-statement-audit`),
re-run against current `main` after it diverged with its own Jun-Jul26 data-error fixes
(`538bf53`) and B3 onboarding (`066e0b4`). The old PR's Excel snapshot was stale, so instead of
merging it, the audit scripts were re-run fresh against today's ledgers. Most of the original
findings were already applied to the ledger by some other route before this pass started;
this file documents what actually changed here and what is still open.

Run it yourself:

```bash
cd 3_Automation_Dashboard
node audit/sheet_rows.js       # self-check on the sheet parser
node audit/reconcile.js        # B1 Excel vs owner's Google Sheet, Jan-Mar
node audit/expense_gap.js      # group-level unrecorded spend + per-branch allocation check
node audit/build_statement.js  # writes audit/statement.csv
BANK_DIR=<dir with extracted .txt statements> node audit/reconcile_bank.js   # MONTH=05 etc.
```

## Applied in this pass

- **`fix_q1.js`** — Jan/Feb/Mar26 shop rent was never booked to `Daily_Expenses` (lived only in
  a placeholder `Fixed_Expenses` tab). Added ฿30,000 / ฿35,000 / ฿35,000 sourced from the
  owner's own sheet.
- **`fix_stock_rent.js`** — April's ฿12,000 shared stock-storage rent was never split between B1
  and B2; added ฿6,000 to each. (May/June splits were already correct.)
- **`fix_march_salary.js`** — the manager's March salary (฿19,000, matching the 05/03/2026 bank
  transfer) had no ledger row; owner confirmed B1's existing March Salary line (฿27,600,
  "ค่าแรงคนงาน Mar26") is a different employee's wages, not the manager's. Added B1 `05/03/2026
  Salary "เงินเดือนเมน 3/26" ฿19,000`, matching the Jan26/May26 rows' format. Applied and
  verified idempotent.

## Bug found and fixed

`fix_q1.js` computed "already booked" shop rent as a hardcoded `0` regardless of the ledger's
actual state, so it was not idempotent — a second run would re-add the same three rows. This
was caught by `update_dashboard.js`'s own duplicate-row detector after the first `--apply` run
(the script had, in fact, already been run once before by an earlier session, so the second run
in this pass silently double-booked ฿100,000). The duplicate rows were removed and the script
was patched to track shop-rent and warehouse-rent bookings separately by description instead of
conflating them under one `Rental` bucket. Re-verified idempotent after the patch.

## Already correct — no changes needed

Verified cell-by-cell against the live ledger; all were already applied by an earlier,
un-tracked pass before this session started:
- `fix_guava.js` — 01/05 Guava line already correctly split
- `fix_payroll.js` — May payroll already at confirmed figures
- `fix_categories.js` — all 6 target rows already correctly bucketed as COGS
- `dedupe_june.js` — no duplicate June rows found
- `book_missing.js` — all 11 target bank outflows already have ledger entries
- `book_shopee.js` — all 88 Shopee payments (฿224,473) already booked

## Running cash statement (`statement.csv`, Jan–Jul26)

Opening ฿125,656 (1 Jan, confirmed actual balance) → closing ฿29,852.
**Lowest point: -฿43,193 on 15/05/2026** — driven by the ฿41,000 May shop+stock rent landing in
one lump on 14/05, compounded by a settled fruit-purchase row on 15/05 (see item 1), against
thin daily cash sales. Confirmed a real cash-flow squeeze, not a data artifact — see below.

## Resolved

1. **05/03/2026 ฿97,553.40 transfer to Blessme's channel = Feb26 distribution + rent reimbursement.**
   ฿85,553 (Feb26 Blessme distribution) + ฿12,000 (Feb26 stock rent, booked in the ledger
   28/02/2026, `COGS/Rental "ค่าเช่าสต็อคกพ"`) = ฿97,553 — off by 40 satang, likely a rounding
   or transfer-fee artifact. Bank narration (`STM_SA8285`, 05-03-26 21:26, TTB X6747 นาย ฐนกร)
   confirms it went to Blessme's known distribution channel. Read as one lump payment covering
   both, not booked separately in the ledger since the rent side was already recorded on the
   28th. No ledger change needed — this closes one of the two open unmatched-transfer items
   below.

2. **B1 15/05/2026 row is correctly dated, not a mis-entry.**
   `COGS/Orange, "05/05/69 ส้ม 30x22กก 660กกx30", ฿21,450` — date column says 15/05/2026 while
   the description references 05/05. Checked whether this kind of mismatch is normal for this
   ledger by comparing every row with a date embedded in its description against its own Date
   column, across all of B1: **20 mismatches vs. only 3 exact matches**, and every mismatch
   follows the same direction — the Date column is always on or after the date named in the
   description (e.g. row 199: column 04/05, description "30-4-2569"; row 241: column 22/05,
   description "16-5-2569"; rows 376 and 404 even fold multiple purchase dates into one row,
   filed under the latest one). This is a systematic convention — this fruit supplier is paid
   on credit and the ledger books the settlement date, preserving the receipt's original date
   in the description. Row 229's 10-day gap is longer than the typical 1-6 days elsewhere but
   fits the same pattern. **Not moved — moving it would break the ledger's own convention.**

## Open items — need owner input before further changes

1. **Profit distributions are consistently paid ~1 month after the month they're booked for**,
   confirmed against the real bank statements:

   | Paid (bank) | Blessme | Ming | Total | For month |
   |---|---:|---:|---:|---|
   | 02/01/2026 | 47,961 | 32,000 | 79,961 | Dec25 (owed 79,935) |
   | 02/02/2026 | 75,767 | — | 75,767 | Jan26 Blessme (exact) |
   | 10/04/2026 | 38,702 | 25,801 | 64,503 | Mar26 (exact) |
   | 10-14/05/2026 | 50,345 | 45,060 | 95,405 | Apr26 (exact, already known) |

   Blessme's channel is "นาย ฐนกร" (TTB/พร้อมเพย์). Ming's channel was "นาย ฐิติภูมิ สิงห์" in
   January, then switched to "MR. AUNG MIN PHAY" from February onward — confirmed by the owner
   to be the shop manager's account, used both to route payout money and to fund urgent
   purchases, which is why large distribution-sized transfers and many small ones share one
   account.

2. **Correction: the "~฿280,000" figure below was wrong** — it summed *all* unexplained Feb-Apr26
   bank outflows (~฿418,130 before this session's fixes), not specifically the manager's
   channel. Re-checked against `reconcile_bank.js` after this pass's fixes; the real total
   still routed through the manager's account (X7485 MR. AUNG MIN PHAY) with no ledger entry is:

   | Date | Amount |
   |---|---:|
   | 20/02/2026 | ฿416 |
   | 27/02/2026 | ฿5,000 |
   | 18/03/2026 | ฿230 |
   | 01/04/2026 | ฿24,600 |
   | **Total** | **฿30,246** |

   Presumed real business spend (urgent purchases) per the owner, but not individually
   categorizable from the bank statement alone — no line-item description beyond the payee.
   Needs the manager's receipts before booking to COGS/OPEX. Not booked in this pass. Checked
   the bank statement itself for a memo/note field on these 4 slips — none of the K PLUS
   transfer lines to X7485 carry any note beyond the truncated payee name (unlike e.g. the
   Lalamove entries, which do carry an account-name line); the PDF has nothing more to extract.

## Resolved (this pass)

- **฿9,341 on 18/04/2026 to TTB X4482 นาย ฐนกร — a personal loan from the owner (Thanakorn,
  ฐนกร) to fund OPEX purchases (packaging, tissue, etc.), confirmed by owner.** Owner could not
  recall an itemized breakdown, so — like the manager's ฿30,246 bucket above — it can't be
  categorized to specific expense lines from this alone. Not booked in this pass.

- **02/02/2026 21:04, ฿70,000 to TTB X6747 นาย ฐนกร = B1's February rent (฿35,000) + deposit
  (฿35,000), confirmed by owner.** The ฿35,000 rent portion is already correctly booked
  (`28/02/2026 Rental "ค่าเช่าร้าน Feb26 (ปรับตามงบการเงินเจ้าของ)" ฿35,000`, added by
  `fix_q1.js`). The remaining ฿35,000 is the deposit, which is correctly *not* booked as an
  expense — same treatment already established for B2's `06/05 ฿45,000 rent + deposit` transfer
  in `book_missing.js`/`may_reconcile.js` ("deposit is refundable — an asset, not an expense").
  No ledger change needed; this account (TTB X6747 นาย ฐนกร) is confirmed to be Blessme
  personally, who both takes profit distributions and receives B1's rent/deposit — explains why
  a rent+deposit payment and a distribution landed in the same account 3 minutes apart.
- **฿47,000 monthly shop+stock rent (10/04, May, 08/06) = ฿35,000 rent + ฿12,000 stock,
  confirmed by owner.** Matches what `fix_stock_rent.js` already documented; no change needed.

- **฿19,000 recurring transfers to the manager's channel (X7485 MR. AUNG MIN PHAY) = manager's
  monthly salary, confirmed by owner.** All three found in the bank data are now booked:
  `31/01/2026 Salary "เงินเดือนเมนมกราคม" ฿19,000` (B1 row 53), `27/05/2026 Salary "เงินเดือนเมน
  5/26" ฿19,000` (B1 row 254), and `05/03/2026 Salary "เงินเดือนเมน 3/26" ฿19,000` (added by
  `fix_march_salary.js` — owner confirmed B1's existing March Salary row, ฿27,600 "ค่าแรงคนงาน
  Mar26", is a different employee's wages, not the manager's, so the manager's March salary had
  genuinely never been booked).
