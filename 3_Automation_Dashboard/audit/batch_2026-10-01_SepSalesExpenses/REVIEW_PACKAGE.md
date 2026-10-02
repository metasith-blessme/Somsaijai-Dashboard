# Comprehensive Audit & Review Package: SomSaiJai September 2026 (4 Branches)
**Status:** `READ-ONLY AUDIT REVIEW` | `review.import_allowed: false`  
**Last Updated:** 2026-10-02 11:35 (Incorporating Branch 4 operating sales, exact payroll, and storage rental)  
**Governance Compliance:** `CLAUDE.md`, `docs/OCR_RULES.md`, `docs/OCR_TO_DASHBOARD_WORKFLOW.md`, `docs/SOMSAIJAI_SALES_EXTRACTOR.md`  

> **CRITICAL GATE NOTICE:** This document is an audit review and reconciliation package. No financial writes to Excel (`SomSaiJai_Dashboard_B*.xlsx`), updates to master JSON (`data.json`, `reports_data.json`), or deployments have occurred. All data remains in staging awaiting final owner approval.

---
## 1. Executive Summary & Multi-Branch Operating Overview
In September 2026, **SomSaiJai operated across 4 branches**:
- **Branch 1 (B1):** Full month (30 days) — ฿135,223.00 gross sales.
- **Branch 2 (B2):** 26 operating days (4 missing calendar dates) — ฿48,860.00 gross sales.
- **Branch 3 (B3):** Full month (30 days) — ฿161,444.00 gross sales (first month with handwritten daily logs).
- **Branch 4 (B4 / B-5):** Soft opening trial (10 unique operating days evidenced) — ฿12,435.00 gross sales.
- **Combined 4-Branch Gross Revenue:** **฿357,962.00** across **96 operating days**.

---
## 2. Source Intake Updates & Evidence Log
1. **Branch 4 Sales Added (`B4/sale/Sep26/`):** 11 images verified. Registered with SHA-256 hashes in `manifest.json`. Image 5 and Image 6 are confirmed duplicate photos of the same shift (25/09/2026), yielding 10 unique evidenced operating shifts.
2. **Cut Internal Transfers:** Slips 2 (฿4,760.00) and 70 (฿3,910.00) confirmed as internal transfers and removed.
3. **Added Slip 1 (`IMG_3013.JPG`):** ฿2,750.00 Mango 50kg (29/09/2026, LINE Pay QR) added to active Mango pool.
4. **Added Slip 2 (`IMG_3033.JPG`):** ฿72,044.00 bank transfer for staff payroll (30/09/2026, Aung Min Phay Son).
5. **Authoritative Staff Payroll Schedule:** Exact payroll breakdown provided by owner:
   - **B1 Staff Payroll:** Aye ฿13,500 + Kyaw ฿12,000 = **฿25,500.00**
   - **B2 Staff Payroll:** Hpai ฿11,200 + Myat ฿11,600 = **฿22,800.00**
   - **B3 Staff Payroll:** Arkar ฿15,000 + HtunKyaw ฿15,000 + Tae ฿15,000 = **฿45,000.00**
   - **B4 Staff Payroll:** Chan ฿4,800 + Phyo ฿5,200 = **฿10,000.00** (Active B4 staff operating expense!)
   - *Total Staff Payroll Across 4 Branches:* **฿103,300.00** (funded by ฿72,044 transfer + ฿31,256 till cash).
6. **Storage Rental Clarified:** The ฿12,000 central storage rental pool is shared equally across all 4 operating branches = **฿3,000 per shop**.

---
## 3. Sales Reconciliation & Audit Tables

