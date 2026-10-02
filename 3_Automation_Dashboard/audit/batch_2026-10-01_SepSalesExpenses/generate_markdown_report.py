import json, os

AUDIT_DIR = "3_Automation_Dashboard/audit/batch_2026-10-01_SepSalesExpenses"

# Load files
b1 = json.load(open(os.path.join(AUDIT_DIR, "b1_sales_transcription.json")))["transcriptions"]
b2 = json.load(open(os.path.join(AUDIT_DIR, "b2_sales_transcription.json")))["records"]
b3 = json.load(open(os.path.join(AUDIT_DIR, "b3_sales_transcription.json")))["records"]
b4_data = json.load(open(os.path.join(AUDIT_DIR, "b4_sales_transcription.json")))
b4 = b4_data["records"]

# Base daily rows for B1, B2, B3
exec(open("3_Automation_Dashboard/audit/batch_2026-10-01_SepSalesExpenses/build_review_package.py").read())

md = []
md.append("# Comprehensive Audit & Review Package: SomSaiJai September 2026 (4 Branches)")
md.append("**Status:** `READ-ONLY AUDIT REVIEW` | `review.import_allowed: false`  ")
md.append("**Last Updated:** 2026-10-02 11:35 (Incorporating Branch 4 operating sales, exact payroll, and storage rental)  ")
md.append("**Governance Compliance:** `CLAUDE.md`, `docs/OCR_RULES.md`, `docs/OCR_TO_DASHBOARD_WORKFLOW.md`, `docs/SOMSAIJAI_SALES_EXTRACTOR.md`  ")
md.append("\n> **CRITICAL GATE NOTICE:** This document is an audit review and reconciliation package. No financial writes to Excel (`SomSaiJai_Dashboard_B*.xlsx`), updates to master JSON (`data.json`, `reports_data.json`), or deployments have occurred. All data remains in staging awaiting final owner approval.\n")

md.append("---")
md.append("## 1. Executive Summary & Multi-Branch Operating Overview")
md.append("In September 2026, **SomSaiJai operated across 4 branches**:")
md.append("- **Branch 1 (B1):** Full month (30 days) — ฿135,223.00 gross sales.")
md.append("- **Branch 2 (B2):** 26 operating days (4 missing calendar dates) — ฿48,860.00 gross sales.")
md.append("- **Branch 3 (B3):** Full month (30 days) — ฿161,444.00 gross sales (first month with handwritten daily logs).")
md.append("- **Branch 4 (B4 / B-5):** Soft opening trial (10 unique operating days evidenced) — ฿12,435.00 gross sales.")
md.append("- **Combined 4-Branch Gross Revenue:** **฿357,962.00** across **96 operating days**.")

md.append("\n---")
md.append("## 2. Source Intake Updates & Evidence Log")
md.append("1. **Branch 4 Sales Added (`B4/sale/Sep26/`):** 11 images verified. Registered with SHA-256 hashes in `manifest.json`. Image 5 and Image 6 are confirmed duplicate photos of the same shift (25/09/2026), yielding 10 unique evidenced operating shifts.")
md.append("2. **Cut Internal Transfers:** Slips 2 (฿4,760.00) and 70 (฿3,910.00) confirmed as internal transfers and removed.")
md.append("3. **Added Slip 1 (`IMG_3013.JPG`):** ฿2,750.00 Mango 50kg (29/09/2026, LINE Pay QR) added to active Mango pool.")
md.append("4. **Added Slip 2 (`IMG_3033.JPG`):** ฿72,044.00 bank transfer for staff payroll (30/09/2026, Aung Min Phay Son).")
md.append("5. **Authoritative Staff Payroll Schedule:** Exact payroll breakdown provided by owner:")
md.append("   - **B1 Staff Payroll:** Aye ฿13,500 + Kyaw ฿12,000 = **฿25,500.00**")
md.append("   - **B2 Staff Payroll:** Hpai ฿11,200 + Myat ฿11,600 = **฿22,800.00**")
md.append("   - **B3 Staff Payroll:** Arkar ฿15,000 + HtunKyaw ฿15,000 + Tae ฿15,000 = **฿45,000.00**")
md.append("   - **B4 Staff Payroll:** Chan ฿4,800 + Phyo ฿5,200 = **฿10,000.00** (Active B4 staff operating expense!)")
md.append("   - *Total Staff Payroll Across 4 Branches:* **฿103,300.00** (funded by ฿72,044 transfer + ฿31,256 till cash).")
md.append("6. **Storage Rental Clarified:** The ฿12,000 central storage rental pool is shared equally across all 4 operating branches = **฿3,000 per shop**.")

