# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Sales data analysis and unified dashboard for **Som Sai Jai** Juice Bar (Branches B1, B2, and B3).
**Live dashboard:** https://somsaijailive.vercel.app

## Commands (run from `3_Automation_Dashboard/`)

**OCR safety prerequisite:** before any document extraction, review, financial import, dashboard regeneration or deployment, read and follow [`docs/OCR_RULES.md`](docs/OCR_RULES.md) and the ordered [`docs/OCR_TO_DASHBOARD_WORKFLOW.md`](docs/OCR_TO_DASHBOARD_WORKFLOW.md). The rules define evidence/approval safeguards; the workflow defines the required gates from batch intake through live readback. They take precedence over older OCR workflow instructions, including the staging steps below. The current `verify-sales`, `process-expenses`, `sync` and `pipeline` commands are unsafe for production imports until the documented gaps are fixed and tested; `process-sales` changes shared staging and is not a preview. See [`OCR_PIPELINE_REVIEW.md`](3_Automation_Dashboard/audit/OCR_PIPELINE_REVIEW.md). The command list is a reference, not authorization to bypass these gates.

**Use the safe-write tools, not the legacy commands.** The legacy importers above are still unsafe. Financial writes now go through purpose-built scripts in `3_Automation_Dashboard/`, each of which validates the whole batch first and fails closed, backs up every workbook it touches, reads every written value back, and refuses to leave a half-written file:

```bash
node safe_import_expenses.js <change_list.json>            # dry run (default)
node safe_import_expenses.js <change_list.json> --commit   # append Daily_Expenses rows
node safe_import_sales.js   <sales_change_list.json> [--commit]  # append month Sale rows
node void_expense_rows.js   <voids.json> [--commit]        # reverse a row (amount -> 0 + reason, never deleted)
node correct_sales_cells.js <corrections.json> [--commit]  # edit named cells, guarded by expected old value
node redact_personal_data.js [--commit]                    # strip names/account digits from published descriptions
node test_safe_import.js                                   # 17 acceptance tests, runs in a throwaway sandbox
```

Every one is idempotent: re-running a batch writes zero rows. `xlsx` 0.18.5 round-trips these workbooks with zero diffs on values, styles, number formats and column widths, so no extra dependency is needed.


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

From Aug26 the ฿20,000 wage resumes and must be booked monthly as `OPEX/Salary`,
**split equally across B1, B2 and B3** (฿6,666.67 / ฿6,666.67 / ฿6,666.66) — Ming manages all
three branches, so the wage is a shared cost, not a B1 cost. Owner-confirmed 19 Sep 2026;
earlier guidance booking the whole ฿20,000 to B1 is superseded.

Ming is Burmese and is often paid in **cash**, so his wage and share frequently have no
bank trace: Feb26's ฿19,000 and his Jan/Feb profit shares (฿50,511.60 / ฿57,035.60) appear
nowhere in the statements. Absence of a bank record is not evidence of non-payment here.

## Audit artifacts

Completed reviews live in `3_Automation_Dashboard/audit/`. Read the relevant one before re-opening a question it already settled:

| Folder / file | What it settles |
|---|---|
| `batch_2026-09-14_AugExpenses/` | All 113 August expense slips: manifest with SHA-256, per-slip transcription, owner decisions (10 rounds), the approved change list, and the July corrections |
| `batch_2026-09-25_JunJulSalesAudit/FINAL_REPORT.md` | All 122 Jun/Jul sale reports checked against the books. Revenue reconciled on 121 of 122 days; the one real error (B2 18/06, ฿30) was corrected 25 Sep |
| `batch_2026-09-25_JunJulSalesAudit/FINDING_B2_0107_0407.md` | B2 01/07 confirmed correct. B2 04/07 **unresolved** — no form supports its ฿5,200 and it looks copied from 01/07, but ฿5,200 fits the Saturday pattern. Needs the physical form's date |
| `duplicate_review_2026-09-25/` | The 5 duplicate warnings `update-dashboard` prints are all genuine separate payments, verified against the bank PDFs. Do not "fix" them |

**`audit/statement.csv` cannot be used to verify the books.** `build_statement.js` generates it *from* the Excel, so checking the Excel against it is circular, and its running balance is computed rather than the bank's. The real evidence is the password-protected PDFs in `Bank Statement/`.

## Data provenance and known limits

**Aug26 B1/B2 sales rest on OCR JSON, not source images.** The original LINE photos expired and staff deleted the originals, so `b1_august_1.json` / `b2_august_1.json` are the only surviving record. They carry daily revenue and a partial cash/scan split, but no cup counts — so `auditRecord()` flags every August day, which is correct reporting, not a data error. B3 August is a POS export and is complete.

**Nine August days are estimates, not observations.** B1 is missing 8 days (6,7,9,10,11,13,14,15 Aug) and B2 one (6 Aug). Those rows carry `[ESTIMATED]` in the `Source Note` column of the Aug26 sheet — the owner approved booking them as a same-weekday mean, on the record that they are replaced the moment real data arrives. Never treat them as observed.

**The ice deduction is the single biggest source of noise in the sale reports.** Staff write gross cash, subtract the ice bought from that cash, and the summary line is inconsistent about which figure feeds the day's total. Revenue is gross cash + scan; the ice is an expense paid out of it. `update_dashboard.js` derives scan as `revenue - cash` ONLY when a cash figure was actually recorded — if both cells are empty the split is unknown and scan stays 0, because deriving it would fabricate "100% scan" (OCR_RULES §4.1).

**Published JSON must carry no supplier names or account digits.** Twelve such descriptions were redacted on 23 Sep 2026; re-scan before every deploy. Full identity stays in the slips and the batch review artifacts, which are not published.

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

Follow [`docs/OCR_TO_DASHBOARD_WORKFLOW.md`](docs/OCR_TO_DASHBOARD_WORKFLOW.md). Read-only inventory and extraction may begin once the batch scope is recorded; owner approval is mandatory for the exact financial write and again for deployment.

The legacy staging/import commands listed above are historical interfaces only and must not be used on production records while the safety hold remains. `data.json` is generated from the branch Excel workbooks and must never be edited directly. After an approved safe import and exact Excel readback, regenerate with `npm run update-dashboard -- --no-deploy`, run `npm test`, inspect the generated diff, obtain deployment approval, and deploy separately with `npx vercel --prod --scope parn` — **the `--scope parn` is required**; without it Vercel answers `Not authorized` even though the CLI is logged in, because the project is linked to that team. Then read the live `reports_data.json` back and confirm the figures.

Partner profit-share payouts are not operating expenses. Their P&L representation remains `EXCLUDED` / `Profit Distribution` / amount 0 while the actual payment is preserved in restricted settlement evidence.