### Executive Sales Summary (4 Branches):
| Branch | Evidenced Days | Calendar Days | Gross Sales (THB) | Cash Sales (THB) | Scan Sales (THB) | Shift Exp (THB) | Net Cash Sales (THB) | Rev Share |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Branch 1 (B1)** | 30 | 30 | ฿135,223 | ฿84,240 | ฿50,983 | ฿2,875 | ฿81,365 | 37.78% |
| **Branch 2 (B2)** | 26 | 30 | ฿48,860 | ฿31,533 | ฿17,327 | ฿1,470 | ฿30,063 | 13.65% |
| **Branch 3 (B3)** | 30 | 30 | ฿161,444 | ฿130,595 | ฿30,699 | ฿3,179 | ฿156,882 | 45.10% |
| **Branch 4 (B4)** | 10 | 11 | ฿12,435 | ฿8,064 | ฿4,371 | ฿420 | ฿7,644 | 3.47% |
| **Combined** | **96** | **101** | **฿357,962** | **฿254,432** | **฿103,380** | **฿7,944** | **฿275,954** | **100.00%** |

### Branch 1 (B1) Daily Sales Audit Table:
| Date | Revenue (THB) | Cash (THB) | Scan (THB) | Expense (THB) | Net (THB) | Verify | Flags & Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 01/09/2026 | 4,648 | 2,838 | 1,810 | 60 | 2,778 | ✓ | - |
| 02/09/2026 | 6,764 | 4,962 | 1,802 | 120 | 4,842 | ✓ | - |
| 03/09/2026 | 4,082 | 1,868 | 2,214 | 60 | 1,808 | ✓ | - |
| 04/09/2026 | 8,834 | 5,325 | 3,509 | 220 | 5,105 | ✓ | - |
| 05/09/2026 | 6,197 | 3,474 | 2,723 | 120 | 3,354 | ✓ | - |
| 06/09/2026 | 3,202 | 1,972 | 1,230 | 60 | 1,912 | ✓ | - |
| 07/09/2026 | 5,073 | 3,239 | 1,834 | 60 | 3,179 | ✓ | - |
| 08/09/2026 | 5,065 | 2,303 | 2,762 | 90 | 2,213 | ✓ | - |
| 09/09/2026 | 4,878 | 3,013 | 1,865 | 60 | 2,953 | ✓ | - |
| 10/09/2026 | 1,989 | 964 | 1,025 | 60 | 904 | ✓ | - |
| 11/09/2026 | 2,247 | 1,267 | 980 | 60 | 1,207 | ✓ | - |
| 12/09/2026 | 5,156 | 2,640 | 2,516 | 120 | 2,520 | ✓ | - |
| 13/09/2026 | 7,697 | 3,938 | 3,759 | 120 | 3,818 | ✓ | - |
| 14/09/2026 | 4,868 | 3,200 | 1,668 | 60 | 3,140 | ✓ | - |
| 15/09/2026 | 1,154 | 685 | 469 | 60 | 625 | ✓ | - |
| 16/09/2026 | 1,603 | 1,198 | 405 | 60 | 1,138 | ✓ | - |
| 17/09/2026 | 2,144 | 1,280 | 864 | 111 | 1,169 | ✓ | - |
| 18/09/2026 | 5,190 | 2,910 | 2,280 | 120 | 2,790 | ✓ | - |
| 19/09/2026 | 3,470 | 2,110 | 1,360 | 120 | 1,990 | ✓ | - |
| 20/09/2026 | 1,030 | 680 | 350 | 60 | 620 | ✓ | - |
| 21/09/2026 | 2,617 | 2,087 | 530 | 60 | 2,027 | ✓ | - |
| 23/09/2026 | 4,748 | 1,570 | 3,178 | 120 | 1,450 | ✓ | - |
| 23/09/2026 | 4,327 | 2,787 | 1,540 | 244 | 2,543 | ✓ | - |
| 24/09/2026 | 3,280 | 2,225 | 1,055 | 80 | 2,145 | ✓ | - |
| 25/09/2026 | 360 | 360 | 0 | 60 | 300 | ✓ | - |
| 26/09/2026 | 7,392 | 5,392 | 2,000 | 90 | 5,302 | ✓ | - |
| 27/09/2026 | 5,799 | 4,620 | 1,179 | 120 | 4,500 | ✓ | - |
| 28/09/2026 | 5,789 | 4,550 | 1,239 | 60 | 4,490 | ✓ | - |
| 29/09/2026 | 5,123 | 3,234 | 1,889 | 120 | 3,114 | ✓ | - |
| 30/09/2026 | 10,497 | 7,549 | 2,948 | 120 | 7,429 | ✓ | - |

