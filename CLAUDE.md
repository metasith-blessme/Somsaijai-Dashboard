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

## Branch Specifics
- **B1:** Main branch (data from Jan 2026).
- **B2:** Opened April 18, 2026.
- **Switching:** UI handles branch switching via `currentBranch` state. `getCleanSales()` handles aggregation for the 'all' view.
