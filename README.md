# Som Sai Jai Dashboard

Sales data analysis and unified dashboard for **Som Sai Jai** Juice Bar, tracking two branches (B1 and B2).

**Live dashboard:** https://somsaijailive.vercel.app

## Tech Stack

- **Frontend:** Vanilla JS, Chart.js (client-side aggregation)
- **Backend:** Node.js automation scripts, `xlsx` for Excel processing
- **OCR:** Swift-based `ocr_bin` for local receipt/slip image processing

## Project Structure

```
3_Automation_Dashboard/       # dashboard app + automation pipeline
  SomSaiJai_Dashboard_B1_2026.xlsx  # source of truth, branch 1
  SomSaiJai_Dashboard_B2_2026.xlsx  # source of truth, branch 2
  data.json                         # generated from the Excel files
  reports_data.json                 # generated P&L / report rollups
  index.html                        # dashboard UI
  Sales_System_Automation/          # OCR + processing scripts
B1/, B2/                       # raw sales & expense receipt photos, by branch/month
docs/                          # reference docs and templates
```

## Commands

Run from `3_Automation_Dashboard/`:

```bash
npm run process-sales Apr26 B1   # OCR-extract sales images for a branch/month
npm run process-sales Apr26 B2

npm run verify-sales             # push verified staging data into the branch Excel files

npm run update-dashboard         # sync Excel -> data.json/reports_data.json -> deploy to Vercel

npm run stock-in orange 50       # record a shared stock purchase
```

## Data Principles

- **Source of truth:** the two branch Excel files. `data.json` and `reports_data.json` are always regenerated from them — never edited directly.
- **Anti-cheat:** every daily sales entry carries a `theoretical_rev` calculation to catch under-reporting.
- **Shared inventory:** both branches draw from one central stock pool tracked in `stock_ledger.json`.
- **Date format:** always `DD/MM/YYYY`.
- **Hybrid COGS allocation (ADR 0001):**
  - Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) are allocated by actual usage.
  - Packaging, Ice, and generic Stock are allocated by revenue share.
- **OPEX rental separation:** Rental is tracked separately from other OPEX in reports and the dashboard. A slip covering both rent and stock must be split into separate line items.
- **Duplicate-expense check:** `update-dashboard` automatically flags any same-branch/date/category/amount expense group so double-entered receipts get caught before they skew a report.

## Branches

| Branch | Notes | Profit share to Blessme |
|---|---|---|
| B1 | Main branch, operating since Jan 2026 | 60% |
| B2 | Opened April 18, 2026 | 70% |

## Sales Data Verification Workflow

When processing new sale images or expense slips:

1. Plan the batch and get it approved before touching any files.
2. Never write directly to `data.json` — it's fully overwritten by `update-dashboard`.
3. Stage new records in `pending_verification.json`, run `verify-sales` to push them into the Excel files, then run `update-dashboard` to regenerate and deploy.
4. Present an audit table (`Date | Revenue | Cash | Scan | Expense | Net | Verify`) before writing anything.
5. If individual cup counts disagree with a written total, ask before deciding which to trust.
6. If a cost figure changes, confirm whether it replaces or adds to the existing figure before writing.
