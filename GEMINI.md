# SomSaiJai Automation System (Multi-Branch)

This project automates data extraction and visualization for SomSaiJai across multiple branches.
**Live dashboard:** https://somsaijailive.vercel.app

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
  - HTML Dashboard (`index.html`) — Unified multi-branch UI.
  - Data storage (`data.json`, `pending_verification.json`, `stock_ledger.json`).

## CRITICAL: Data Flow
**NEVER write directly to `data.json`** — `npm run update-dashboard` reads from Branch Excels and overwrites it.

```
LINE images → Visual OCR → pending_verification.json → verify-sales → Excel → update-dashboard → data.json + Vercel deploy
```

## Execution Workflow (from `3_Automation_Dashboard/`)

### 1. Process New Sales
`npm run process-sales [Month] [Branch]`
Example: `npm run process-sales Apr26 B2` (Scans images in `B2/1_Sale/Apr26/`)

### 2. Verify & Push to Excel
Review `pending_verification.json`, ensure `"verified": true`, then:
`npm run verify-sales`
*This automatically routes data to B1 or B2 Excel files based on the branch tag.*

### 3. Update & Deploy Dashboard
Sync all Branch Excels → unified `data.json` → auto-generate `reports_data.json` → deploy to Vercel:
`npm run update-dashboard`
*Note: This command now automatically handles report generation for all active months.*

## Dashboard Features
- **Multi-Branch Toggling:** View Branch 1, Branch 2, or Aggregated "All Branches" data.
- **Advanced BI Analytics:**
  - **Product Velocity:** Revenue mix % per SKU.
  - **Liquidity Ratio:** Cash vs. Scan ratio.
  - **Inventory Yield:** Cups sold per raw material unit.
  - **Net Contribution:** Revenue minus Variable Costs (Ice + Raw Materials).
- **Shared Stock System:** Live inventory deductions combine usage from ALL branches.

## Architecture Notes
- Each branch has its own Excel file for safety and isolation.
- `update_dashboard.js` dynamically maps columns (handles format changes between Q1 and Q2).
- `stock_ledger.json` is the global pool for physical checks and purchases.
