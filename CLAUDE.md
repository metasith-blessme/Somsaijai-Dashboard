# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Sales data analysis and unified dashboard for **Som Sai Jai** Juice Bar (Branches B1, B2, and B3).
**Live dashboard:** https://somsaijailive.vercel.app

## Commands (run from `3_Automation_Dashboard/`)

```bash
# Process sales images for a specific branch/month
npm run process-sales Jul26 B1
npm run process-sales Jul26 B2
npm run process-sales Jul26 B3

# Extract expense receipts for a branch (reads B1/2_Expenses, B2/2_Expenses, ... via ocr_bin)
npm run process-expenses B1

# Push verified staging data (pending_verification.json) into the branch Excels
npm run verify-sales

# Sync Excels -> data.json -> reports_data.json -> SomSaiJai_Dashboard.html -> deploy to Vercel
npm run update-dashboard
npm run update-dashboard -- --no-deploy   # regenerate data/report/html without deploying

# Record a shared stock purchase / audit the shared stock ledger
npm run stock-in orange 50
npm run audit-stock

# Run the full test suite (both files below)
npm test
node test_expense_rules.js     # business-rule guards: profit-share never in COGS/OPEX
node test_render_finance.js    # sandboxes index.html's own JS against real reports_data.json

# 4-agent pipeline (extract -> sync -> verify-sales -> deploy -> docgen), wraps the above
npm run pipeline
```

There is no lint/build step — `index.html` and `SomSaiJai_Dashboard.html` are hand-authored vanilla JS with no bundler.

## Architecture

**Pipeline:** the three Excel files (`SomSaiJai_Dashboard_B1_2026.xlsx`, `_B2_`, `_B3_`) are the only source of truth. Everything else is generated:

```
Excel (Sale sheets per month + Daily_Expenses sheet)
  → update_dashboard.js reads all sheets, calls auditRecord()/normalizeExpense() per row
  → data.json (raw per-branch sales rows + normalized expenses)
  → sync_dashboard_html.js embeds data.json into SomSaiJai_Dashboard.html (offline backup copy)
  → gen_report.js calls calculatePL(data.json) → reports_data.json (P&L, COGS allocation, profit share)
  → npx vercel --prod deploys index.html + json (root "/" rewrites to index.html per vercel.json)
```

`data.json` and `reports_data.json` must **never be edited directly** — both are fully overwritten by `update-dashboard`. New sales/expense data always goes in through the Excel files (via `verify-sales`, which reads `pending_verification.json`).

**`Sales_System_Automation/logic/business_rules.js`** is the single source of truth for pricing, COGS allocation, and P&L math — shared by `update_dashboard.js`, `gen_report.js`, and the test suite. Key exports:
- `profitShareFor(branch, month)` — effective-dated profit-share lookup (see below), never a flat constant.
- `normalizeExpense(e)` — reclassifies any expense row whose description matches a profit-share/dividend pattern to `bucket: EXCLUDED, amt: 0`, regardless of how it was categorized at entry. This is what keeps partner payouts out of COGS/OPEX.
- `calculatePL(data)` — builds the full per-month, per-branch P&L (hybrid COGS allocation, rental separation, loss carry-forward, annual rollup).
- `auditRecord(r)` — anti-cheat check comparing reported revenue against `calculateTheoreticalRevenue(r)` (revenue implied by cup counts × price).

**Two dashboard HTML files, one deployed:** `index.html` is the live, actively-edited dashboard (deployed by Vercel). `SomSaiJai_Dashboard.html` is a generated read-only mirror with data baked in via `sync_dashboard_html.js` (`const BUILT_IN = {...}`) — treat it as a build artifact, not a file to hand-edit.

**Test pattern worth knowing:** `test_render_finance.js` does not reimplement `index.html`'s rendering logic — it regex-extracts every inline `<script>` block from `index.html`, runs it in a Node `vm` sandbox with `document`/`Chart`/`fetch` stubbed out, and calls the *real* `renderFinance()` against the *real* `reports_data.json`. Any change to `index.html`'s finance-rendering code is covered by this test without needing a browser.

**OCR/expense-categorization:** `Sales_System_Automation/process_expenses.js` parses Thai bank-transfer slip screenshots (KBank/K+ format) — pulls the amount from a `จำนวน:` line, the free-text note from `บันทึกช่วยจำ:`, and the date from a Thai Buddhist-calendar month abbreviation (`ก.ค.` etc, converted to `DD/MM/2026`). `categorize()` maps the note text to a COGS/OPEX category by keyword.

**Agents (`Sales_System_Automation/agents/`):** `Orchestrator.js` runs a 4-stage pipeline (`ImageExtractorAgent` → `DataSyncAgent` → `verify-sales` → `QADeployerAgent` → `DocGenAgent.py`), invoked via `npm run pipeline`. This is a thinner wrapper around the same scripts listed above, not a separate code path.

