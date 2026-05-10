# Vercel Deployment Migration (CRITICAL)

As of May 2026, the project has fully migrated to **Vercel** for hosting.

## 🚀 Deployment Truths
- **Primary URL:** [https://somsaijailive.vercel.app](https://somsaijailive.vercel.app)
- **Deployment Tool:** Vercel CLI (`vercel --prod`)
- **Automation:** Triggered by `3_Automation_Dashboard/Sales_System_Automation/ocr-sales-dashboard/scripts/update_dashboard.js`.

## 🛑 Abandoned Tools
- **Surge.sh:** DO NOT use Surge for deployment. Any previous references to `somsaijai-2026.surge.sh` or similar are OUTDATED.
- **Old Paths:** The `Sale report/` directory is deprecated. Always use `3_Automation_Dashboard/`.

## 🛠 Required Actions
- All automated updates must run from the `3_Automation_Dashboard` directory.
- The `update-dashboard` script in `package.json` is the source of truth for syncing Excel to JSON and deploying.