md.append("\n---")
md.append("## 3. Sales Reconciliation & Audit Tables")
md.append("\n### Executive Sales Summary (4 Branches):")
md.append("| Branch | Evidenced Days | Calendar Days | Gross Sales (THB) | Cash Sales (THB) | Scan Sales (THB) | Shift Exp (THB) | Net Cash Sales (THB) | Rev Share |")
md.append("|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")

rev_b1, cash_b1, scan_b1, exp_b1, net_b1 = 135223, 84240, 50983, 2875, 81365
rev_b2, cash_b2, scan_b2, exp_b2, net_b2 = 48860, 31533, 17327, 1470, 30063
rev_b3, cash_b3, scan_b3, exp_b3, net_b3 = 161444, 130595, 30699, 3179, 156882
rev_b4, cash_b4, scan_b4, exp_b4, net_b4 = 12435, 8064, 4371, 420, 7644

tot_rev_4 = rev_b1 + rev_b2 + rev_b3 + rev_b4
tot_cash_4 = cash_b1 + cash_b2 + cash_b3 + cash_b4
tot_scan_4 = scan_b1 + scan_b2 + scan_b3 + scan_b4
tot_exp_4 = exp_b1 + exp_b2 + exp_b3 + exp_b4
tot_net_4 = net_b1 + net_b2 + net_b3 + net_b4

md.append(f"| **Branch 1 (B1)** | 30 | 30 | ฿{rev_b1:,} | ฿{cash_b1:,} | ฿{scan_b1:,} | ฿{exp_b1:,} | ฿{net_b1:,} | {rev_b1/tot_rev_4*100:.2f}% |")
md.append(f"| **Branch 2 (B2)** | 26 | 30 | ฿{rev_b2:,} | ฿{cash_b2:,} | ฿{scan_b2:,} | ฿{exp_b2:,} | ฿{net_b2:,} | {rev_b2/tot_rev_4*100:.2f}% |")
md.append(f"| **Branch 3 (B3)** | 30 | 30 | ฿{rev_b3:,} | ฿{cash_b3:,} | ฿{scan_b3:,} | ฿{exp_b3:,} | ฿{net_b3:,} | {rev_b3/tot_rev_4*100:.2f}% |")
md.append(f"| **Branch 4 (B4)** | 10 | 11 | ฿{rev_b4:,} | ฿{cash_b4:,} | ฿{scan_b4:,} | ฿{exp_b4:,} | ฿{net_b4:,} | {rev_b4/tot_rev_4*100:.2f}% |")
md.append(f"| **Combined** | **96** | **101** | **฿{tot_rev_4:,}** | **฿{tot_cash_4:,}** | **฿{tot_scan_4:,}** | **฿{tot_exp_4:,}** | **฿{tot_net_4:,}** | **100.00%** |")

# Detailed Branch Daily Tables
def make_daily_table(branch_name, rows):
    out = [f"\n### {branch_name} Daily Sales Audit Table:"]
    out.append("| Date | Revenue (THB) | Cash (THB) | Scan (THB) | Expense (THB) | Net (THB) | Verify | Flags & Notes |")
    out.append("|---|:---:|:---:|:---:|:---:|:---:|:---:|---|")
    for r in rows:
        d = r.get("date") or r.get("date_norm") or r.get("raw_date")
        rev = r.get("rev") or r.get("total") or 0
        cash = r.get("cash") or 0
        scan = r.get("scan") or 0
        exp = r.get("exp") or r.get("shift_exp") or 0
        net = r.get("net") or r.get("net_cash") or 0
        v = r.get("verify", "✓")
        notes = r.get("notes", "") or "-"
        out.append(f"| {d} | {rev:,} | {cash:,} | {scan:,} | {exp:,} | {net:,} | {v} | {notes} |")
    return "\n".join(out)

md.append(make_daily_table("Branch 1 (B1)", rows_b1))
md.append(make_daily_table("Branch 2 (B2)", rows_b2))
md.append(make_daily_table("Branch 3 (B3)", rows_b3))

# B4 table
b4_rows_fmt = []
for r in b4:
    fin = r.get("financials", {})
    b4_rows_fmt.append({
        "date": r.get("date_norm") or r.get("date"),
        "rev": fin.get("gross_sales", 0),
        "cash": fin.get("cash_sales", 0),
        "scan": fin.get("scan_sales", 0),
        "exp": fin.get("shift_expense", 0),
        "net": fin.get("net_cash", 0),
        "verify": "DUP" if r.get("is_duplicate_of") else "✓",
        "notes": r.get("notes") or ("Duplicate uncropped photo of Image 5" if r.get("is_duplicate_of") else "")
    })
md.append(make_daily_table("Branch 4 (B4 / B-5)", b4_rows_fmt))

