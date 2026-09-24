# Batch review — August 2026 expenses

**Batch ID:** `BATCH-2026-09-14-AUG-EXPENSES`
**Opened:** 14 Sep 2026 · **Scope:** `B1/2_Expenses/Aug26`, 113 images
**Outcome requested:** review only · **`import_allowed: false`**

Nothing in this batch has been written to any workbook. No Excel file was opened for writing, no generated JSON was touched, and nothing was deployed.

---

## 1. Coverage

| | Count |
|---|---:|
| Files in folder | 113 |
| Hashed into manifest | 113 |
| Read from the image | 113 |
| Unreadable / skipped | 0 |
| Exact-byte duplicates within Aug26 | 0 |

Every file is a JPEG and every file has one disposition. Manifest count reconciles to dispositions.

Six exact-byte duplicate pairs *were* found, but all six sit in **Jun26**, where the 22 Jun LINE album was re-uploaded inside the 1 Jul album. They are outside this batch and are noted for the Jun/Jul work, not acted on here.

**Coverage caveat:** one slip (idx 42) has its memo partly covered by the slip's own QR code. The visible lines were read and they reconcile, but I cannot rule out a further hidden line. That memo's coverage is *not* certified.

## 2. Money observed

Total across all 113 payments: **฿504,860.22**

| Proposed bucket | Amount |
|---|---:|
| OPEX | 233,815.22 |
| COGS | 220,242.00 |
| UNRESOLVED | 18,127.00 |
| EXCLUDED (profit distribution) | 12,884.00 |
| MIXED (needs per-item split) | 10,292.00 |
| CAPEX | 9,500.00 |

These are *proposed* buckets from memo evidence. They are not approved, and the totals include amounts that will change once the open questions below are answered. **Do not read ฿504,860.22 as August operating cost** — it contains a July rent payment, two September payrolls, a July profit distribution, capital items, and ฿11,200 of July watermelon.

## 3. Payment month vs accounting month

| Payment month | Slips |
|---|---:|
| Aug 2026 | 110 |
| Jul 2026 | 1 |
| Sep 2026 | 2 |

Payment date and service period are stored as separate fields throughout. Nothing was moved between months.

## 4. Branch allocation

You confirmed the B1 folder is a drop box and costs are really allocated across branches. That is exactly what the evidence shows — **folder path was not used as branch evidence anywhere in this batch.**

**Branch stated explicitly in the memo (7 slips, ฿100,780.22):**

| Slip | Branch | Amount | Memo |
|---|---|---:|---|
| 104 | B1 + shared | 47,000.00 | `ค่าเช่า b1 35000 + stock 12000 เดือน august` |
| 113 | B2 | 20,000.00 | `ค่าเช่าที่ b2 เดือน august` |
| 112 | B2 | 5,000.00 | `ค่าเช่า b2 เดือน august` |
| 38 | B3 | 18,780.22 | `ค่าเช่า b3 เดือน august (8)` |
| 72 | B3 | 5,000.00 | `B3 Aug pre-salary arkar 3000 / HtunKyaw 2000` |
| 111 | B3 | 3,500.00 | `Salary b3 7days august` |
| 80 | B3 | 1,500.00 | `B3 washing fee` |

**No branch stated (106 slips).** For the fruit, packaging and ice purchases this is *correct, not a gap* — they are shared-pool buys that get allocated downstream by usage and revenue share under ADR 0001. For the salary, transport and equipment slips it is a genuine unknown and is recorded as `unresolved`.

## 5. What reconciled cleanly

Three configured figures were independently confirmed by the evidence, to the satang:

- **B3 August rent ฿18,780.22** — matches the MWA01 lease table exactly. The ฿19,000 round figure previously carried for B3 was indeed a guess.
- **B1 rent ฿35,000 + shared stock rent ฿12,000** on one slip — both match, and the ฿12,000 partitions ฿4,000/฿4,000/฿4,000 per the documented rule.
- **Orange at 22 kg/crate** — slip idx 99 states `ส้ม 31x22กก . 682กกx30 บาท . 20,460บาท` plus freight `31x50 = 1,550`, totalling ฿22,010 exactly. The 22 kg convention is written on the slip, not assumed.

Every multi-line memo except one conserves its parent total exactly. That covers the Shopee restock session, the coconut purchases, the consolidated watermelon settlements and the multi-staff payroll slips.

**The B2 rent puzzle resolved itself.** Slip 113 alone looked like a ฿5,000 shortfall against the documented ฿25,000. Slip 112, one minute later, pays the remaining ฿5,000 to a different recipient. ฿20,000 + ฿5,000 = ฿25,000. Neither slip evidences the rent alone; the pair does.

## 6. Open questions — I need your answers before anything is written

### 6.1 Blocking

**A. Two ฿40,000 payrolls, same name, different accounts.**
1 Sep → นาย ฐิติภูมิ สิงห์สา, SCB 235-2-xxx024 · 3 Sep → นาย ฐิติภูมิ สิงห์สา, SCB 579-4-xxx159. Same ฿40,000, same memo `เงินเดือนพนักงานเดือนสิงหาคม`, same August period, two days apart. Two legitimate branch payrolls, or a duplicate/re-send? I will not decide this on resemblance. **฿40,000 at stake.**

