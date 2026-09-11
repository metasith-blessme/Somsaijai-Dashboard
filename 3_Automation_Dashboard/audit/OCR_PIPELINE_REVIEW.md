# OCR pipeline review — Som Sai Jai

## Scope and conclusion

Reviewed the current sales/expense extraction, staging/import, agent orchestration, central sales checks, repository guidance and existing financial-review notes. Executed the existing tests and read-only parser probes. This is a **code/workflow review**, not a new photo-by-photo audit or an accuracy certification. Existing uncommitted work was left intact. No OCR API calls, financial imports, workbook changes, regeneration or deployment were performed.

**Critical conclusion:** the current pipeline can convert OCR uncertainty into apparently verified financial records. Use [OCR_RULES.md](../../docs/OCR_RULES.md) as the operating policy; do not assume those rules are already enforced by code.

Paths below are relative to `3_Automation_Dashboard/`. Line references describe the code reviewed, which this task does not change.

## Findings, ordered by risk

### Critical — the verification command rewrites evidence and approves everything

`Sales_System_Automation/ocr-sales-dashboard/scripts/verify_sales.js:34-68` changes years, applies hardcoded May B2 corrections, replaces scan with revenue minus cash, replaces total cups with the calculated count, and unconditionally sets `verified: true`. It does not preserve uncertainty or require human approval.

Lines 77–122 backfill May records from generated `data.json`, reversing the documented source-of-truth direction. Lines 71–75 collapse same-branch/date conflicts by last-wins. Lines 131–135 catch an auto-correction error and then continue toward importing instead of failing closed.

**Required:** remove automatic correction/approval/backfill; immutable observed values; explicit human approval bound to the source and reviewed payload; duplicate conflict review. Do not run this command on production staging until fixed.

### Critical — expense OCR bypasses staging and overwrites the expense sheet

`Sales_System_Automation/process_expenses.js:204-207` falls back to `01/01/2026` and amount zero on failed extraction. Lines 215–225 append manual expenses without duplicate reconciliation. Lines 244–250 replace the entire `Daily_Expenses` sheet directly. Source image identity and review approval are not carried into those rows.

**Required:** extraction-only expense staging; no placeholder date/amount; provenance, duplicate checks, explicit approval and non-destructive import preserving unrelated data.

### High — sales auto-verification is not evidence verification

`Sales_System_Automation/ocr-sales-dashboard/scripts/process_sales.js:48` requests zero for missing fields. Lines 78–92 accept channel differences below two baht, accept absent/zero cup checks, and only look for `/2026` in the date. Lines 128–141 silently change 2086 to 2026 and set verification from these checks. The prompt omits explicit bottle fields and evidence metadata.

Its cup calculation adds premium orange to Orange, while `logic/business_rules.js:120-123` treats premium as a subset. This is an actual mapping inconsistency, not merely a missing confidence score.

Lines 113–117 cache by filename/branch without month or source hash; lines 151–159 choose one record per branch/date, discarding competing readings from the batch output. PNG inputs are sent as JPEG at line 59.

**Required:** strict schema/date validation, unknown states, source hashes, lossless fields, source-confirmed count semantics, conflict retention and review-only validation status.

### High — expense date and category parsers misinterpret plausible inputs

`Sales_System_Automation/process_expenses.js:14-33` recognizes prior-year tokens but always returns 2026 and does not validate calendar dates. `categorize()` at lines 78–115 assigns the entire slip to the first keyword and searches full text as well as the memo; utility-water and mixed-item classifications can be wrong. Hardcoded filename overrides at lines 163–201 are not tied to source hashes or approval evidence.

Read-only probes against the **actual exported parsers** returned:

| Probe (synthetic input, not a real payment) | Actual result |
|---|---|
| `parseThaiDate('17 มิ.ย. 68')` | `17/06/2026` — prior year silently changed |
| `parseThaiDate('31 ก.พ. 69')` | `31/02/2026` — impossible date accepted |
| `categorize('ส้ม 100 บาท แตงโม 200 บาท', '')` | Entire result `Orange / COGS` — mixed purchase not split |
| `categorize('ค่าน้ำ', '')` | `Water / COGS` — utility description matched as ingredient water |

These results show failure modes; they do not establish how many historical records are affected.

### High — failed imports can lose staging; updates can erase supported detail

`Sales_System_Automation/ocr-sales-dashboard/scripts/verify_sales.js:159-177` skips missing workbooks/sheets/headers. Lines 291–292 subsequently remove all verified records from staging, including ones skipped rather than imported. There is no transaction-wide preflight or readback confirmation.

Lines 216–244 build replacement rows initialized to zero and assign a limited field list; existing extra columns such as bottle evidence are not preserved. Lines 284–287 rebuild/write sheets without a backup or preservation verification. The destination year is hardcoded at lines 152/158.

**Required:** all-target preflight, approved dry-run diff, backups, preservation of unrelated fields/formulas/styles, readback, idempotency and clearing only successfully imported identities.

### High — alternate commands bypass the same safety boundary

`Sales_System_Automation/agents/ImageExtractorAgent.js:20` tells the model to derive missing channel amounts. Its schema uses `d` rather than the sales importer's `date` and conflates cup/ingredient descriptions.

`agents/Orchestrator.js:14-28` obtains image data and a sync plan but does not persist/apply that extracted result before running the legacy importer on the existing queue. It may therefore import different records from the image the operator just supplied. `agents/QADeployerAgent.js:18-21` regenerates/deploys before asking an AI about the deployment logs; this is not pre-import financial QA.

`ocr-sales-dashboard/scripts/sync_all.js:8-20` deletes matching lock files instead of proving a workbook is safe to edit, then calls legacy verification and deployment at lines 43–47.

**Required:** one deterministic approval gate across every entry point; no production deployment as part of OCR; no lock deletion to bypass a live editor.

## Existing protections and their limits

- Branch Excel files and central `business_rules.js` provide a clear accounting/calculation boundary.
- Existing tests cover profit-distribution exclusion, multiline memos, price eras, premium-cup handling, bottle revenue, financial integrity and rendering.
- `npm test` passed during this review: expense-rule checks, memo-parser checks, all four financial-integrity tests, and 13 finance-render branch/month views.
- These tests do **not** certify source transcription, completeness, document authenticity, approval enforcement or safe importer behavior. Passing tests alongside the parser probes above demonstrates the coverage gap.
- The existing `FINANCIAL_RELIABILITY_2026-09-08.md` records earlier source findings and subsequent approved corrections. Its pre-correction tables and older local skill percentages must not be reused as current measurements. This review does not reopen or independently verify those financial findings.

## Changes delivered in this review

1. A cross-document OCR operating policy with source provenance, unknown handling, independent visual review, reconciliation, duplicate/allocation handling, human approval, safe import and measurable acceptance criteria.
2. Links and explicit legacy-command warnings in `AGENTS.md`, `CLAUDE.md`, and the in-repository OCR skill.
3. A precedence note in the ledger-integrity skill, preserving historical notes while preventing older procedural assumptions from overriding the new OCR policy.

**Implementation remains open.** The scripts are unchanged. Priority is a fail-closed shared approval boundary and safe expense staging/import, followed by date/schema/parser corrections and regression fixtures. Only after isolated end-to-end tests pass should production imports resume under an approved batch plan. No defensible numerical OCR-accuracy percentage is established by this review.
