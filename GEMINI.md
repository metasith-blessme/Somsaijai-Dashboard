# SomSaiJai Automation System (Multi-Branch)

This project automates data extraction and visualization for SomSaiJai across multiple branches.
**Live dashboard:** https://somsaijailive.vercel.app (v3.2.2 — mobile-responsive)

## Project Structure
- `B1/`: Branch 1 Data
  - `1_Sale/`: Monthly sales report images (LINE photos).
  - `2_Expenses/`: Monthly expense receipt images.
- `B2/`: Branch 2 Data
  - `1_Sale/`: Monthly sales report images.
  - `2_Expenses/`: Monthly expense receipt images.
- `3_Automation_Dashboard/`: 
  - Automation scripts (`Sales_System_Automation/`).
  - Master Excels (`SomSaiJai_Dashboard_B[X]_2026.xlsx`) — **Source of Truth per Branch**.
  - HTML Dashboard (`index.html`) — Unified "Premium Glass" UI, mobile-responsive with hamburger nav.
  - Deployment Config (`vercel.json`) — Essential for routing and cache stability.
  - Data storage (`data.json`, `reports_data.json`, `pending_verification.json`, `stock_ledger.json`).

## CRITICAL: Data Flow
**NEVER write directly to `data.json`** — `npm run update-dashboard` reads from Branch Excels and overwrites it.

```
LINE images → Visual OCR → pending_verification.json → verify-sales → Excel → update-dashboard → data.json + Vercel deploy
```

When processing new sale images:
1. Present the plan for the batch and wait for approval before touching any files.
2. Extract `rev`, `cash`, `scan`, `exp`, cup counts, raw materials used.
3. If a circled/written total disagrees with the sum of individual cup counts, ask the user which to use — never decide unilaterally.
4. Present an audit table (`Date | Revenue | Cash | Scan | Expense | Net | Verify ✓/✗`) before writing anything, even for a single day.
5. If the user reports an updated cost figure, ask whether it replaces the existing value or is additive before writing.

## Business Rules & Profit Sharing
- **Branch 1 (B1):** Profit shared at **60%** of Net Profit to Blessme, and **40%** to Ming. Rent is ฿31,000, Salary ฿35,000, Utilities ฿6,000.
- **Branch 2 (B2):** Profit shared at **70%** of Net Profit to Blessme, and **30%** to Ming. Rent is ฿18,000, Salary ฿30,000, Utilities ฿6,000.
- **Shared COGS (ADR 0001):** 
  - Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) are allocated proportionally by **actual usage count** of each branch.
  - Packaging, Ice, and generic Stock (e.g. ฿12k Stock split) are allocated proportionally by **revenue share**.
- **OPEX Rental Separation:**
  - OPEX expenses categorized as `Rental` are separated from other general operating expenses (Other OPEX) in the dashboard P&L summaries and management report sections.
  - Split slips (e.g., slip #15 containing ฿35k B1 Rent and ฿12k Stock) are divided into distinct daily expense rows.
- **Net Loss Carry-Forward (ADR 0002):** Branch losses carried forward to offset future profit of that branch only.

### Known Expense-Categorization Pitfalls (learned from Jan–Jun26 audit, Jul 2026)
- **Generic "Stock" bulk-purchase entries are COGS, category `Stock`** — not `OPEX/Investment` and not `CAPEX`. `CAPEX/Investment` is reserved for genuine equipment/fixtures only (kiosk build-out, signage, extraction machine, renovation).
- **Partner profit-share payouts must NEVER be recorded as an expense** (not COGS, not OPEX). Transfers noting a % split (e.g. "ส่วนแบ่ง60เปอ") are distributions made *after* net profit is calculated — booking them as an expense double-subtracts them before the profit-share ratio even runs. If found miscategorized, zero the amount and mark bucket `EXCLUDED` / category `Profit Distribution`.
- **A legacy/unexplained "Ice" mis-tag existed on ~24 historical rows (Jan–Jun26)** with no ice content at all (tolls, medical bills, hardware, electricity, a pushcart, even profit-share payouts). Treat any `COGS/Ice` row with a non-ice-sounding description as suspect and verify against the source slip image.

## Execution Workflow (from `3_Automation_Dashboard/`)

**Autonomous 4-Agent Pipeline**
We have consolidated the workflow into a single command that runs 4 specialized AI agents (ImageExtractor, DataSync, DocGen, QADeployer) in sequence.

To process new sales images and deploy the entire system automatically:
```bash
cd 3_Automation_Dashboard
npm run pipeline ../B1/1_Sale/May26/LINE_ALBUM_xxxx.jpg
```

**What this command does:**
1. **Agent 1:** OCR extracts data & derives math.
2. **Agent 2:** Syncs to B1/B2 Excel and `data.json`.
3. **Agent 3:** Rebuilds Word documents via Python.
4. **Agent 4:** Deploys live to Vercel and runs sanity checks.

**Manual commands:**
```bash
cd 3_Automation_Dashboard
npm run process-sales Mar26     # OCR process specific month
npm run verify-sales            # Verify pending data
npm run update-dashboard        # Rebuild data.json from Excel
npm run deploy                  # Deploy to Vercel
```

## Dashboard Features
- **Multi-Branch Toggling:** View Branch 1, Branch 2, or Aggregated "All Branches" data.
- **Mobile-Responsive:** Hamburger menu on phones (≤768px), collapsed sidebar on tablets (≤1024px).
- **Advanced BI Analytics:**
  - **Product Velocity:** Revenue mix % per SKU.
  - **Liquidity Ratio:** Cash vs. Scan ratio.
  - **Inventory Yield:** Cups sold per raw material unit.
  - **Net Contribution:** Revenue minus Variable Costs (Ice + Raw Materials).
- **Management Reports:** 8-section P&L with COGS breakdown, audit reconciliation, fruit ROI analysis.
- **Shared Stock System:** Live inventory deductions combine usage from ALL branches.

## Architecture Notes
- Each branch has its own Excel file for safety and isolation.
- `update_dashboard.js` dynamically maps columns (handles format changes between Q1 and Q2).
- `stock_ledger.json` is the global pool for physical checks and purchases.
- Dashboard CSS includes `glass-card`, `kpi-row`, responsive breakpoints at 1024px and 768px.
- Fixed costs are in `PARAMS.fixed` object in `index.html` — update when rent/salary changes.