Related: this person appears on a *third* SCB account (xxx-x-x1015-x) receiving the B1 rent, and the 235-2-xxx024 account also receives the B3 rent. Which accounts belong to whom matters for the answer.

**B. Ming's August salary — ฿10,000 or ฿20,000?**
Two slips, 4 Aug and 10 Aug, identical memo `Salary min aug 10000`, identical ฿10,000, different references. Two instalments summing to the documented ฿20,000 — or one payment photographed and paid twice? The sum matching the documented rate is suggestive, but I won't pick a reading because it balances. **฿10,000 at stake.**

**C. The ฿14,560 watermelon settlement is mostly July.**
Paid 3 Aug, but the annotation breaks it into deliveries on 26 Jul, 28 Jul, 31 Jul and 3 Aug. **฿11,200 is July cost, ฿3,360 is August.** B1 already has 100 expense rows booked for July — these three July deliveries must be checked against them or July watermelon gets double-booked. Adding rows into July also needs your explicit authorisation.

**D. The July rent slip filed in the August folder.**
฿30,000 paid 2 Jul by นาย ฐนกร ไทยขำ for `ค่าเช่าเดือน 06/69 (น้ำส้ม)` — a July payment for June service, sitting in the Aug26 folder. Three months in one document. June rent is very likely already booked. Which branch, and is it already in the books?

**E. Coconut slip that doesn't add up.** ฿8,100 paid; the three memo lines total ฿7,600. **฿500 unexplained.** The same supplier's 8 Aug slip reconciles perfectly, so this is specific to this slip.

**F. Pineapple slip that doesn't add up.** `สับปะรด 55 กิโล (35 ลูก) โลละ 50 บาท รวม 1925` — 55 × 50 = 2,750, not 1,925. Paid amount and stated total agree at ฿1,925, so the unit price is the odd figure. **฿825 discrepancy.**

### 6.2 Classification calls that are yours, not mine

| Slip | Amount | Memo | Question |
|---|---:|---|---|
| 8 | 4,250 | `เมนไปทำใบขับขี่` | Driving licence for Ming — staff welfare, a staff advance, or personal? |
| 18 | 2,377 | *(no memo at all)* | Payment to Ming with no stated purpose. Cannot be classified. |
| 25 | 11,500 | `ค่าแรงพนักงานเดือนสิงหาคม` | Payer and payee share the name เมธาสิทธิ์. Self-transfer (internal, not an expense) or a real wage to another person? |
| 102 | 3,721 | `Police fee 2000 other equipment 1721` | "Police fee" has no category in `business_rules.js`. Permit, licence, fine? |
| 50 | 360 | `ข้าวเหนียวมูน 2 โล + กะทิ` | Mixed, no subtotals. Parent known, split unresolved. |
| 60 | 895 | `ฝา439 / ทิชชู456` | Is tissue consumable packaging (COGS) or a shop supply (OPEX)? |
| 105 | 150 | `ค่ายกของ` | Porterage — Transportation or Other OPEX? |

**CAPEX held out of the expense buckets (฿9,500 + items inside mixed slips):** 3 cameras ฿4,486, shop fit-out ฿2,440, acrylic display box ฿1,500 (`Durian shop invest` — possibly not a juice-bar branch at all), two tables, a folding table, cutting boards, a cold-press machine and a tent. None of these were defaulted into COGS/OPEX. You need to tell me the capitalise-or-expense policy and, for the Durian shop item, which entity it belongs to.

### 6.3 Things to be aware of

- **Ming's ฿12,884 July profit share** is booked `EXCLUDED / Profit Distribution / amt 0` in the P&L, with the real payment preserved in the evidence. The 30% rate on the memo matches the Jul26 effective-dated rule. Zero P&L effect is not a zero payment.
- **B3 August payroll is fragmented** — a ฿5,000 advance (2 named staff), a ฿3,500 7-day payment, plus a ฿1,500 washing fee. The advance must be linked to whatever settles it or it will be counted twice.
- **August payroll doesn't reconcile to the fixed-cost table** and isn't expected to yet: ฿91,500 of evidenced wage payments against ฿111,500 configured for B1+B2+B3, before Ming's wage and before the two blocking questions above are answered.

## 7. Note on the legacy parser

This batch contains **three** slip formats — Bangkok Bank (`จำนวนเงิน` / `บันทึก`), KBank K+ (`จำนวน:` / `บันทึกช่วยจำ:`) and ttb. `process_expenses.js` recognises only the KBank labels, so it would have silently dropped a large share of these payments. Separately, several of the most important slips carry their item detail in **handwritten annotations outside the bank memo box** — the ฿14,560 watermelon settlement's memo field says only `แตงโม`, and the ฿2,850 slip's memo omits the soybean line entirely. A memo-field parser would have mis-booked both. Reading visually avoided all of this, and it is further reason the parser stays off.

## 8. Next step

Answer section 6 and I will produce the proposed change list — exact rows, old and new values, bound to source hashes — for your approval. Only after that is approved does anything approach a workbook, and the write itself still needs a safe importer with backup, dry run, readback and rerun-equals-zero-changes, which does not exist yet.

## 9. Files

- `manifest.json` — 113 sources with SHA-256 and disposition
- `extraction.json`, `extraction_part2..6.json` — full per-slip transcriptions: raw memo lines, field states, item splits, computed checks, duplicate candidates, issues
- `REVIEW_PACKAGE.md` — this document
