# Som Sai Jai financial reliability review — 8 September 2026

**Conclusion: the dashboard is current and its P&L arithmetic reconciles, but the books are not yet ready to certify partner balances, final branch profit, or SKU-cut decisions. No defensible overall “90% accurate” score has been established.**

This was a read-only review of the current Jan–Jul books and August completeness, at commit `715f540`. No Excel, dashboard, business-rule, or deployment changes were made. Amounts below are baht. “Current model” means what the existing system computes, not an independently certified financial result.

**What was checked**

- All 338 generated daily sales records across 12 operating branch-months against workbook fields; all 492 generated expense rows against normalized Excel expense rows.
- Fresh in-memory P&L calculation against every field in `reports_data.json`; monthly group cost conservation, P&L arithmetic, branch loss carry-forward, and partner split arithmetic.
- Public live `data.json` and `reports_data.json` against local files; backup HTML embedded data against local data. All matched. The live browser UI was not separately exercised; the existing local rendering test passed.
- B1 Jan–Mar daily revenue against the saved owner-sheet transcription (`audit/gsheet_source.json`, captured 5 August); B3 July against its local revenue-only source. These are saved records, not freshly retrieved independent POS/bank exports.
- OCR screened 128 images: B1 February sales (28), June expenses (69), and July sales (31). Visually inspected the decisive February sale, June payroll slip, and July 1/3 sales reports. Also read the July warehouse-rent slip. OCR screening is not full visual validation of every field or expense completeness.
- Existing tests passed: expense rules, memo parser, 13 finance-render views; the existing sheet parser self-check also passed. The new read-only reconciliation includes seeded difference checks and an expense-impact scenario check.

No bank PDFs were decrypted in this review, no cash count was provided, and no complete owner-funded payment or partner-settlement register was available. Missing bank evidence is not evidence of nonpayment. Source-file SHA-256 hashes and detailed differences are saved in [financial_reliability_2026-09-08.json](financial_reliability_2026-09-08.json).

**1. Decision status**

| Area | Status | Permitted interpretation |
|---|---|---|
| Excel → JSON → saved P&L → live JSON | Reconciled, with one excluded pre-opening workbook row | The published numbers reproduce the current model. |
| B1 January/March monthly revenue | Reconciled to saved owner record | Monthly revenue agrees; January daily/channel differences remain. |
| B1 February revenue | Not ready for final use | Source-supported ฿2,000 overstatement remains in Excel. |
| B1/B2 April–July revenue | Usable with stated exceptions | Internal transfer matches; full fresh source validation was not completed. July theoretical gaps need price/bottle corrections. |
| B3 July revenue | Reconciled to local revenue transcription | ฿171,897 across 21 days matches. Product counts, usage, channel split, and ice are not all observed actuals. |
| Branch profit | Usable only as a provisional model; June/July settlement not ready | Payroll, rent period, estimated allocation, and cost completeness remain unresolved. |
| SKU profitability | Not ready for cuts or precise ROI claims | Wrong price handling, missing bottle attribution, estimated sales, zero Young Coco cost, and incomplete cost basis. |
| Partner money owed / cash available | Not ready | Computed shares are not payments or verified balances. |
| August, all three branches | Not ready | Zero sales rows and zero expense rows; absence is not zero business activity. |

**2. Current branch-month figures and exceptions**

For every operating row below, Excel revenue = generated JSON revenue = saved report revenue, with a ฿0 transfer difference. Allocated COGS differs from the expense-booking branch by design because purchases are pooled.

