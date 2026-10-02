import json
import os
from collections import defaultdict

AUDIT_DIR = "3_Automation_Dashboard/audit/batch_2026-10-01_SepSalesExpenses"

# 1. Load Data
b1_data = json.load(open(os.path.join(AUDIT_DIR, "b1_sales_transcription.json")))
b1_records = b1_data.get("transcriptions") or b1_data.get("records", [])

b2_data = json.load(open(os.path.join(AUDIT_DIR, "b2_sales_transcription.json")))
b2_records = b2_data.get("records") or b2_data.get("transcriptions", [])

b3_data = json.load(open(os.path.join(AUDIT_DIR, "b3_sales_transcription.json")))
b3_records = b3_data.get("records") or b3_data.get("transcriptions", [])

e1 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch1.json")))
e2 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch2.json")))
e3 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch3.json")))
all_exp = e1 + e2 + e3

# 2. Extract daily sales
def extract_b1_daily(r):
    cs = r["closing_summary"]
    h = r["header"]
    calc = r.get("calculations", {})
    return {
        "branch": "B1",
        "date": h.get("date_norm") or r.get("date"),
        "date_raw": h.get("date_raw"),
        "cash": cs.get("cash_sales") or 0,
        "scan": cs.get("scan_sales") or 0,
        "total": cs.get("total_sales") or 0,
        "shift_exp": cs.get("total_expenses") or 0,
        "net_cash": cs.get("net_sales") or 0,
        "total_cups": calc.get("sum_qty_all_sources") or cs.get("total_cups") or 0,
        "menu_rows": r.get("menu_rows", []),
        "discrepancies": r.get("checks", {}).get("notes_flags", [])
    }

def extract_b2_daily(r):
    rep = r.get("reported_closing", {})
    comp = r.get("computed", {})
    return {
        "branch": "B2",
        "date": r.get("date"),
        "date_raw": r.get("date_raw") or r.get("date"),
        "cash": rep.get("cash_sales") or 0,
        "scan": rep.get("scan_sales") or 0,
        "total": rep.get("total_sales") or 0,
        "shift_exp": rep.get("total_expense") or 0,
        "net_cash": comp.get("net_cash_sales") or 0,
        "total_cups": comp.get("sum_reported_item_qty") or rep.get("reported_total_cups") or 0,
        "menu_rows": r.get("sales_items", []),
        "discrepancies": r.get("discrepancies", [])
    }

def extract_b3_daily(r):
    cs = r.get("closing_summary", {})
    h = r.get("header", {})
    ac = r.get("arithmetic_checks", {})
    return {
        "branch": "B3",
        "date": r.get("date"),
        "date_raw": r.get("date_raw"),
        "cash": cs.get("cash_sales") or 0,
        "scan": cs.get("scan_sales") or 0,
        "total": cs.get("total_sales") or 0,
        "shift_exp": cs.get("shift_expense") or cs.get("total_expense") or 0,
        "net_cash": cs.get("net_sales") or (cs.get("cash_sales",0) - (cs.get("shift_expense",0) or cs.get("total_expense",0))),
        "total_cups": ac.get("tally_item_qty_sum") or sum(it.get("reported_total_qty") or 0 for it in r.get("items", [])),
        "menu_rows": r.get("items", []),
        "discrepancies": [d.get("issue") for d in r.get("arithmetic_checks", {}).get("findings", [])] if isinstance(r.get("arithmetic_checks", {}).get("findings"), list) else []
    }

b1_days = [extract_b1_daily(r) for r in b1_records]
b2_days = [extract_b2_daily(r) for r in b2_records]
b3_days = [extract_b3_daily(r) for r in b3_records]

b1_totals = {
    "days": len(b1_days),
    "cash": sum(d["cash"] for d in b1_days),
    "scan": sum(d["scan"] for d in b1_days),
    "total": sum(d["total"] for d in b1_days),
    "shift_exp": sum(d["shift_exp"] for d in b1_days),
    "cups": sum(d["total_cups"] for d in b1_days)
}

b2_totals = {
    "days": len(b2_days),
    "cash": sum(d["cash"] for d in b2_days),
    "scan": sum(d["scan"] for d in b2_days),
    "total": sum(d["total"] for d in b2_days),
    "shift_exp": sum(d["shift_exp"] for d in b2_days),
    "cups": sum(d["total_cups"] for d in b2_days)
}

b3_totals = {
    "days": len(b3_days),
    "cash": sum(d["cash"] for d in b3_days),
    "scan": sum(d["scan"] for d in b3_days),
    "total": sum(d["total"] for d in b3_days),
    "shift_exp": sum(d["shift_exp"] for d in b3_days),
    "cups": sum(d["total_cups"] for d in b3_days)
}

