# Technical Debt: Report Generation

Prior to May 5, 2026, the `gen_report.js` script used a hardcoded list of months. This caused the "Report" section of the dashboard to stay stuck on April even when May data was processed.

## 🛠 Fix Applied
1. **Dynamic Month Discovery:** `gen_report.js` now scans `data.json` to find all months with sales data automatically.
2. **Integrated Workflow:** `update_dashboard.js` now calls `node gen_report.js` before every Vercel deployment.

## 💡 Lesson Learned
Avoid hardcoding temporal data (months, years) in scripts that manage recurring updates. Always derive the scope from the data itself.