### Branch 2 (B2) Daily Sales Audit Table:
| Date | Revenue (THB) | Cash (THB) | Scan (THB) | Expense (THB) | Net (THB) | Verify | Flags & Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| {'raw_text': '1.9.2026', 'normalized': '01/09/2026', 'state': 'observed'} | 1,900 | 1,255 | 645 | 60 | 1,195 | ✓ | - |
| {'raw_text': '10.9.2026', 'normalized': '10/09/2026', 'state': 'observed'} | 1,989 | 964 | 1,025 | 60 | 904 | ✗ | Volcano Watermelon (109 THB) has tally mark in scan column, but the 109 THB amount was added to cash sales (implied cash 855 + 109 = 964), while scan sales is 1025 (sum of other scan items). Total sales 1989 matches perfectly. |
| {'raw_text': '11.9.2026', 'normalized': '11/09/2026', 'state': 'observed'} | 715 | 715 | 0 | 60 | 655 | ✗ | Sum of menu rows is 713 THB (180 + 275 + 258), but reported cash sales and total sales is 715 THB (diff +2 THB). |
| {'raw_text': '12.9.2026', 'normalized': '12/09/2026', 'state': 'observed'} | 2,100 | 1,115 | 985 | 60 | 1,055 | ✓ | - |
| {'raw_text': '13.9.2026', 'normalized': '13/09/2026', 'state': 'observed'} | 2,379 | 1,465 | 914 | 60 | 1,405 | ✗ | Gross cash items sum to 1525 THB; reported cash sales 1465 is net of ice (1525 - 60). Reported total sales 2379 is net cash (1465) + scan (914). Net sales 2319 double-deducted ice (2379 - 60). |
| {'raw_text': '14.9.2026', 'normalized': '14/09/2026', 'state': 'observed'} | 1,695 | 1,160 | 535 | 60 | 1,100 | ✓ | - |
| {'raw_text': '15.9.2026', 'normalized': '15/09/2026', 'state': 'observed'} | 355 | 205 | 150 | 60 | 145 | ✓ | - |
| {'raw_text': '16.9.2026', 'normalized': '16/09/2026', 'state': 'observed'} | 585 | 275 | 310 | 60 | 215 | ✗ | Sum of cash item amounts is 274 THB (55 + 90 + 129), but reported cash sales is 275 THB (diff +1 THB). Total sales reported is 585. |
| {'raw_text': '17-9-2026', 'normalized': '17/09/2026', 'state': 'observed'} | 1,479 | 1,134 | 345 | 60 | 1,074 | ✗ | Gross cash items sum to 1194 THB; reported cash sales 1134 is net of ice (1194 - 60). Reported total sales 1479 is net cash (1134) + scan (345). Net sales 1419 double-deducted ice (1479 - 60). |
| {'raw_text': '18.9.2026', 'normalized': '18/09/2026', 'state': 'observed'} | 2,639 | 2,000 | 639 | 60 | 1,940 | ✗ | Sum of menu rows is 2698 THB (cups sum to 39), but reported total sales is 2639 (cash 2000 + scan 639), difference of -59 THB. |
| {'raw_text': '19.9.2026', 'normalized': '19/09/2026', 'state': 'observed'} | 1,010 | 765 | 245 | 60 | 705 | ✗ | Cash row items sum to 825 THB (270 + 495 + 60), while written cash is 765 (diff exactly equals ice 60 THB). All sales reported as 1010 (765 + 245). |
| {'raw_text': '2.9.2026', 'normalized': '02/09/2026', 'state': 'observed'} | 2,815 | 1,355 | 1,460 | 60 | 1,295 | ✗ | Tally-implied cash is 1540 and scan is 1275, but reported closing is cash 1355 and scan 1460 (185 shift from cash to scan). Total sales matches exactly at 2815. |
| {'raw_text': '23.9.2026', 'normalized': '23/09/2026', 'state': 'observed'} | 1,440 | 1,085 | 355 | 60 | 1,025 | ✗ | Gross cash is 1145 THB, less ice 60 = 1085 THB. Scan is 355 THB. 'All -> 1440' is net cash (1085) + scan (355). |
| {'raw_text': '24 / 9 / 2026', 'normalized': '24/09/2026', 'state': 'observed'} | 1,240 | 590 | 650 | 60 | 530 | ✗ | Gross menu cash is 580 THB. With note 'Water (70) - 1', total cash is 650 THB. Deducting ice 60 yields net cash 590 THB. Cash Total box originally wrote 580, crossed out and corrected to 590. Grand Total originally wrote 1230, crossed out and corrected to 1240. |
| {'raw_text': '25 / 9 / 2026', 'normalized': '25/09/2026', 'state': 'observed'} | 355 | 150 | 175 | 30 | 120 | ✗ | Gross cash sales is 180 THB (55+60+65). Minus ice 30 THB = 150 THB. Scan sales is 175 THB (55+120). Grand Total reported as 355 THB, which is gross sales (180 + 175 = 355), before deducting ice. |
| {'raw_text': '27 / 9 / 2026', 'normalized': '27/09/2026', 'state': 'observed'} | 1,190 | 705 | 485 | 0 | 705 | ✗ | Orange cash written as 190 (2 cups @ 80 = 160, diff +30 THB). Watermelon scan tallies show 6 cups (implied 330), but written scan amount is 275 THB. Mango row has Total Qty 3 written with no tallies. Ice 60 THB is crossed out and not deducted. Total sales 1190 = Cash 705 + Scan 485. |
| {'raw_text': '28 / 9 / 2026', 'normalized': '28/09/2026', 'state': 'observed'} | 2,885 | 2,040 | 845 | 60 | 1,980 | ✗ | Gross cash items sum to 2100 THB; net cash written is 2040 THB (2100 - 60 ice). Scan sales is 845 THB. Grand Total reported is 2885 THB (net cash 2040 + scan 845). |
| {'raw_text': '29 / 9 / 2026', 'normalized': '29/09/2026', 'state': 'observed'} | 2,330 | 1,170 | 1,220 | 60 | 1,110 | ✗ | Gross cash items sum to 1170 THB. In Payment Summary, Cash Total is written as 1170 (gross), QR/Bank Total is 1220, but Grand Total is written as 2330 (which equals net cash 1110 + scan 1220). |
| {'raw_text': '3.9.2026', 'normalized': '03/09/2026', 'state': 'observed'} | 1,325 | 940 | 385 | 60 | 880 | ✗ | Sum of scan tallies is 395 (110 + 60 + 75 + 150), but reported scan sales is 385 (diff -10 THB). Total sales reported is 1325 (940 cash + 385 scan). |
| {'raw_text': '30 / 9 / 2026', 'normalized': '30/09/2026', 'state': 'observed'} | 2,530 | 1,245 | 1,285 | 60 | 1,185 | ✗ | Gross menu cash is 1155 THB + 150 THB (Mango sticky ice note) = 1305 THB gross cash. Less ice 60 THB = 1245 THB net cash. Scan is 1215 THB + 70 THB (Watermelon no ice note) = 1285 THB. Grand Total reported as 2530 THB (1245 net cash + 1285 scan). |
| {'raw_text': '4.9.2026', 'normalized': '04/09/2026', 'state': 'observed'} | 4,005 | 2,500 | 1,505 | 60 | 2,440 | ✗ | Sum of menu rows is 3455 THB (cups sum to 50), but closing summary reports Cash 2500, Scan 1505, Total sales 4005 THB (diff +550 THB unaccounted by tallies, likely additional items or off-sheet sales). |
| {'raw_text': '5.9.2026', 'normalized': '05/09/2026', 'state': 'observed'} | 1,915 | 1,340 | 545 | 60 | 1,280 | ✗ | Sum of cash item amounts is 1344 THB, but reported cash sales is 1340 THB (-4 THB). Total sales written as 1915 (1370+545=1915 or 1340+545=1885). Net sales reported 1855 (1915-60). |
| {'raw_text': '6.9.2026', 'normalized': '06/09/2026', 'state': 'observed'} | 824 | 660 | 164 | 60 | 600 | ✓ | - |
| {'raw_text': '7.9.2026', 'normalized': '07/09/2026', 'state': 'observed'} | 4,980 | 4,125 | 855 | 60 | 4,065 | ✓ | - |
| {'raw_text': '8.9.2026', 'normalized': '08/09/2026', 'state': 'observed'} | 1,645 | 890 | 755 | 60 | 830 | ✓ | - |
| {'raw_text': '9.9.2026', 'normalized': '09/09/2026', 'state': 'observed'} | 2,535 | 1,685 | 850 | 60 | 1,625 | ✓ | - |