md.append("\n---")
md.append("## 4. Fruit Usage & Cost Allocation Across 4 Branches (ADR 0001)")
md.append("Under ADR 0001, fruit costs are allocated by **actual branch consumption** (cup counts derived from daily sales sheets):\n")
md.append("| Fruit Pool Item | B1 Cups | B2 Cups | B3 Cups | B4 Cups | Total Cups | B1 % | B2 % | B3 % | B4 % | Total Cost (THB) | B1 Share | B2 Share | B3 Share | B4 Share |")
md.append("|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|")

fruit_table_4 = [
    ("Watermelon", 622, 273, 450, 49, 1394, 44.6, 19.6, 32.3, 3.5, 22160.00),
    ("Mango", 126, 42, 315, 6, 489, 25.8, 8.6, 64.4, 1.2, 21584.00),
    ("Coconut", 267, 121, 393, 5, 786, 34.0, 15.4, 50.0, 0.6, 11675.00),
    ("Orange", 336, 108, 271, 28, 743, 45.2, 14.5, 36.5, 3.8, 10720.00),
    ("Pineapple", 74, 27, 162, 10, 273, 27.1, 9.9, 59.3, 3.7, 9190.00),
    ("Apple", 223, 102, 266, 6, 597, 37.4, 17.1, 44.6, 1.0, 8000.00),
    ("Guava", 176, 66, 154, 5, 401, 43.9, 16.5, 38.4, 1.2, 6675.00),
    ("Durian", 0, 0, 1, 0, 1, 0.0, 0.0, 100.0, 0.0, 9670.00)
]

for f_name, b1_c, b2_c, b3_c, b4_c, t_c, b1_p, b2_p, b3_p, b4_p, cost in fruit_table_4:
    b1_share = cost * (b1_p / 100.0)
    b2_share = cost * (b2_p / 100.0)
    b3_share = cost * (b3_p / 100.0)
    b4_share = cost * (b4_p / 100.0)
    md.append(f"| {f_name} | {b1_c} | {b2_c} | {b3_c} | {b4_c} | {t_c} | {b1_p:.1f}% | {b2_p:.1f}% | {b3_p:.1f}% | {b4_p:.1f}% | ฿{cost:,.2f} | ฿{b1_share:,.2f} | ฿{b2_share:,.2f} | ฿{b3_share:,.2f} | ฿{b4_share:,.2f} |")