| Branch | Month | Days | Recorded revenue | Allocated COGS | Current model net | Main exception |
|---|---|---:|---:|---:|---:|---|
| B1 | Jan26 | 31 | 274,405.00 | 84,570.00 | 125,571.00 | Two daily revenue differences cancel; cash differences; bundled purchase; historic SKU pricing. |
| B1 | Feb26 | 28 | 340,060.00 | 130,274.00 | 130,639.00 | Revenue should be reviewed downward ฿2,000; SKU distribution synthetic. |
| B1 | Mar26 | 31 | 286,925.00 | 133,748.00 | 38,719.53 | Expense reconciliation not closed; ฿49,560 orange row lacks quantity. |
| B1 | Apr26 | 30 | 313,858.00 | 182,038.53 | 26,913.47 | Source coverage incomplete; cash/scan difference; CAPEX/purchase-cost basis. |
| B1 | May26 | 31 | 255,780.00 | 98,467.92 | 48,999.08 | Cash/scan difference; agreed historical share differs from current calculation. |
| B1 | Jun26 | 30 | 191,720.00 | 110,864.73 | -16,233.73 | Potential ฿24,400 payroll overstatement. |
| B1 | Jul26 | 31 | 242,090.00 | 97,118.03 | 42,188.22 | June carry-forward, stock-rent period, orange price/bottles. |
| B2 | Apr26 | 13 | 69,260.00 | 39,558.47 | -25,588.47 | Allocation-based profit; expense completeness not certified. |
| B2 | May26 | 31 | 171,531.00 | 73,266.08 | 41,664.92 | Cash/scan difference; historical settlement reconciliation. |
| B2 | Jun26 | 30 | 115,570.00 | 76,270.27 | -23,470.27 | Joint payroll interpretation; stock rent. |
| B2 | Jul26 | 31 | 135,960.00 | 78,505.32 | -3,675.32 | Allocation, stock-rent period, price scope, loss balance presentation. |
| B3 | Jul26 | 21 | 171,897.00 | 86,471.66 | 19,469.18 | Estimated product mix/usage and ฿2,310 ice; salary support and rent period. |
| B1/B2/B3 | Aug26 | 0 each | Not entered | Not entered | Not available | Salary/rent requirements documented, no August bookings. |

The B2 `Mar26` sheet also contains a headerless 1 March row: revenue ฿10,130, daily expense ฿120. It matches B1’s 1 March row and predates B2’s 18 April opening. The current exporter silently skips it because it has no header. Treat it as a suspected copied template row requiring quarantine/confirmation, not as ฿10,130 of missing legitimate revenue. Do not make the exporter ingest it blindly.

| Month | Group revenue | Ledger costs + daily expenses | Current model net | Arithmetic difference |
|---|---:|---:|---:|---:|
| Jan26 | 274,405.00 | 148,834.00 | 125,571.00 | 0.00 |
| Feb26 | 340,060.00 | 209,421.00 | 130,639.00 | 0.00 |
| Mar26 | 286,925.00 | 248,205.47 | 38,719.53 | 0.00 |
| Apr26 | 383,118.00 | 381,793.00 | 1,325.00 | 0.00 |
| May26 | 427,311.00 | 336,647.00 | 90,664.00 | 0.00 |
| Jun26 | 307,290.00 | 346,994.00 | -39,704.00 | 0.00 |
| Jul26 | 549,947.00 | 491,964.91 | 57,982.09 | 0.00 |
| Total | 2,569,056.00 | 2,163,859.38 | 405,196.62 | 0.00 |

Monthly allocated COGS sums back to pooled COGS with no difference at satang precision. These controls detect calculation/transfer errors; they cannot prove that omitted transactions do not exist.

**3. Source-supported correction: B1 27 February revenue**

- Workbook: B1 `Feb26!C30` = **13,325**.
- [Original sales photo](../../B1/1_Sale/Feb26/LINE_ALBUM_ยอดขายกุมภา_260324_2.jpg): dated 27 February, total **11,325**. Cash 5,370 + scan 5,940 + Alipay adjustment 15 = 11,325. The saved owner record also says 11,325.
- Proposed revenue correction: **−2,000**. With existing costs unchanged, February revenue becomes 338,060 and model net becomes 128,639. This does not authorize restating historical cash distributions.
- Excel’s scan field is blank and currently becomes 7,955 through `revenue − cash`; the corrected derived remainder would be 5,955, including the 15 adjustment. An explicit channel record should distinguish that adjustment.
- The source’s orange/watermelon counts are 133/52, while Excel uses 109/76. Both sum to 185: this directly demonstrates that matching total cups does not verify SKU mix. Do not repair only this one day and imply the entire synthetic February split is now valid.

Jan–Mar changes require owner approval under [ledger-integrity/SKILL.md](../../.claude/skills/ledger-integrity/SKILL.md): “Never move a row into Jan/Feb/Mar, and never restate one, without asking him first.” This review’s authorization was read-only; no correction was applied.

**4. High-impact unresolved expense: June payroll**

| Record | Current amount |
|---|---:|
| B1 `Daily_Expenses!F328`, 30 June, four staff + one daily worker | 48,400 |
| B2 `Daily_Expenses!F13`, explicitly described as B2 portion of joint 48,400 | 24,000 |
| B2 `Daily_Expenses!F14`, explicitly described as daily-worker portion of joint 48,400 | 400 |
| Total in P&L | **72,800** |

