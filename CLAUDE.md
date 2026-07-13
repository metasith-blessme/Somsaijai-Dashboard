# CLAUDE.md

This file provides guidance for AI agents working in this multi-branch repository.

## Project Overview
Sales data analysis and unified dashboard for **Som Sai Jai** Juice Bar (Branches B1 and B2).
**Live dashboard:** https://somsaijailive.vercel.app

## Tech Stack
- **Frontend:** Vanilla JS, Chart.js (client-side aggregation).
- **Backend:** Node.js (automation scripts), `xlsx` (Excel processing).
- **OCR:** Swift-based `ocr_bin` for local image processing.

## Command Reference (Run from `3_Automation_Dashboard/`)

```bash
# Process sales images for a specific branch/month
npm run process-sales Apr26 B1
npm run process-sales Apr26 B2

# Push verified staging data to branch Excels
npm run verify-sales

# Sync Excels to data.json and deploy to Vercel
npm run update-dashboard

# Record shared stock purchase
npm run stock-in orange 50
```

## Data Principles
- **Source of Truth:** `SomSaiJai_Dashboard_B1_2026.xlsx` and `SomSaiJai_Dashboard_B2_2026.xlsx`.
- **Anti-Cheat:** `theoretical_rev` calculation is mandatory for all daily entries.
- **Shared Inventory:** Both branches deduct from a single central stock pool managed via `stock_ledger.json`.
- **Date Format:** Always `DD/MM/YYYY`.
- **Hybrid COGS Allocation (ADR 0001):** 
  - Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) are allocated by **actual usage**.
  - Packaging, Ice, and generic Stock (e.g., ฿12k Stock split) are allocated by **revenue share**.
- **OPEX Rental Separation:**
  - OPEX with category `Rental` is separated from other Operating Expenses (Other OPEX) in the dashboard and P&L reports.
  - Split slips (e.g., slip #15 containing ฿35k B1 Rent and ฿12k Stock) must be explicitly partitioned into separate entries.

## Branch Specifics
- **B1:** Main branch (operating since Jan 2026). Profit share: **60%** to Blessme.
- **B2:** Branch 2 (opened April 18, 2026). Profit share: **70%** to Blessme.
- **Switching:** UI handles branch switching via `currentBranch` state. `getCleanSales()` handles aggregation for the 'all' view.

## Sales Data Verification Workflow

Applies to any AI agent (Claude, Gemini, Codex, etc.) processing new sale images or sales data for this project.

### Process
1. **Plan before executing.** Present the step-by-step plan for a new batch of images and wait for approval before touching any files.
2. **Never write directly to `data.json`.** It's fully overwritten by `npm run update-dashboard`, which reads from the master Excel files. Direct writes get silently wiped.
3. **Staging flow for new sales data:**
   - Write records to `3_Automation_Dashboard/pending_verification.json` (array, each record `"verified": true`)
   - Run `npm run verify-sales` (pushes to master Excel, clears `pending_verification.json`)
   - Run `npm run update-dashboard` (Excel → `data.json` → deploy)
   - Closed days: add a zero-value record with `remark: "close"` — verify AFTER `update-dashboard` runs, since `verify-sales` may not carry `remark` through.
4. **Audit table required.** After OCR extraction, before writing anywhere, present: `Date | Revenue | Cash | Scan | Expense | Net | Verify ✓/✗`. Never skip this, even for a single day.
5. **Cup count conflicts:** if the sum of individual fruit counts disagrees with a circled/written total, ask the user which to use — do not decide unilaterally.
6. **Cost updates:** when told a cost figure changed, ask whether it's a replacement or additive before writing (e.g. "orange cost is X" — total, or on top of existing?).
7. **Auto-categorize** new data into revenue/inventory/cost/forecast buckets without being asked; surface burn rate and cup mix % in the audit summary.

### Hybrid COGS Allocation (ADR 0001, restated)
- Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple): allocate by **actual usage**.
- Packaging, Ice, generic Stock: allocate by **revenue share**.
- OPEX category `Rental` is kept separate from other OPEX in dashboard/P&L. Split slips (e.g. one slip covering both rent and stock) must be partitioned into separate entries before entry.

### Known Expense-Categorization Pitfalls (learned from Jan–Jun26 audit, Jul 2026)
- **Generic "Stock" bulk-purchase entries are COGS, category `Stock`** — not `OPEX/Investment` and not `CAPEX`. `CAPEX/Investment` is reserved for genuine equipment/fixtures only (kiosk build-out, signage, extraction machine, renovation). If a slip note matches คีออส/ป้าย/เครื่องสกัด/ตกแต่ง but is really a bulk ice/packaging/mixed-supply restock, it's `COGS/Stock`, not `Investment`.
- **Partner profit-share payouts must NEVER be recorded as an expense** (not COGS, not OPEX). Transfers noting a % split (e.g. "ส่วนแบ่ง60เปอ") are distributions made *after* net profit is calculated — booking them as an expense double-subtracts them from net profit before the `PROFIT_SHARE_RATIO` split even runs. If found miscategorized, zero out the amount and mark bucket `EXCLUDED` / category `Profit Distribution` rather than moving them to another expense bucket.
- **A legacy/unexplained "Ice" mis-tag exists on ~24 historical rows (Jan–Jun26)** that have no ice content at all (tolls, medical bills, hardware, electricity, a pushcart, even the profit-share payouts above) — `categorize()` in `process_expenses.js` doesn't currently produce this behavior for those inputs, so treat any `COGS/Ice` row with a non-ice-sounding description as suspect and verify against the source slip image before trusting it.
- Full audit + corrections trail for this cleanup: see git history around Jul 2026 touching `3_Automation_Dashboard/SomSaiJai_Dashboard_B1_2026.xlsx`, `SomSaiJai_Dashboard_B2_2026.xlsx`, and `Sales_System_Automation/manual_expenses.json` (Daily_Expenses sheet edits, 34 corrections across Jan–Jun26 B1/B2).