md.append("\n---")
md.append("## 5. Final Management P&L for September 2026 (4 Operating Branches)")
md.append("Applying actual staff payroll, evidenced rents, storage rental (฿3k/shop), and 70% Blessme / 30% Ming profit sharing per `CLAUDE.md`:\n")
md.append("| Financial Line Item | Branch 1 (B1) | Branch 2 (B2) | Branch 3 (B3) | Branch 4 (B4) | Total All Operating | Basis & Allocation Method |")
md.append("|---|:---:|:---:|:---:|:---:|:---:|---|")
md.append("| **Gross Sales Revenue** | ฿135,223.00 | ฿48,860.00 | ฿161,444.00 | ฿12,435.00 | ฿357,962.00 | Sum of verified daily sales sheets |")
md.append("| *Less: Shift Expenses (Shop)* | (฿2,875.00) | (฿1,470.00) | (฿3,179.00) | (฿420.00) | (฿7,944.00) | Daily shop ice & minor supplies |")
md.append("| **Net Revenue** | **฿132,348.00** | **฿47,390.00** | **฿158,265.00** | **฿12,015.00** | **฿350,018.00** | Net shop receipts |")
md.append("| **Cost of Goods Sold (COGS)** | | | | | | |")
md.append(f"| - Fruit Pool Usage | (฿34,510.60) | (฿12,947.53) | (฿50,203.28) | (฿2,012.59) | (฿99,674.00) | ADR 0001 actual cup consumption |")
md.append(f"| - Sticky Rice | ฿0.00 | ฿0.00 | (฿13,174.00) | ฿0.00 | (฿13,174.00) | 100% B3 (Mango Sticky Rice menu) |")
md.append(f"| - Packaging & Milk | (฿5,871.49) | (฿2,121.71) | (฿7,010.46) | (฿539.34) | (฿15,543.00) | Revenue share (37.78% / 13.65% / 45.10% / 3.47%) |")
md.append(f"| - Unresolved Supplies/Fruit | (฿2,591.95) | (฿936.37) | (฿3,093.64) | (฿238.04) | (฿6,860.00) | Revenue share provisional |")
md.append(f"| **Total COGS** | **(฿42,974.04)** | **(฿16,005.61)** | **(฿73,481.38)** | **(฿2,789.97)** | **(฿135,251.00)** | |")
md.append(f"| **Gross Profit** | **฿89,373.96** | **฿31,384.39** | **฿84,783.62** | **฿9,225.03** | **฿214,767.00** | |")
md.append(f"| *Gross Margin %* | *67.53%* | *66.23%* | *53.57%* | *76.78%* | *61.36%* | |")
md.append(f"| **Operating Expenses (OPEX)** | | | | | | |")
md.append(f"| - Branch Rental | (฿35,000.00) | (฿25,000.00) | (฿18,780.22) | (฿22,966.67)* | (฿101,746.89) | Direct evidenced lease payments (*B4 rent option) |")
md.append(f"| - **Storage Rental (฿12k / 4)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿12,000.00)** | **฿12,000 pool split equally 4 ways** |")
md.append(f"| - **Staff Payroll (Exact)** | **(฿25,500.00)** | **(฿22,800.00)** | **(฿45,000.00)** | **(฿10,000.00)** | **(฿103,300.00)** | **Exact staff breakdown from owner** |")
md.append(f"| - Partner Salary (Ming) | (฿5,000.00) | (฿5,000.00) | (฿5,000.00) | (฿5,000.00) | (฿20,000.00) | Slip 47 split equally 4 ways |")
md.append(f"| - Electricity (Utilities) | ฿0.00 | ฿0.00 | (฿1,592.22) | ฿0.00 | (฿1,592.22) | Slip 45 direct B3 power only |")
md.append(f"| - Logistics, Delivery, Supplies | (฿4,684.34) | (฿1,692.79) | (฿5,592.59) | (฿430.28) | (฿12,400.00) | Revenue share |")
md.append(f"| **Total OPEX** | **(฿73,184.34)** | **(฿57,492.79)** | **(฿78,965.03)** | **(฿41,396.95)** | **(฿251,039.11)** | |")
md.append(f"| **Net Operating Profit / (Loss)** | **฿16,189.62** | **(฿26,108.40)** | **฿5,818.59** | **(฿32,171.92)** | **(฿36,272.11)** | *With B4 full rent |")
md.append(f"| *Net Margin %* | *12.23%* | *-55.10%* | *3.68%* | *-267.76%* | *-10.36%* | |")
md.append(f"| **Profit Distribution (70/30)** | | | | | | |")
md.append(f"| - **Blessme (70%)** | **฿11,332.73** | ฿0.00 (Loss) | **฿4,073.01** | ฿0.00 (Loss) | **฿15,405.74** | Distributed to Blessme |")
md.append(f"| - **Ming (30%)** | **฿4,856.89** | ฿0.00 (Loss) | **฿1,745.58** | ฿0.00 (Loss) | **฿6,602.47** | Distributed to Ming |")
md.append(f"| - **Quarantined Losses** | ฿0.00 | **(฿26,108.40)** | ฿0.00 | **(฿32,171.92)** | **(฿58,280.32)** | Quarantined per branch to offset future profits |")

md.append("\n*Note on B4 Rent Alternatives:*")
md.append("- If B4 rent (฿22,966.67) is **pro-rated** for the 10-11 operating days (฿8,421.11 operating, remainder ฿14,545.56 to Pre-Opening Capital), B4 Operating Loss is reduced to **(฿17,626.36)**.")
md.append("- If B4 rent is treated **100% as Pre-Opening Setup Capital** (like B2 and B3 setup months), B4 Operating Loss is only **(฿9,205.25)**.")

md.append("\n---")
md.append("## 6. Pending Final Owner Decisions")
md.append("1. **B4 Operating Days & Duplicate Photo:** We identified 11 photos in `B4/sale/Sep26`, but Photo 5 and Photo 6 are duplicate shots of the same shift (25/09). This leaves 10 unique evidenced dates (19, 20, 21, 22, 23, 25, 27, 28, 29, 30 Sep). Is there an 11th shift missing (e.g. 24 or 26 Sep), or was Photo 6 counted as the 11th?")
md.append("2. **B4 September Rent Treatment:** Should B4's ฿22,966.67 rent be: (A) 100% charged to September operations, (B) Pro-rated for 11 days (฿8,421 operating, ฿14,546 setup), or (C) 100% held in the B4 Setup Capital Account?")
md.append("3. **Ming Salary Split:** Should Ming's ฿20,000 salary be split 4 ways (฿5,000 per shop, as shown above) or 3 ways across B1, B2, B3 (฿6,666.67 each)?")
md.append("4. **Slip 41 (฿1,275.00):** Confirm cutting this ttb→BBL internal transfer (like Slips 2 and 70).")
md.append("5. **B2 Missing Days:** Confirm 4 missing days (20, 21, 22, 26 Sep) as closed days.")
md.append("6. **Approval to Write:** Confirm approval to stage and commit to Excel.")

with open(os.path.join(AUDIT_DIR, "REVIEW_PACKAGE.md"), "w") as f:
    f.write("\n".join(md))

print("Regenerated complete 4-Branch REVIEW_PACKAGE.md successfully!")
