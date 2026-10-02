# SomSaiJai Automation System (Multi-Branch)

This project automates data extraction, audit verification, financial accounting, and visualization for **SomSaiJai** Juice Bar across 4 branches (**B1, B2, B3, B4**).
**Live dashboard:** https://somsaijailive.vercel.app (Unified Premium Glass UI, mobile-responsive)

---

## 1. Project & Directory Structure

```
├── B1/                                # Branch 1 (Operating since Jan 2026)
│   ├── 1_Sale/                        # Monthly sales report photos (LINE albums / raw images)
│   └── 2_Expenses/                    # Monthly expense slips & receipts
├── B2/                                # Branch 2 (Opened 18 Apr 2026)
│   ├── 1_Sale/                        # Daily sales reports (A4 sheets & slips)
│   └── 2_Expenses/                    # Expense receipts (often centralized via B1/owner)
├── B3/                                # Branch 3 - Platinum Pop (Opened 11 Jul 2026)
│   ├── 1_Sale/                        # Daily shop reports & POS exports
│   └── 2_Expenses/                    # Direct B3 expenses (rent, electricity, durian, sticky rice)
├── B4/                                # Branch 4 (Opened September 2026)
│   ├── sale/                          # Daily sales slips & reports
│   └── expenses/                      # Setup capital & branch operating expenses
├── Bank Statement/                    # Password-protected bank statement PDFs (source evidence)
├── docs/                              # Mandatory standard operating procedures & audit guidelines
│   ├── OCR_RULES.md                   # Strict OCR transcription & anti-hallucination rules
│   ├── OCR_TO_DASHBOARD_WORKFLOW.md   # Step-by-step gatekeeper workflow
│   └── SOMSAIJAI_SALES_EXTRACTOR.md   # Form field schemas & extraction guidelines
└── 3_Automation_Dashboard/            # Core processing engine & master books
    ├── SomSaiJai_Dashboard_B1_2026.xlsx  # Master Source of Truth for B1
    ├── SomSaiJai_Dashboard_B2_2026.xlsx  # Master Source of Truth for B2
    ├── SomSaiJai_Dashboard_B3_2026.xlsx  # Master Source of Truth for B3
    ├── SomSaiJai_Dashboard_B4_2026.xlsx  # Master Source of Truth for B4
    ├── Sales_System_Automation/       # Logic engine (business_rules.js, pricing, audit)
    ├── audit/                         # Audit packages, manifests, and transcriptions
    ├── data.json                      # Machine-generated intermediate data
    ├── reports_data.json              # Final calculated P&L, COGS, and metrics
    ├── index.html                     # Live dashboard template
    └── SomSaiJai_Dashboard.html       # Generated standalone dashboard mirror
```

---

## 2. Core Architecture & Data Flow

### The Excel Workbooks are the Single Source of Truth
**NEVER write directly to `data.json` or `reports_data.json`.** They are completely overwritten on every build:

```
Source Images (Slips / A4 / POS)
       │
       ▼ (Follow docs/OCR_RULES.md & docs/OCR_TO_DASHBOARD_WORKFLOW.md)
Human-Verified Transcriptions (JSON Manifest in audit/)
       │
       ▼ (Safe commit / safe_import scripts)
Master Excel Workbooks (B1, B2, B3, B4)
       │
       ▼ update_dashboard.js / extractSheetData()
data.json (Raw sales rows + normalized expenses)
       │
       ▼ gen_report.js / calculatePL()
reports_data.json (Hybrid COGS allocation + P&L math)
       │
       ▼ sync_dashboard_html.js
SomSaiJai_Dashboard.html (Embedded backup) + index.html
       │
       ▼ npx vercel --prod
Live Production Dashboard (somsaijailive.vercel.app)
```

---

## 3. Branch Profiles & Cost Structures

### Branch 1 (B1) — Flagship
- **Operating:** Since January 2026
- **Base Rent:** ฿35,000 / month
- **September Staff Salary:** ฿25,500 (Aye ฿13,500 + Kyaw ฿12,000)
- **Central Fruit Purchaser:** Historical central fruit and bulk packaging purchase slips are processed through B1’s account and allocated via usage/revenue share.

### Branch 2 (B2)
- **Operating:** Since 18 April 2026
- **Rent:** ฿25,000 / month (Discounted Jul–Sep rate; normally ฿30,000)
- **September Staff Salary:** ฿22,800 (Hpai ฿11,200 + Myat ฿11,600)
- **September Operating Days:** 29 days (20, 21, and 22 September integrated; only 26 September missing).

### Branch 3 (B3) — Platinum Pop
- **Operating:** Since 11 July 2026
- **Rent:** Set by commercial lease (Quotation MWA01, 6.04 m², นายฐิติภูมิ สิงห์สา):
  - 10–31 Jul 2026: ฿13,146.16
  - 1 Aug 2026 – 30 Jun 2027: **฿18,780.22 / month** (Rent ฿15,100 + 7% VAT + common area ฿340/m² + insurance ฿230/m²).
  - Deposit: ฿48,471 (asset/CAPEX, not OPEX).
