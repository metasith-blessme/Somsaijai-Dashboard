# SomSaiJai Automation System (Multi-Branch)

This project automates data extraction and visualization for SomSaiJai across multiple branches (B1, B2, B3).
**Live dashboard:** https://somsaijailive.vercel.app (v3.2.2 — mobile-responsive)

## Project Structure
- `B1/`: Branch 1 Data (operating since Jan 2026)
  - `1_Sale/`: Monthly sales report images (LINE photos).
  - `2_Expenses/`: Monthly expense receipt images.
- `B2/`: Branch 2 Data (opened 18 Apr 2026)
  - `1_Sale/`: Monthly sales report images.
  - `2_Expenses/`: Monthly expense receipt images.
- `B3/`: Branch 3 Data (opened 11 Jul 2026 — Platinum Pop)
  - `1_Sale/`: Monthly sales report images.
  - `2_Expenses/`: Monthly expense receipt images.
- `3_Automation_Dashboard/`: 
  - Automation scripts (`Sales_System_Automation/`).
  - Master Excels (`SomSaiJai_Dashboard_B1_2026.xlsx`, `SomSaiJai_Dashboard_B2_2026.xlsx`, `SomSaiJai_Dashboard_B3_2026.xlsx`) — **Source of Truth per Branch**.
  - HTML Dashboard (`index.html`) — Unified "Premium Glass" UI, mobile-responsive with multi-branch toggles.
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
- **Profit share (effective-dated):** From **Jul26 onward, 70% Blessme / 30% Ming on all branches**. Before Jul26, B1 was 60/40; B2/B3 were already 70/30. Decided solely by `profitShareFor(branch, month)` in `business_rules.js`; never apply a new rate retroactively to a closed month.
- **Branch 1 (B1):** Rent ฿35,000, Salary ฿35,000, Utilities ฿4,000 (Total fixed: ฿74,000/mo).
- **Branch 2 (B2):** Rent ฿25,000 (Jul–Sep discounted rate, normally ฿30,000), Salary ฿30,000, Utilities ฿4,000 (Total fixed: ฿59,000/mo).
- **Branch 3 (B3 - Platinum Pop):** Rent ฿19,000, Salary ฿46,500 (3 staff × ฿500/day × 31 days), Utilities ฿4,000 (Total fixed: ฿69,500/mo).
- **Shared Costs & Stock Rental (ADR 0001):** 
  - Fruits (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) are allocated proportionally by **actual usage count** of each branch.
  - For POS-only reporting branches without daily paper tallies (like B3), raw material usage is derived from revenue and product mix so that fruit COGS is allocated fairly.
  - Packaging, Ice, and generic Stock / Shared Rentals (e.g. ฿12k Stock Rent split ฿4k B1 / ฿4k B2 / ฿4k B3) are allocated proportionally by **revenue share** or explicitly partitioned.
- **OPEX Rental Separation:**
  - OPEX expenses categorized as `Rental` are separated from general operating expenses (Other OPEX) in P&L summaries and management reports.
- **Net Loss Carry-Forward (ADR 0002):** Branch losses carried forward to offset future profit of that branch only.

### Known Expense-Categorization Pitfalls (learned from Jan–Jul26 audit)
- **Generic "Stock" bulk-purchase entries are COGS, category `Stock`** — not `OPEX/Investment` and not `CAPEX`. `CAPEX/Investment` is reserved for genuine equipment/fixtures only (kiosk build-out, signage, extraction machine, renovation).
- **Partner profit-share payouts must NEVER be recorded as an expense** (not COGS, not OPEX). Transfers noting a % split (e.g. "ส่วนแบ่ง60เปอ") are distributions made *after* net profit is calculated — set bucket `EXCLUDED` / category `Profit Distribution`.

## Execution Workflow (from `3_Automation_Dashboard/`)

**Autonomous 4-Agent Pipeline**
```bash
cd 3_Automation_Dashboard
npm run pipeline ../B1/1_Sale/May26/LINE_ALBUM_xxxx.jpg
```

**Manual commands:**
```bash
cd 3_Automation_Dashboard
npm run process-sales Jul26 B1   # OCR process specific month+branch
npm run verify-sales             # Verify pending data
npm run update-dashboard         # Rebuild data.json from Excel & deploy
npm run deploy                   # Deploy to Vercel
```

## Dashboard Features
- **Multi-Branch Toggling:** View Branch 1, Branch 2, Branch 3, or Aggregated "All Branches" data.
- **Mobile-Responsive:** Hamburger menu on phones (≤768px), collapsed sidebar on tablets (≤1024px).
- **Management Reports:** 8-section P&L with COGS breakdown, audit reconciliation, fruit ROI analysis across B1, B2, B3.
