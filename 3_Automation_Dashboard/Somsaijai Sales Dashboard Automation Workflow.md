# Somsaijai Sales Dashboard Automation Workflow

This document explains the step-by-step process followed when you upload sales report images and request an update and publication of the dashboard.

## 1. Visual OCR Extraction (The "Read" Phase)
- **Discovery:** I scan the specified month's folder (e.g., `Mar26/`) for any new image files.
- **Visual OCR:** Using the `Read` tool, I visually inspect each handwritten report. I look for:
    - **Top Section:** Tally marks for product cups and payment methods (Cash/Scan).
    - **Right Section:** Written totals for "All" (Revenue), "Cash", and "Expenses".
    - **Bottom-Left:** Quantities of ingredients used (e.g., Orange baskets, Watermelon pieces).
- **Verification:** I cross-check the math: `Total Revenue = Cash + Scan`. If the handwritten math is off, I note the discrepancy but prefer the explicitly written totals.

## 2. Master Data Update (`data.json`)
- **JSON Structure:** I convert the visual data into a structured JSON entry in `data.json`.
- **Fields:** I populate fields like `rev`, `cash`, `exp`, `scan`, and cup counts (`or`, `wm`, `mg`, etc.).
- **Net Calculation:** I calculate the `net` value as `Cash - Expenses`.

## 3. Excel Workbook Synchronization
- **File:** `SomSaiJai_Dashboard_2026.xlsx`
- **Automation:** I use a Python script (`openpyxl`) to:
    1. Identify the correct monthly sheet (e.g., `Mar26`).
    2. Locate the "TOTAL" and "AVG/DAY" rows.
    3. Insert a new data row *above* the summary rows.
    4. Update the `SUM` and `AVERAGE` formulas to include the new row.
    5. Match the formatting (fonts, colors, borders) of previous rows.

## 4. HTML Dashboard Update
- **Two Dashboard Versions:**
    - **`index.html`:** A dynamic dashboard that fetches data from `data.json` every time it's opened. This is the primary web version.
    - **`SomSaiJai_Dashboard.html`:** A standalone version with data embedded directly into a JavaScript constant (`BUILT_IN`). I update this using regex to ensure it works offline.
- **Charts & KPIs:** Both dashboards automatically recalculate trends and charts once the underlying data (JSON or embedded) is updated.

## 5. Deployment (Public Access)
- **Tool:** Vercel
- **Command:** `npx vercel --prod`
- **Process:** I deploy the dashboard to Vercel production. This makes the `index.html` and `data.json` accessible at [https://somsaijailive.vercel.app](https://somsaijailive.vercel.app).

## 6. Cleanup & Maintenance
- **Pending Verification:** I clear `pending_verification.json` to remove any temporary or incorrect extractions.
- **Log Files:** I check `update_log.log` and `update_error.log` to ensure the automation scripts ran successfully without silent failures.

---
**Current URL:** [https://somsaijailive.vercel.app](https://somsaijailive.vercel.app)