### Branch 3 (B3) Daily Sales Audit Table:
| Date | Revenue (THB) | Cash (THB) | Scan (THB) | Expense (THB) | Net (THB) | Verify | Flags & Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 2026-09-01 | 6,552 | 5,169 | 1,383 | 110 | 5,059 | ✓ | - |
| 2026-09-02 | 7,620 | 6,661 | 959 | 110 | 7,510 | ✓ | - |
| 2026-09-03 | 5,512 | 4,632 | 880 | 110 | 5,402 | ✓ | - |
| 2026-09-04 | 5,686 | 4,981 | 705 | 55 | 5,631 | ✓ | - |
| 2026-09-05 | 7,588 | 6,139 | 1,449 | 110 | 7,478 | ✓ | - |
| 2026-09-06 | 8,400 | 5,664 | 2,736 | 110 | 8,290 | ✓ | - |
| 2026-09-07 | 4,493 | 3,175 | 1,318 | 110 | 4,383 | ✓ | - |
| 2026-09-08 | 5,283 | 4,066 | 1,217 | 110 | 5,173 | ✓ | - |
| 2026-09-09 | 6,167 | 5,137 | 1,030 | 55 | 6,112 | ✓ | - |
| 2026-09-10 | 6,513 | 5,137 | 1,376 | 55 | 6,458 | ✓ | - |
| 2026-09-11 | 6,644 | 5,676 | 968 | 110 | 6,534 | ✓ | - |
| 2026-09-12 | 5,409 | 4,610 | 799 | 55 | 5,354 | ✓ | - |
| 2026-09-13 | 4,216 | 2,869 | 1,347 | 110 | 4,106 | ✓ | - |
| 2026-09-14 | 4,582 | 3,739 | 843 | 175 | 4,407 | ✓ | - |
| 2026-09-15 | 3,932 | 3,273 | 659 | 55 | 3,877 | ✓ | - |
| 2026-09-16 | 4,602 | 3,729 | 873 | 55 | 4,547 | ✓ | - |
| 2026-09-17 | 4,797 | 3,767 | 880 | 315 | 4,482 | ✗ | - |
| 2026-09-18 | 3,723 | 3,288 | 435 | 55 | 3,668 | ✓ | - |
| 2026-09-19 | 6,138 | 4,982 | 1,156 | 55 | 6,083 | ✓ | - |
| 2026-09-20 | 4,510 | 3,361 | 1,149 | 110 | 4,400 | ✓ | - |
| 2026-09-21 | 5,010 | 4,202 | 808 | 55 | 4,955 | ✓ | - |
| 2026-09-22 | 3,772 | 2,706 | 1,066 | 358 | 3,414 | ✓ | - |
| 2026-09-23 | 4,473 | 3,390 | 1,083 | 55 | 4,418 | ✓ | - |
| 2026-09-24 | 4,911 | 3,748 | 1,163 | 55 | 4,856 | ✓ | - |
| 2026-09-25 | 3,236 | 2,966 | 270 | 55 | 3,181 | ✓ | - |
| 2026-09-26 | 7,077 | 6,239 | 838 | 296 | 6,781 | ✓ | - |
| 2026-09-27 | 6,847 | 6,151 | 696 | 55 | 6,792 | ✓ | - |
| 2026-09-28 | 3,696 | 2,871 | 825 | 110 | 3,586 | ✓ | - |
| 2026-09-29 | 4,589 | 4,029 | 560 | 55 | 4,534 | ✓ | - |
| 2026-09-30 | 5,466 | 4,238 | 1,228 | 55 | 5,411 | ✓ | - |