The [30 June slip](../../B1/2_Expenses/Jun26/IMG_0332.JPG) shows 48,400 and the memo “four people at 12,000 each and one daily worker at 400.” It is a transfer between owner-named accounts, so the memo supports its payroll purpose but the slip is not itself employee-level disbursement evidence.

**Strong duplicate-allocation candidate: 24,400.** Confirm that 48,400 was the combined payroll and that the intended split was B1 24,000 / B2 24,400. Absence of another payment in this review is not proof that none occurred.

Scenario only, holding everything else constant: reducing B1’s line to 24,000 changes B1 June net from −16,233.73 to +8,166.27 and group June net from −39,704 to −15,304. It removes B1’s 16,233.73 opening loss in July, raising July B1 distributable profit from 25,954.50 to 42,188.22. June’s 8,166.27 also becomes distributable under the current rules. No scenario was written into the ledger.

The old duplicate detector misses this shape: its split search is restricted to the same branch and `[bank]` rows. This example spans branches and the main row lacks that tag.

**5. Warehouse rent: amount present, period unresolved**

The [6 July 12,000 slip](../../B1/2_Expenses/Jul26/LINE_ALBUM_Cost%20July_260802_35.jpg) explicitly says “ค่าเช่า stock เดือน june”. Excel books it to July as 4,000 per branch, including B3 before its trading opening. June already contains 12,000 of warehouse rent, split 6,000/6,000 and linked to an 8 June payment.

Clarify which rental periods the two payments settle before changing anything. This could be a memo error, advance/arrears payment, or allocation/timing issue. It is **not yet a proven duplicate**. Up to 12,000 needs period reconciliation; automatically moving it to June would compound the problem. The existing detector checks Thai month abbreviations and misses English “june”.

**6. July variance and SKU profitability**

The reported B1 July cup-only gap is **13,000 / 242,090 = 5.37%**. B2’s gap is 5,080 / 135,960 = 3.74%; B3’s is 6,917 / 171,897 = 4.02%. The combined gap is 24,997 / 549,947 = 4.55%. B3’s counts are estimated, so its gap is not an independent reconciliation.

The [1 July B1 report](../../B1/1_Sale/Jul26/LINE_ALBUM_B1.%2072026_260802_31.jpg) explicitly changes the orange price from printed 60 to 70; 13 cash + 13 scan cups are priced at 910 + 910. The [3 July report](../../B1/1_Sale/Jul26/LINE_ALBUM_B1.%2072026_260802_29.jpg) also shows 70 and two 200-baht bottle sales. Excel records bottle counts as zero for that day. These are concrete omissions from the comparison model, not evidence of missing cash.

If 70 applied to all 1,024 B1 July orange cups, price alone explains **10,240** of the 13,000 gap, leaving 2,760 before bottles and source arithmetic checks. This is a sensitivity calculation, not a confirmed full-month correction; the effective date and branch scope still need confirmation. Recorded revenue need not change merely because its theoretical comparison is wrong.

Additional confirmed model limitations:

- Daily audit subtracts premium orange cups from total orange before pricing, but monthly/annual SKU reports add premium cups on top. Under the daily method, report orange revenue is 900 too high in April, 60 in May, and 300 in June: **1,260 total**, without affecting branch P&L revenue.
- SKU reports ignore January’s effective-dated prices. Relative to the daily method, January orange revenue is understated 21,980 and watermelon 10,275. Neither daily method nor report currently captures July’s evidenced 70-baht pricing.
- Young Coco has **cost hardcoded to zero**. Its 40 recorded cups cannot establish actual profit; the displayed 100% margin is unsupported.
- Coconut 302.3% and guava 5.7% are current **modeled cup revenue versus selected ingredient purchase costs**. They are not fully loaded SKU net returns. Shared packaging/ice and operating expenses are outside those SKU cost lines.
- `calculatePL` expenses booked monthly purchases and allocates them; it does not reconcile opening stock + purchases − closing stock. `stock_ledger.json` has only April checks, latest 29 April. Monthly product profitability and inventory consumption are therefore not established by purchase spend alone.
- B3 July contains 2,864 estimated cups; its source provides revenue only. Its 2,310 daily ice cost is explicitly an owner estimate (110/day) in `ice_audit.json`. Modeled raw usage is treated as positive usage by the allocator. Switching only B3 to the existing revenue-share fallback changes its modeled July net by +4,548.59, holding group profit constant—an allocation sensitivity, not a recommended correction.

Do not make SKU-cut decisions until price eras, bottles, observed versus estimated mix, and the relevant cost basis are explicit. Better revenue agreement after fitting estimated mix would not independently validate that mix.

**7. Cash/channel controls and partner balances**

