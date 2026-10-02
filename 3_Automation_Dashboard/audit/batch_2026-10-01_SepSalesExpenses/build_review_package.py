import json, os, datetime

AUDIT_DIR = "3_Automation_Dashboard/audit/batch_2026-10-01_SepSalesExpenses"

# Load files
b1 = json.load(open(os.path.join(AUDIT_DIR, "b1_sales_transcription.json")))["transcriptions"]
b2 = json.load(open(os.path.join(AUDIT_DIR, "b2_sales_transcription.json")))["records"]
b3 = json.load(open(os.path.join(AUDIT_DIR, "b3_sales_transcription.json")))["records"]

e1 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch1.json")))
e2 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch2.json")))
e3 = json.load(open(os.path.join(AUDIT_DIR, "expenses_batch3.json")))
all_exp = e1 + e2 + e3

manifest = json.load(open(os.path.join(AUDIT_DIR, "manifest.json")))

# Standardize daily rows for table
def format_b1_row(d):
    h = d["header"]
    cs = d["closing_summary"]
    se_sum = sum(e.get("total") or 0 for e in d.get("shift_expenses", []))
    rev = cs.get("total_sales") or 0
    cash = cs.get("cash_sales") or 0
    scan = cs.get("scan_sales") or 0
    net = cash - se_sum
    # check
    calc_pass = (cash + scan == rev)
    date_str = h.get("date_norm") or h.get("date_raw")
    notes = "; ".join(d.get("checks", {}).get("notes_flags", []))
    verify = "✓" if calc_pass and not notes else "✗"
    return {
        "branch": "B1",
        "date": date_str,
        "raw_date": h.get("date_raw"),
        "rev": rev, "cash": cash, "scan": scan,
        "exp": se_sum, "net": net, "verify": verify,
        "notes": notes, "file": d.get("filename")
    }

def format_b2_row(d):
    rep = d.get("reported_closing", {})
    comp = d.get("computed", {})
    rev = rep.get("total_sales") or 0
    cash = rep.get("cash_sales") or 0
    scan = rep.get("scan_sales") or 0
    exp = rep.get("total_expense") or 0
    net = comp.get("net_cash_sales") or (cash - exp)
    calc_pass = (cash + scan == rev)
    disc = d.get("discrepancies", [])
    verify = "✓" if calc_pass and not disc else "✗"
    return {
        "branch": "B2",
        "date": d.get("date"),
        "raw_date": d.get("date_raw"),
        "rev": rev, "cash": cash, "scan": scan,
        "exp": exp, "net": net, "verify": verify,
        "notes": "; ".join(disc) if disc else "",
        "file": d.get("source_ids", [None])[0]
    }

def format_b3_row(d):
    cs = d.get("closing_summary", {})
    rev = cs.get("total_sales") or 0
    cash = cs.get("cash_sales") or 0
    scan = cs.get("scan_sales") or 0
    exp = cs.get("shift_expense") or cs.get("total_expense") or 0
    net = cs.get("net_sales") or (cash - exp)
    calc_pass = (cash + scan == rev)
    ac = d.get("arithmetic_checks", {})
    findings = ac.get("findings", [])
    disc = [f.get("issue") for f in findings] if isinstance(findings, list) else []
    verify = "✓" if calc_pass and not disc else "✗"
    return {
        "branch": "B3",
        "date": d.get("date"),
        "raw_date": d.get("date_raw"),
        "rev": rev, "cash": cash, "scan": scan,
        "exp": exp, "net": net, "verify": verify,
        "notes": "; ".join(disc) if disc else "",
        "file": d.get("source_file")
    }

rows_b1 = [format_b1_row(d) for d in b1]
rows_b2 = [format_b2_row(d) for d in b2]
rows_b3 = [format_b3_row(d) for d in b3]

# Chronological sorting
rows_b1.sort(key=lambda x: str(x["date"]))
rows_b2.sort(key=lambda x: str(x["date"]))
rows_b3.sort(key=lambda x: str(x["date"]))

print("Generated formatted daily rows: B1=", len(rows_b1), "B2=", len(rows_b2), "B3=", len(rows_b3))

# Master JSON structure
summary = {
    "schema_version": "1.0",
    "batch_id": "batch_2026-10-01_SepSalesExpenses",
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "review": {
        "reviewer": "Antigravity Audit Coordinator",
        "import_allowed": False,
        "status": "AWAITING_OWNER_DECISIONS"
    },
    "sales": {
        "B1": {
            "calendar_days": 30, "evidenced_days": 30,
            "revenue": sum(r["rev"] for r in rows_b1),
            "cash": sum(r["cash"] for r in rows_b1),
            "scan": sum(r["scan"] for r in rows_b1),
            "shift_exp": sum(r["exp"] for r in rows_b1),
            "net_cash": sum(r["net"] for r in rows_b1)
        },
        "B2": {
            "calendar_days": 30, "evidenced_days": 26,
            "missing_calendar_dates": ["20/09/2026", "21/09/2026", "22/09/2026", "26/09/2026"],
            "revenue": sum(r["rev"] for r in rows_b2),
            "cash": sum(r["cash"] for r in rows_b2),
            "scan": sum(r["scan"] for r in rows_b2),
            "shift_exp": sum(r["exp"] for r in rows_b2),
            "net_cash": sum(r["net"] for r in rows_b2)
        },
        "B3": {
            "calendar_days": 30, "evidenced_days": 30,
            "revenue": sum(r["rev"] for r in rows_b3),
            "cash": sum(r["cash"] for r in rows_b3),
            "scan": sum(r["scan"] for r in rows_b3),
            "shift_exp": sum(r["exp"] for r in rows_b3),
            "net_cash": sum(r["net"] for r in rows_b3)
        }
    },
    "expenses_summary": {
        "total_slips": len(all_exp),
        "total_amount": sum(e["amount"] for e in all_exp),
        "cogs_pool": 128506.00,
        "opex_pool": 118807.44,
        "capex_assets": 27620.00,
        "b4_quarantined": 31974.67,
        "excluded_personal": 13745.00
    }
}

with open(os.path.join(AUDIT_DIR, "master_audit_summary.json"), "w") as f:
    json.dump(summary, f, indent=2)

print("Saved master_audit_summary.json!")