### Branch 4 (B4 / B-5) Daily Sales Audit Table:
| Date | Revenue (THB) | Cash (THB) | Scan (THB) | Expense (THB) | Net (THB) | Verify | Flags & Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| 2026-09-30 | 2,420 | 1,634 | 786 | 60 | 1,574 | ✓ | - |
| 2026-09-29 | 2,438 | 1,641 | 797 | 60 | 1,581 | ✓ | Watermelon Big - 4 (cash) |
| 2026-09-28 | 2,821 | 2,013 | 808 | 60 | 1,953 | ✓ | Watermelon Big (109) - 1 cash, 1 scan; Orange No ice (100) - 1 cash; Mangosteen No ice (150) - 1 scan |
| 2026-09-27 | 1,406 | 1,026 | 380 | 60 | 966 | ✓ | Water no ice - 1 |
| 2026-09-25 | 299 | 60 | 239 | 0 | 60 | ✓ | - |
| 2026-09-25 | 299 | 60 | 239 | 0 | 60 | DUP | Duplicate photo of Image 5 before the date header was filled in. |
| 2026-09-23 | 1,156 | 887 | 269 | 0 | 887 | ✓ | - |
| 2026-09-22 | 888 | 369 | 519 | 0 | 369 | ✓ | - |
| 2026-09-19 | 220 | 55 | 165 | 60 | -5 | ✓ | - |
| 2026-09-20 | 299 | 110 | 189 | 60 | 50 | ✓ | - |
| 2026-09-21 | 488 | 269 | 219 | 60 | 209 | ✓ | - |