Three generated records fail `revenue = cash + scan`:

| Branch/date | Revenue | Cash | Scan | Revenue less channels |
|---|---:|---:|---:|---:|
| B1 1 April | 10,480 | 6,300 | 4,280 | -100 |
| B1 1 May | 13,950 | 8,040 | 5,730 | +180 |
| B2 12 May | 3,400 | 2,550 | 970 | -120 |

Gross absolute difference is 400; signed net is −40. Check sources before deciding which field is wrong; do not simply force scan to balance. B1 has 59 blank scan cells in Jan/Feb plus one in March; generated remainders are derived amounts, not bank verification. B3’s workbook assigns all July revenue to scan, which its revenue-only source does not independently support.

Against the saved owner record, January revenue differs on day 2 by +60 and day 18 by −60; cash differs on days 2, 18, 24, and 29. Additional cash differences exist in February and March. The detailed JSON lists all ten affected rows; the saved source itself documents unreliable March splits. No competing source was silently chosen.

| Month | Current calculated distributable total | Historically recorded payment total |
|---|---:|---:|
| Jan26 | 125,571.00 | 126,279.00 |
| Feb26 | 130,639.00 | 142,589.00 |
| Mar26 | 38,719.53 | 64,503.28 |
| Apr26 | 26,913.47 | 95,405.00 |
| May26 | 65,075.53 | 0 recorded in saved history |
| Jun26 | 0.00 | 0 recorded in saved history |
| Jul26 | 45,423.68 | No final payment register available |

Historical payments are preserved facts from the saved owner-confirmation record, not new payment confirmations from this review. Differences are **not clawback demands**. April’s distributable total exceeds group net because branch losses are quarantined; it is not an arithmetic error.

Current May + July computed shares total **110,499.21**: Blessme **72,449.54**, Ming **38,049.67** (one-satang display differences arise when independently rounding components). The handoff says roughly 86,000, but its rough components 54,000 + 26,000 sum to 80,000. A separate historical note in `audit/may_reconcile.js` records an owner-booked May split of 41,128 / 22,318 = 63,446. None of these numbers can substitute for a settlement ledger. Confirm agreed entitlement, actual payment, retained balance, and any agreed reinvestment by month/branch/partner.

Monthly loss carry-forward and split arithmetic pass. **Annual presentation has a separate defect:** B2’s closing July carried loss computes to **27,145.59**, while `reports_data.json → all.b2.loss_carry_forward` is zero because the annual object never accumulates or assigns the closing balance. Future monthly calculations still carry the loss; the annual display must not be used as the outstanding balance.

The old running cash statement is not a reconciled bank/cash balance: its builder uses accrual ledger dates for outflows, approximate payout dates, omits daily sales-sheet expenses, and lacks a complete financing/deposit/owner-account register. Do not infer actual cash available from its closing or minimum balance. The historical “7% bank trace” / “93% no bank trace” claims were not reproduced here and are not accuracy percentages.

**8. Expense evidence and document reliability**

The existing detector reports five same-day/amount candidate groups, all documented in the prior audit as separate real payments. None was deleted. It reports no same-branch split or Thai-month mismatches, but the June payroll and English rent memo show why those clean results are not a completeness certificate.

The fruit-quantity script reports 119,082 unparsed and 36,137 freight on 870,265 of selected fruit categories. Its result is not a reliable coverage score: it classifies **all 20,790 of July Coconut as freight** because its quantity parser ignores `kg` and litres, despite the memos containing meat/water quantities. It also omits separate coconut/milk categories from that roll-up. The earlier 12% orange-unquantified statistic is about quantity parsing, not overall financial accuracy. Orange’s 51,810 unquantified amount remains a separate known limitation.

The 5,950 January orange/watermelon bundle still needs substantiated subtotals. Contrary to the handoff, 49 images currently exist in `B1/2_Expenses/Jan26`; this review has not established whether the relevant slip is among them. Do not label it unrecoverable without checking those files.

CAPEX/Investment totaling **19,248** remains deducted through OPEX in the current model (Feb 5,000; Mar 8,252; May 3,084; Jul 2,912). That is a known presentation/accounting-basis issue, not permission to add 19,248 back as certified profit; any alternative needs a complete asset schedule and agreed treatment.

Some old audit outputs are unsafe to reuse as findings: `expense_gap.js` labels benchmark deviations “genuinely unrecorded spend”, uses outdated fixed rates, and subtracts an old misfiled-distribution amount; `reconcile.js` prints retained profit as a hardcoded zero. Neither establishes those claims. Several handoff/skill profit figures are intermediate states (for example B3 July 21,022 versus current 19,469.18). The current calculated tables above supersede them only as model snapshots.