## Data Principles
- **Source of Truth:** `SomSaiJai_Dashboard_B1_2026.xlsx`, `SomSaiJai_Dashboard_B2_2026.xlsx`, `SomSaiJai_Dashboard_B3_2026.xlsx`.
- **Anti-Cheat:** `theoretical_rev` calculation is mandatory for all daily entries.
- **Shared Inventory:** Branches deduct from central stock pool managed via `stock_ledger.json`.
- **Date Format:** Always `DD/MM/YYYY`.
- **Hybrid COGS Allocation (ADR 0001):**
  - Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) are allocated by **actual usage**.
  - For POS-only reporting branches without daily paper tallies (like B3), raw material usage is derived from revenue and sales mix so that fruit COGS is allocated fairly.
  - Packaging, Ice, and generic Stock (e.g. ฿12k Stock Rent split ฿4k B1 / ฿4k B2 / ฿4k B3) are allocated by **revenue share**.
- **OPEX Rental Separation:**
  - OPEX with category `Rental` is separated from other Operating Expenses (Other OPEX) in dashboard and P&L reports.
  - Shared rental slips (e.g. ฿12k June stock storage) are explicitly partitioned into ฿4,000 per active branch.

## Profit Share (effective-dated — never apply retroactively)
- **From Jul26 onward: 70% Blessme / 30% Ming on every branch.**
- **Before Jul26:** B1 was 60/40; B2 and B3 were already 70/30.
- Owned by `profitShareFor(branch, month)` in `business_rules.js`. Closed months must keep reporting the rate that was actually paid, so change the effective month — never edit a historical rate.

### Why the rate changed at Jul26 — Ming's salary
Ming (เมน, MR. AUNG MIN PHAY, K-Bank X7485) is **both a partner and an employee**, so he
draws a wage *and* a profit share. The two are linked:

| Period | Ming's wage | Ming's share of B1 |
|---|---|---|
| Jan–May 26 | ฿19,000/month | 40% |
| Jun–Jul 26 | **suspended** — no profit and a cash squeeze, Ming agreed to waive it | 40% → **30% from Jul26** |
| **Aug 26 onward** | **฿20,000/month** | 30% |

Dropping him 40% → 30% was the trade for suspending the wage. So the absence of a ฿19,000
row in Jun26 and Jul26 is **correct, not a missing cost** — don't "fix" it.

From Aug26 the ฿20,000 wage resumes and must be booked monthly as B1 `OPEX/Salary`.

Ming is Burmese and is often paid in **cash**, so his wage and share frequently have no
bank trace: Feb26's ฿19,000 and his Jan/Feb profit shares (฿50,511.60 / ฿57,035.60) appear
nowhere in the statements. Absence of a bank record is not evidence of non-payment here.

## Branch Specifics
- **B1:** Main branch (operating since Jan 2026). Fixed costs: Rent ฿35,000, Salary ฿35,000, Utilities ฿4,000.
- **B2:** Branch 2 (opened April 18, 2026). Fixed costs: Rent ฿25,000 (Jul–Sep discounted rate, normally ฿30,000), Salary ฿30,000, Utilities ฿4,000.
- **B3 (Platinum Pop):** Branch 3 (opened July 11, 2026). Salary ฿46,500 (3 staff × ฿500/day × 31 days), Utilities ฿4,000. **Rent is set by the lease, not a round figure** — quotation MWA01, unit 6.04 m², lessee นายฐิติภูมิ สิงห์สา, term 10 Jul 2026 – 9 Jul 2027. Each amount below is rent + 7% VAT + common area (฿340/m²) + insurance (฿230/m²):

  | Period | Monthly rent | **Total payable** |
  |---|---:|---:|
  | 10–31 Jul 2026 (part month) | 10,570 | **13,146.16** |
  | 1 Aug 2026 – 30 Jun 2027 | 15,100 | **18,780.22** |
  | 1–9 Jul 2027 | 4,530 | 5,634.07 |

  Deposit ฿48,471, due 16 Jun 2026, paid by ฐิติภูมิ on 15 Jun — an asset, not an expense, and part of the B3 investment total. The ฿19,000 previously carried here was a round-number guess; July's real figure is ฿13,146.16.
- **Switching:** UI handles branch switching dynamically via `currentBranch` state (`all`, `B1`, `B2`, `B3`).

## Sales Data Verification Workflow

1. **Plan before executing.** Present the step-by-step plan for a new batch of images and wait for approval before touching any files.
2. **Never write directly to `data.json`.** It is fully overwritten by `npm run update-dashboard`, which reads from master Excel files.
3. **Staging flow for new sales data:**
   - Write records to `3_Automation_Dashboard/pending_verification.json`
   - Run `npm run verify-sales` (pushes to master Excel)
   - Run `npm run update-dashboard` (Excel → `data.json` → deploy)
4. **Audit table required.** Present: `Date | Revenue | Cash | Scan | Expense | Net | Verify ✓/✗` before writing.
5. **Partner profit-share payouts must NEVER be recorded as an expense.** Set bucket `EXCLUDED` / category `Profit Distribution` (amt 0).