combined_rev = b1_totals["total"] + b2_totals["total"] + b3_totals["total"]
print("--- SALES SUMMARY ---")
print("B1:", b1_totals)
print("B2:", b2_totals)
print("B3:", b3_totals)
print(f"Total Revenue: {combined_rev:,} THB")
print(f"Revenue Share: B1={b1_totals['total']/combined_rev*100:.2f}%, B2={b2_totals['total']/combined_rev*100:.2f}%, B3={b3_totals['total']/combined_rev*100:.2f}%")

# 3. Fruit and Item Usage
def get_fruit_category(name):
    n = name.lower()
    if "orange" in n or "ส้ม" in n or "[or]" in n or "or_100" in n:
        return "Orange"
    elif "watermelon" in n or "แตงโม" in n or "[wm]" in n:
        return "Watermelon"
    elif "mango" in n or "มะม่วง" in n or "[mg]" in n:
        if "sticky" in n or "ข้าวเหนียว" in n:
            return "Mango Sticky Rice"
        return "Mango"
    elif "coconut" in n or "มะพร้าว" in n or "[co]" in n:
        return "Coconut"
    elif "apple" in n or "แอปเปิ้ล" in n or "แอปเปิ้ล" in n or "[ap]" in n:
        return "Apple"
    elif "guava" in n or "ฝรั่ง" in n or "[guava]" in n:
        return "Guava"
    elif "pineapple" in n or "สับปะรด" in n or "[pineapple]" in n:
        return "Pineapple"
    elif "mangosteen" in n or "มังคุด" in n:
        return "Mangosteen"
    elif "rambutan" in n or "เงาะ" in n:
        return "Rambutan"
    elif "durian" in n or "ทุเรียน" in n:
        return "Durian"
    elif "volcano" in n or "ภูเขาไฟ" in n:
        if "orange" in n: return "Orange"
        if "watermelon" in n: return "Watermelon"
        if "mango" in n: return "Mango"
        if "guava" in n: return "Guava"
        if "pineapple" in n: return "Pineapple"
        if "apple" in n: return "Apple"
        return "Mix Fruit"
    return "Other"

fruit_usage = defaultdict(lambda: {"B1": 0, "B2": 0, "B3": 0, "Total": 0})

# B1 items
for d in b1_days:
    for row in d["menu_rows"]:
        name = row.get("item_name") or row.get("item_code") or ""
        qty = row.get("total_qty") or 0
        cat = get_fruit_category(name)
        fruit_usage[cat]["B1"] += qty
        fruit_usage[cat]["Total"] += qty

# B2 items
for d in b2_days:
    for row in d["menu_rows"]:
        name = row.get("item_name") or row.get("item_code") or ""
        qty = row.get("reported_total_qty") or row.get("total_qty") or 0
        cat = get_fruit_category(name)
        fruit_usage[cat]["B2"] += qty
        fruit_usage[cat]["Total"] += qty

# B3 items
for d in b3_days:
    for row in d["menu_rows"]:
        name = row.get("name_raw") or row.get("proposed_code") or ""
        qty = row.get("reported_total_qty") or 0
        cat = get_fruit_category(name)
        fruit_usage[cat]["B3"] += qty
        fruit_usage[cat]["Total"] += qty

print("\n--- FRUIT CUP USAGE ---")
for f, counts in sorted(fruit_usage.items(), key=lambda x: x[1]["Total"], reverse=True):
    tot = counts["Total"]
    if tot > 0:
        b1_pct = counts["B1"]/tot*100
        b2_pct = counts["B2"]/tot*100
        b3_pct = counts["B3"]/tot*100
        print(f"{f:18}: B1={counts['B1']:4d} ({b1_pct:5.1f}%), B2={counts['B2']:4d} ({b2_pct:5.1f}%), B3={counts['B3']:4d} ({b3_pct:5.1f}%) | Total={tot:4d}")

# 4. Expenses Breakdown & Allocation
bucket_totals = defaultdict(float)
cat_totals = defaultdict(float)

for e in all_exp:
    b = e.get("proposed_bucket")
    c = e.get("proposed_category")
    amt = e.get("amount") or 0.0
    bucket_totals[b] += amt
    cat_totals[c] += amt

print("\n--- EXPENSES BY BUCKET (Total: " + f"{sum(e['amount'] for e in all_exp):,.2f} THB) ---")
for b, amt in sorted(bucket_totals.items(), key=lambda x: x[1], reverse=True):
    print(f"  {b:20}: {amt:10,.2f} THB")

print("\n--- EXPENSES BY CATEGORY ---")
for c, amt in sorted(cat_totals.items(), key=lambda x: x[1], reverse=True):
    print(f"  {c:25}: {amt:10,.2f} THB")