**9. Concrete correction and verification plan**

| Order | Action | Evidence / owner input needed | Completion condition |
|---|---|---|---|
| 1 | Approve the February −2,000 source correction; preserve historical payout record | Photo and saved owner record agree; Q1 authorization required | Excel 338,060 monthly revenue; generated data and report reconcile; channel adjustment explicit. |
| 2 | Resolve joint June payroll and June/July warehouse-rent periods | Confirm branch payroll split, whether any separate payroll existed, and rental periods settled | Each cost counted once; approved branch-month amounts and carry-forward recalculated. |
| 3 | Correct price/bottle and SKU report logic | Effective dates and branch scope for 70-baht orange; source bottle quantities/prices | One consistent pricing method; modeled and observed sales distinguished; residual daily gaps listed. |
| 4 | Correct annual closing-loss presentation and show payment status separately | Current monthly loss math; agreed historical distributions and payment records | Annual B2 closing balance agrees; no “calculated share = paid” implication. |
| 5 | Complete August from sources | August sales/expenses; Ming 20,000 B1 wage and B3 lease 18,780.22; search existing entries first | All three branches have an explicit completeness status and reconciled inputs. |
| 6 | Close cash/partner and SKU evidence gaps | Cash count, relevant bank/owner-account records, disbursements, stock/waste records | Reconciled cash and partner roll-forwards; SKU contribution measures with stated coverage. |

For approved changes: back up workbooks; use stable row identity, dry run, and idempotency; run meaningful checks; regenerate with `--no-deploy`; compare before/after branch profit, loss balances, and shares; update both dashboard views; deploy only within the subsequent authorized scope. Never overwrite generated JSON manually. Do not change ownership percentages or historical amounts paid to force agreement.

**Remaining decisions requested from the owner:** confirm the June payroll split and orange-price effective date/branch scope; identify where August and latest payment/cash records are kept. The read-only report is complete to the available evidence, while those financial conclusions remain open.

**10. Approved implementation — 8 September 2026**

The earlier tables are the preserved pre-correction audit snapshot. Following owner approval, the supported corrections were applied to the B1 source workbook and central calculations; generated files were rebuilt, never hand-edited.

| Item | Implemented result |
|---|---|
| B1 27 February revenue | 13,325 → 11,325. February revenue 338,060; calculated net profit 128,639. Historical payment records preserved. |
| B1 July orange price | 70 baht, bounded to July only. Other branches and later periods retain existing assumptions pending confirmation. |
| B1 3 July bottles | Restored 2 large bottles and explicit source revenue 400, using optional `Bottle Revenue (฿)` column. Actual daily revenue unchanged. |
| B1 July audit variance | 13,000 → 2,360; remaining variance unresolved. 3 July remaining variance 170. |
| SKU calculations | Premium orange counted once; date/branch prices used; annual revenue sums monthly results. Unknown Young Coco cost displays Unknown/N/A. |
| Loss and report presentation | B2 closing loss 27,145.59; actual loss offsets separate. Daily expenses visible; rental detail totals reconcile. Removed unsupported per-purchase revenue allocations. |
| Standalone backup | Generated from the live renderer with embedded current data, reports and local libraries. |

Validation: all `npm test` checks and standalone rendering checks passed, including 13 branch/month finance views in each version. Reconciliation found no new Excel field differences; the previously documented headerless B2 March preopening row remains excluded. All 492 normalized expenses match; reports recompute exactly; group arithmetic conserves costs; embedded backup data matches. The workbook correction is idempotent and backed up; all unrelated cell values/formulas and existing cell styles were verified unchanged. Browser review confirmed the provisional report, daily costs and closing loss presentation.

Post-correction evidence: `financial_reliability_2026-09-08_after.json`. Original baseline evidence remains preserved. Annual calculated group net is 403,196.62, exactly 2,000 below baseline.

Still open: June joint-payroll split (possible 24,400 overstatement), warehouse rental periods, July residual sales variances, other branch/period orange prices, August completeness, cash/partner-payment reconciliation, inventory and modeled SKU inputs. No unconfirmed expense correction or historical-payment restatement was made. Figures remain provisional, not certified final profit or payable balances.

Deployment verified: https://somsaijailive.vercel.app — deployment `dpl_7BwsWzUCaona9XJMqaLcHU8eFK6F`. Live index.html, data.json and reports_data.json exactly match verified local files.
