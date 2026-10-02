import json, os
from collections import defaultdict

AUDIT_DIR = "3_Automation_Dashboard/audit/batch_2026-10-01_SepSalesExpenses"

# Load sales
b1_data = json.load(open(os.path.join(AUDIT_DIR, "b1_sales_transcription.json")))["transcriptions"]
b2_data = json.load(open(os.path.join(AUDIT_DIR, "b2_sales_transcription.json")))["records"]
b3_data = json.load(open(os.path.join(AUDIT_DIR, "b3_sales_transcription.json")))["records"]

# Load expenses
e1 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch1.json")))
e2 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch2.json")))
e3 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch3.json")))
all_exp = e1 + e2 + e3

# 1. Sales Reconciled
b1_rev = sum(r["closing_summary"]["total_sales"] or 0 for r in b1_data)
b1_cash = sum(r["closing_summary"]["cash_sales"] or 0 for r in b1_data)
b1_scan = sum(r["closing_summary"]["scan_sales"] or 0 for r in b1_data)
b1_exp = sum(r["closing_summary"].get("total_expenses", 0) or 0 for r in b1_data)

b2_rev = sum(r["reported_closing"]["total_sales"] or 0 for r in b2_data)
b2_cash = sum(r["reported_closing"]["cash_sales"] or 0 for r in b2_data)
b2_scan = sum(r["reported_closing"]["scan_sales"] or 0 for r in b2_data)
b2_exp = sum(r["reported_closing"].get("total_expense", 0) or 0 for r in b2_data)

b3_rev = sum(r["closing_summary"]["total_sales"] or 0 for r in b3_data)
b3_cash = sum(r["closing_summary"]["cash_sales"] or 0 for r in b3_data)
b3_scan = sum(r["closing_summary"]["scan_sales"] or 0 for r in b3_data)
b3_exp = sum(r["closing_summary"].get("shift_expense", 0) or r["closing_summary"].get("total_expense", 0) or 0 for r in b3_data)

total_rev = b1_rev + b2_rev + b3_rev
b1_rev_pct = b1_rev / total_rev
b2_rev_pct = b2_rev / total_rev
b3_rev_pct = b3_rev / total_rev

print(f"Revenue: B1={b1_rev:,} ({b1_rev_pct*100:.2f}%), B2={b2_rev:,} ({b2_rev_pct*100:.2f}%), B3={b3_rev:,} ({b3_rev_pct*100:.2f}%), Total={total_rev:,}")

# 2. Fruit Usage Allocation Rates (ADR 0001)
# Computed earlier:
fruit_usage_pct = {
    "Watermelon": {"B1": 0.462, "B2": 0.203, "B3": 0.335},
    "Mango": {"B1": 0.261, "B2": 0.087, "B3": 0.652},
    "Coconut": {"B1": 0.342, "B2": 0.155, "B3": 0.503},
    "Orange": {"B1": 0.470, "B2": 0.151, "B3": 0.379},
    "Pineapple": {"B1": 0.281, "B2": 0.103, "B3": 0.616},
    "Apple": {"B1": 0.377, "B2": 0.173, "B3": 0.450},
    "Guava": {"B1": 0.444, "B2": 0.167, "B3": 0.389},
    "Durain": {"B1": 0.0, "B2": 0.0, "B3": 1.0}
}

# 3. Categorize Expenses
cogs_b1, cogs_b2, cogs_b3 = 0.0, 0.0, 0.0
opex_b1, opex_b2, opex_b3 = 0.0, 0.0, 0.0
capex_total = 0.0
b4_total = 0.0
excluded_total = 0.0
unresolved_total = 0.0

expense_audit_rows = []

