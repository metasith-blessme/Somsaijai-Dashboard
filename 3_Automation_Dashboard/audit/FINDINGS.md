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
**Lowest point: -฿43,193 on 15/05/2026** — driven mainly by the ฿41,000 May shop+stock rent
landing in one lump on 14/05 against thin daily cash sales. Not necessarily a data error, but
see the open item below for one row that may be contributing to it incorrectly.

## Open items — need owner input before further changes

1. **Possible mis-dated row, B1 15/05/2026**: `COGS/Orange, "05/05/69 ส้ม 30x22กก 660กกx30", ฿21,450`
   — the date column says 15/05/2026 but the description says 05/05. If the purchase was
   actually on 5 May, this row should move there. Not changed — no receipt to confirm against.

2. **Profit distributions are consistently paid ~1 month after the month they're booked for**,
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

3. **~฿280,000 across Feb-Apr26, small transfers through the manager's account**, presumed real
   business spend (urgent purchases) per the owner, but not individually categorizable from the
   bank statement alone — no line-item description beyond the payee. Needs the manager's
   receipts before booking to COGS/OPEX. Not booked in this pass.

4. **Two large transfers that don't match any known distribution figure**:
   - 02/02/2026: ฿70,000, same day and channel as the matched Jan26 Blessme payout above, but
     doesn't match Jan26's Ming figure (50,512) or anything else identified so far.
   - 05/03/2026: ฿97,553 + ฿19,000 — doesn't cleanly match Feb26's distribution (85,553 + 57,036)
     or any other known figure.
