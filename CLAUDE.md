# CLAUDE.md

This file provides guidance for AI agents working in this multi-branch repository.

## Project Overview
Sales data analysis and unified dashboard for **Som Sai Jai** Juice Bar (Branches B1, B2, and B3).
**Live dashboard:** https://somsaijailive.vercel.app

## Tech Stack
- **Frontend:** Vanilla JS, Chart.js (client-side dynamic aggregation).
- **Backend:** Node.js (automation scripts), `xlsx` (Excel processing).
- **OCR:** Swift-based `ocr_bin` + Gemini Vision AI for image extraction.

## Command Reference (Run from `3_Automation_Dashboard/`)

```bash
# Process sales images for a specific branch/month
npm run process-sales Jul26 B1
npm run process-sales Jul26 B2
npm run process-sales Jul26 B3

# Push verified staging data to branch Excels
npm run verify-sales

# Sync Excels to data.json and deploy to Vercel
npm run update-dashboard

# Record shared stock purchase
npm run stock-in orange 50
```

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

## Branch Specifics
- **B1:** Main branch (operating since Jan 2026). Fixed costs: Rent ฿35,000, Salary ฿35,000, Utilities ฿4,000.
- **B2:** Branch 2 (opened April 18, 2026). Fixed costs: Rent ฿25,000 (Jul–Sep discounted rate, normally ฿30,000), Salary ฿30,000, Utilities ฿4,000.
- **B3 (Platinum Pop):** Branch 3 (opened July 11, 2026). Fixed costs: Rent ฿19,000, Salary ฿46,500 (3 staff × ฿500/day × 31 days), Utilities ฿4,000.
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