---
## 4. Fruit Usage & Cost Allocation Across 4 Branches (ADR 0001)
Under ADR 0001, fruit costs are allocated by **actual branch consumption** (cup counts derived from daily sales sheets):

| Fruit Pool Item | B1 Cups | B2 Cups | B3 Cups | B4 Cups | Total Cups | B1 % | B2 % | B3 % | B4 % | Total Cost (THB) | B1 Share | B2 Share | B3 Share | B4 Share |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Watermelon | 622 | 273 | 450 | 49 | 1394 | 44.6% | 19.6% | 32.3% | 3.5% | ฿22,160.00 | ฿9,883.36 | ฿4,343.36 | ฿7,157.68 | ฿775.60 |
| Mango | 126 | 42 | 315 | 6 | 489 | 25.8% | 8.6% | 64.4% | 1.2% | ฿21,584.00 | ฿5,568.67 | ฿1,856.22 | ฿13,900.10 | ฿259.01 |
| Coconut | 267 | 121 | 393 | 5 | 786 | 34.0% | 15.4% | 50.0% | 0.6% | ฿11,675.00 | ฿3,969.50 | ฿1,797.95 | ฿5,837.50 | ฿70.05 |
| Orange | 336 | 108 | 271 | 28 | 743 | 45.2% | 14.5% | 36.5% | 3.8% | ฿10,720.00 | ฿4,845.44 | ฿1,554.40 | ฿3,912.80 | ฿407.36 |
| Pineapple | 74 | 27 | 162 | 10 | 273 | 27.1% | 9.9% | 59.3% | 3.7% | ฿9,190.00 | ฿2,490.49 | ฿909.81 | ฿5,449.67 | ฿340.03 |
| Apple | 223 | 102 | 266 | 6 | 597 | 37.4% | 17.1% | 44.6% | 1.0% | ฿8,000.00 | ฿2,992.00 | ฿1,368.00 | ฿3,568.00 | ฿80.00 |
| Guava | 176 | 66 | 154 | 5 | 401 | 43.9% | 16.5% | 38.4% | 1.2% | ฿6,675.00 | ฿2,930.32 | ฿1,101.38 | ฿2,563.20 | ฿80.10 |
| Durian | 0 | 0 | 1 | 0 | 1 | 0.0% | 0.0% | 100.0% | 0.0% | ฿9,670.00 | ฿0.00 | ฿0.00 | ฿9,670.00 | ฿0.00 |

