---
name: ocr-sales-dashboard
description: OCR-based sales reporting and dashboarding workflow. Use to extract sales data from images, verify it via a staging layer, and update the master Excel file and HTML dashboard for Som Sai Jai.
---

# Som Sai Jai Sales Dashboard Skill

This skill automates the end-to-end sales reporting workflow, from OCR extraction to dashboard updates.

## Workflow

### 1. Extraction & Staging (OCR)
Extract data from report images using fuzzy matching to handle handwriting inconsistencies.
- **Action**: Run `node scripts/process_sales.js <Month>` (e.g., `Mar26`).
- **Output**: Generates `pending_verification.json`.

### 2. Manual Verification
Review the extracted data for accuracy before committing to the master records.
- **Action**: Open `pending_verification.json`, review fields, and set `"verified": true` for correct records.

### 3. Master Data Commit
Merge verified records into the master Excel file and recalculate monthly statistics.
- **Action**: Run `node scripts/verify_sales.js`.
- **Output**: Updates `SomSaiJai_Dashboard_2026.xlsx`.

### 4. Dashboard Refresh
Update the web-based dashboard and deploy to production.
- **Action**: Run `node scripts/update_dashboard.js`.
- **Output**: Updates `data.json` and deploys to `https://somsaijailive.vercel.app`.

## Resource Map
- **Scripts**:
  - `process_sales.js`: OCR and Fuzzy Matching logic.
  - `verify_sales.js`: Excel merging and stats calculation.
  - `update_dashboard.js`: Excel to JSON sync and Surge deployment.
- **Reference**:
  - `references/excel_schema.md`: Layout of the master Excel workbook.

## Troubleshooting
- **Fuzzy Match Issues**: If a product name is missed, adjust the threshold in `process_sales.js`.
- **DNS Errors**: If the Surge site shows NXDOMAIN, re-run Step 4 to refresh the deployment.
