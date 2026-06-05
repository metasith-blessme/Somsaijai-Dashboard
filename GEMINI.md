# SomSaiJai Automation System (Multi-Branch)

This project automates data extraction and visualization for SomSaiJai across multiple branches.
**Live dashboard:** https://somsaijailive.vercel.app (v3.2.0 — mobile-responsive)

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

## Business Rules & Profit Sharing
- **Branch 1 (B1):** Profit shared at **60%** of Net Profit to Blessme.
- **Branch 2 (B2):** Profit shared at **70%** of Net Profit to Blessme.
- **Shared COGS:** Fruit, Ice, and Packaging costs are calculated globally and shared proportionally based on branch revenue.

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