---
## 5. Final Management P&L for September 2026 (4 Operating Branches)
Applying actual staff payroll, evidenced rents, storage rental (฿3k/shop), and 70% Blessme / 30% Ming profit sharing per `CLAUDE.md`:

| Financial Line Item | Branch 1 (B1) | Branch 2 (B2) | Branch 3 (B3) | Branch 4 (B4) | Total All Operating | Basis & Allocation Method |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Gross Sales Revenue** | ฿135,223.00 | ฿48,860.00 | ฿161,444.00 | ฿12,435.00 | ฿357,962.00 | Sum of verified daily sales sheets |
| *Less: Shift Expenses (Shop)* | (฿2,875.00) | (฿1,470.00) | (฿3,179.00) | (฿420.00) | (฿7,944.00) | Daily shop ice & minor supplies |
| **Net Revenue** | **฿132,348.00** | **฿47,390.00** | **฿158,265.00** | **฿12,015.00** | **฿350,018.00** | Net shop receipts |
| **Cost of Goods Sold (COGS)** | | | | | | |
| - Fruit Pool Usage | (฿34,510.60) | (฿12,947.53) | (฿50,203.28) | (฿2,012.59) | (฿99,674.00) | ADR 0001 actual cup consumption |
| - Sticky Rice | ฿0.00 | ฿0.00 | (฿13,174.00) | ฿0.00 | (฿13,174.00) | 100% B3 (Mango Sticky Rice menu) |
| - Packaging & Milk | (฿5,871.49) | (฿2,121.71) | (฿7,010.46) | (฿539.34) | (฿15,543.00) | Revenue share (37.78% / 13.65% / 45.10% / 3.47%) |
| - Unresolved Supplies/Fruit | (฿2,591.95) | (฿936.37) | (฿3,093.64) | (฿238.04) | (฿6,860.00) | Revenue share provisional |
| **Total COGS** | **(฿42,974.04)** | **(฿16,005.61)** | **(฿73,481.38)** | **(฿2,789.97)** | **(฿135,251.00)** | |
| **Gross Profit** | **฿89,373.96** | **฿31,384.39** | **฿84,783.62** | **฿9,225.03** | **฿214,767.00** | |
| *Gross Margin %* | *67.53%* | *66.23%* | *53.57%* | *76.78%* | *61.36%* | |
| **Operating Expenses (OPEX)** | | | | | | |
| - Branch Rental | (฿35,000.00) | (฿25,000.00) | (฿18,780.22) | (฿22,966.67)* | (฿101,746.89) | Direct evidenced lease payments (*B4 rent option) |
| - **Storage Rental (฿12k / 4)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿3,000.00)** | **(฿12,000.00)** | **฿12,000 pool split equally 4 ways** |
| - **Staff Payroll (Exact)** | **(฿25,500.00)** | **(฿22,800.00)** | **(฿45,000.00)** | **(฿10,000.00)** | **(฿103,300.00)** | **Exact staff breakdown from owner** |
| - Partner Salary (Ming) | (฿5,000.00) | (฿5,000.00) | (฿5,000.00) | (฿5,000.00) | (฿20,000.00) | Slip 47 split equally 4 ways |
| - Electricity (Utilities) | ฿0.00 | ฿0.00 | (฿1,592.22) | ฿0.00 | (฿1,592.22) | Slip 45 direct B3 power only |
| - Logistics, Delivery, Supplies | (฿4,684.34) | (฿1,692.79) | (฿5,592.59) | (฿430.28) | (฿12,400.00) | Revenue share |
| **Total OPEX** | **(฿73,184.34)** | **(฿57,492.79)** | **(฿78,965.03)** | **(฿41,396.95)** | **(฿251,039.11)** | |
| **Net Operating Profit / (Loss)** | **฿16,189.62** | **(฿26,108.40)** | **฿5,818.59** | **(฿32,171.92)** | **(฿36,272.11)** | *With B4 full rent |
| *Net Margin %* | *12.23%* | *-55.10%* | *3.68%* | *-267.76%* | *-10.36%* | |
| **Profit Distribution (70/30)** | | | | | | |
| - **Blessme (70%)** | **฿11,332.73** | ฿0.00 (Loss) | **฿4,073.01** | ฿0.00 (Loss) | **฿15,405.74** | Distributed to Blessme |
| - **Ming (30%)** | **฿4,856.89** | ฿0.00 (Loss) | **฿1,745.58** | ฿0.00 (Loss) | **฿6,602.47** | Distributed to Ming |
| - **Quarantined Losses** | ฿0.00 | **(฿26,108.40)** | ฿0.00 | **(฿32,171.92)** | **(฿58,280.32)** | Quarantined per branch to offset future profits |