- **September Staff Salary:** ฿45,000 (Arkar ฿15,000 + HtunKyaw ฿15,000 + Tae ฿15,000).
- **Direct Utilities:** Direct electricity metered & billed (e.g., Aug billed in Sep: ฿1,592.22).
- **Direct Products:** Fresh Durian and Mango Sticky Rice sales/costs are direct to B3.

### Branch 4 (B4)
- **Operating:** Opened September 2026 (10 operational days in Sep26).
- **Rent:** ฿22,966.67 / month (Full monthly charge booked in Sep per Option A).
- **September Staff Salary:** ฿10,000 (Chan ฿4,800 + Phyo ฿5,200).
- **Initial Setup / CAPEX:** ฿6,000 (police/permits) + ฿3,008 (electrical/fixtures).

---

## 4. Shared Cost Allocation Rules (ADR 0001 & ADR 0002)

1. **Fruit COGS (Hybrid Allocation):**
   - Direct fresh fruit (Orange, Watermelon, Mango, Apple, Coconut, Guava, Pineapple) purchased in central batches is allocated strictly by **actual cup/unit usage count** recorded on branch daily reports.
   - For POS-only reporting without tally sheets, consumption is derived from product sales mix.
2. **Packaging, Supplies & Logistics:**
   - Cups, lids, straws, bags, and logistics are allocated proportionally by **gross revenue share**.
3. **Central Storage Rental (฿12,000 / month):**
   - **Shared equally among active branches:**
     - With 3 operating branches (Jun–Aug 2026): **฿4,000** each (B1, B2, B3).
     - With 4 operating branches (Sep 2026 onward): **฿3,000** each (B1, B2, B3, B4).
4. **Central Management Wage (Ming):**
   - Resumed from August 2026 at **฿20,000 / month** as shared `OPEX/Salary`.
   - Aug 2026 (3 branches): ฿6,666.67 each (B1, B2, B3).
   - Sep 2026 onward (4 branches): **฿5,000 each** (B1, B2, B3, B4).
5. **Net Loss Carry-Forward (ADR 0002):**
   - Monthly operating losses in a branch carry forward solely against future profits of *that specific branch*.

---

## 5. Profit Sharing & Partner Distributions

- **Effective Rate:**
  - **From Jul26 onward: 70% Blessme / 30% Ming across all branches.**
  - Before Jul26: B1 was 60/40; B2 and B3 were 70/30.
  - Regulated strictly by `profitShareFor(branch, month)` in `business_rules.js` — never edit historical closed months.
- **Excluded Distributions:**
  - Partner profit distributions (e.g. transfers marked "ส่วนแบ่ง 60%", dividends, or capital withdrawals) are distributions of net profit, **never COGS or OPEX**.
  - Must always be classified as `bucket: EXCLUDED`, `cat: Profit Distribution`, `amt: 0` in P&L reporting.

---

## 6. Daily Sales & Expense Accounting Rules

1. **The Ice Expense Rule:**
   - Staff buy daily ice from shift cash.
   - **Gross Revenue = Cash Sales + Scan/Transfer Sales.**
   - Ice is a shift expense (`Expenses (฿)`), and Net Cash = Cash - Ice.
   - Never deduct ice from gross sales.
2. **Anti-Hallucination & Empty Cells:**
   - Unknown values must remain `null` or empty, never assumed to be zero.
   - Scan sales may only be derived as `Revenue - Cash` if cash was positively recorded. If both are blank, channel split is unknown.
3. **Theoretical vs Reported Revenue:**
   - Every daily report computes theoretical revenue = $\sum (\text{Qty} \times \text{Price})$.
   - Any variance between theoretical revenue and reported cash+scan is audited and flagged.

---

## 7. Standard Execution & Deployment Commands

Run all commands from `3_Automation_Dashboard/`:

```bash
cd 3_Automation_Dashboard

# 1. Run full test suite (regression & financial integrity)
npm test

# 2. Update master data & rebuild P&L reports (without deploying)
node Sales_System_Automation/ocr-sales-dashboard/scripts/update_dashboard.js --no-deploy

# 3. Full update & deploy to live production
npm run update-dashboard

# Or manual deploy:
npx vercel --prod
```

### Key Verification Scripts & Tests
- `npm test`: Runs `test_expense_rules.js`, `test_parse_note.js`, `test_financial_integrity.js`, and `test_render_finance.js`.
- `node commit_sep26.js`: Commits September 2026 audited sales and expenses into all 4 master Excel workbooks.
- `safe_import_expenses.js` / `safe_import_sales.js`: Transactional, idempotent workbook importers with rollback safeguards.