for e in all_exp:
    idx = e["idx"]
    amt = e["amount"]
    bucket = e["proposed_bucket"]
    cat = e["proposed_category"]
    memo = " / ".join(e.get("memo_lines", []))
    
    # Check special cases
    if idx in [2, 41, 70]: # internal transfers
        excluded_total += amt
        status = "EXCLUDED (Internal Transfer ttb->BBL)"
        continue
    elif idx == 20: # Crispy pork
        excluded_total += amt
        status = "EXCLUDED (Non-business / Crispy Pork)"
        continue
    elif idx in [88, 21, 66, 37, 40, 38]: # B4 pre-opening
        b4_total += amt
        status = f"QUARANTINED B4 ({cat})"
        continue
    elif idx == 73: # Yamaha Finn 2022
        capex_total += amt
        status = "CAPEX (Motorcycle Yamaha Finn 2022)"
        continue
    elif bucket == "COGS":
        if cat in fruit_usage_pct:
            rates = fruit_usage_pct[cat]
            cogs_b1 += amt * rates["B1"]
            cogs_b2 += amt * rates["B2"]
            cogs_b3 += amt * rates["B3"]
            status = f"COGS Fruit ({cat}) -> Usage Split (B1:{rates['B1']*100:.1f}%, B2:{rates['B2']*100:.1f}%, B3:{rates['B3']*100:.1f}%)"
        elif cat == "Sticky Rice":
            # Mango sticky rice sold 100% at B3
            cogs_b3 += amt
            status = "COGS Sticky Rice -> 100% B3"
        elif cat in ["Packaging", "Milk", "Ice"]:
            # Revenue share
            cogs_b1 += amt * b1_rev_pct
            cogs_b2 += amt * b2_rev_pct
            cogs_b3 += amt * b3_rev_pct
            status = f"COGS {cat} -> Rev Share (B1:{b1_rev_pct*100:.1f}%, B2:{b2_rev_pct*100:.1f}%, B3:{b3_rev_pct*100:.1f}%)"
        else:
            # General COGS fallback rev share
            cogs_b1 += amt * b1_rev_pct
            cogs_b2 += amt * b2_rev_pct
            cogs_b3 += amt * b3_rev_pct
            status = f"COGS Other ({cat}) -> Rev Share"
    elif bucket == "OPEX":
        if cat == "Rental":
            if idx == 53: # B1 Rent
                opex_b1 += amt
                status = "OPEX Rent B1 -> 100% B1"
            elif idx == 64: # B2 Rent
                opex_b2 += amt
                status = "OPEX Rent B2 -> 100% B2"
            elif idx == 48: # B3 Rent
                opex_b3 += amt
                status = "OPEX Rent B3 -> 100% B3"
        elif cat == "Salary":
            if idx == 47: # Ming Salary
                # Split equally 3 branches
                opex_b1 += amt / 3
                opex_b2 += amt / 3
                opex_b3 += amt / 3
                status = "OPEX Ming Salary -> Equal Split (1/3 each)"
        elif cat == "Utilities":
            if idx == 45: # B3 Electricity
                opex_b3 += amt
                status = "OPEX Utilities B3 -> 100% B3"
            else:
                opex_b1 += amt * b1_rev_pct
                opex_b2 += amt * b2_rev_pct
                opex_b3 += amt * b3_rev_pct
                status = f"OPEX Utilities -> Rev Share"
        else:
            # Delivery, logistics, supplies -> Rev Share
            opex_b1 += amt * b1_rev_pct
            opex_b2 += amt * b2_rev_pct
            opex_b3 += amt * b3_rev_pct
            status = f"OPEX {cat} -> Rev Share"
    elif bucket == "UNRESOLVED":
        unresolved_total += amt
        # Temp assign rev share for simulation
        cogs_b1 += amt * b1_rev_pct
        cogs_b2 += amt * b2_rev_pct
        cogs_b3 += amt * b3_rev_pct
        status = f"UNRESOLVED ({cat}) -> Flagged for Owner Decision"

print("\n--- SIMULATED P&L (ACTUAL EXPENSES BASIS) ---")
print(f"{'Metric':25} | {'B1':>12} | {'B2':>12} | {'B3':>12} | {'Total':>12}")
print("-" * 75)
print(f"{'Gross Revenue':25} | {b1_rev:12,d} | {b2_rev:12,d} | {b3_rev:12,d} | {total_rev:12,d}")
print(f"{'Shift Expenses (Shop)':25} | {b1_exp:12,d} | {b2_exp:12,d} | {b3_exp:12,d} | {b1_exp+b2_exp+b3_exp:12,d}")
print(f"{'Net Revenue':25} | {b1_rev-b1_exp:12,d} | {b2_rev-b2_exp:12,d} | {b3_rev-b3_exp:12,d} | {total_rev-b1_exp-b2_exp-b3_exp:12,d}")
print(f"{'Allocated COGS':25} | {cogs_b1:12,.2f} | {cogs_b2:12,.2f} | {cogs_b3:12,.2f} | {cogs_b1+cogs_b2+cogs_b3:12,.2f}")
gp_b1 = (b1_rev - b1_exp) - cogs_b1
gp_b2 = (b2_rev - b2_exp) - cogs_b2
gp_b3 = (b3_rev - b3_exp) - cogs_b3
print(f"{'Gross Profit':25} | {gp_b1:12,.2f} | {gp_b2:12,.2f} | {gp_b3:12,.2f} | {gp_b1+gp_b2+gp_b3:12,.2f}")
print(f"{'Allocated OPEX':25} | {opex_b1:12,.2f} | {opex_b2:12,.2f} | {opex_b3:12,.2f} | {opex_b1+opex_b2+opex_b3:12,.2f}")
np_b1 = gp_b1 - opex_b1
np_b2 = gp_b2 - opex_b2
np_b3 = gp_b3 - opex_b3
print(f"{'Net Operating Profit':25} | {np_b1:12,.2f} | {np_b2:12,.2f} | {np_b3:12,.2f} | {np_b1+np_b2+np_b3:12,.2f}")

print("\n--- PROFIT SHARE SIMULATION (70% Blessme / 30% Ming) ---")
for b_name, np in [("B1", np_b1), ("B2", np_b2), ("B3", np_b3)]:
    if np > 0:
        bm = np * 0.7
        mg = np * 0.3
        print(f"{b_name}: Net Profit = {np:10,.2f} -> Blessme (70%) = {bm:10,.2f}, Ming (30%) = {mg:10,.2f}")
    else:
        print(f"{b_name}: Net Loss = {np:10,.2f} -> Quarantined carry-forward (฿0 distribution)")