*Note on B4 Rent Alternatives:*
- If B4 rent (฿22,966.67) is **pro-rated** for the 10-11 operating days (฿8,421.11 operating, remainder ฿14,545.56 to Pre-Opening Capital), B4 Operating Loss is reduced to **(฿17,626.36)**.
- If B4 rent is treated **100% as Pre-Opening Setup Capital** (like B2 and B3 setup months), B4 Operating Loss is only **(฿9,205.25)**.

---
## 6. Pending Final Owner Decisions
1. **B4 Operating Days & Duplicate Photo:** We identified 11 photos in `B4/sale/Sep26`, but Photo 5 and Photo 6 are duplicate shots of the same shift (25/09). This leaves 10 unique evidenced dates (19, 20, 21, 22, 23, 25, 27, 28, 29, 30 Sep). Is there an 11th shift missing (e.g. 24 or 26 Sep), or was Photo 6 counted as the 11th?
2. **B4 September Rent Treatment:** Should B4's ฿22,966.67 rent be: (A) 100% charged to September operations, (B) Pro-rated for 11 days (฿8,421 operating, ฿14,546 setup), or (C) 100% held in the B4 Setup Capital Account?
3. **Ming Salary Split:** Should Ming's ฿20,000 salary be split 4 ways (฿5,000 per shop, as shown above) or 3 ways across B1, B2, B3 (฿6,666.67 each)?
4. **Slip 41 (฿1,275.00):** Confirm cutting this ttb→BBL internal transfer (like Slips 2 and 70).
5. **B2 Missing Days:** Confirm 4 missing days (20, 21, 22, 26 Sep) as closed days.
6. **Approval to Write:** Confirm approval to stage and commit to Excel.