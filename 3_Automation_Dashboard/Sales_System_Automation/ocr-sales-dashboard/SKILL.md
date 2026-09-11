---
name: ocr-sales-dashboard
description: "Use when reading SomSaiJai reports or expense slips."
---

## Mandatory policy and current safety hold

Read [`docs/OCR_RULES.md`](../../../docs/OCR_RULES.md) from the repository root before any OCR or financial import. It is the authoritative operating procedure for all document types, including expenses, POS-only reports and stock. Follow the ordered [OCR-to-Dashboard workflow](../../../docs/OCR_TO_DASHBOARD_WORKFLOW.md) from batch intake through review, safe import, generation, deployment and live readback. Read the [implementation-gap review](../../audit/OCR_PIPELINE_REVIEW.md) before choosing a script. Section 10 of `OCR_RULES.md` is mandatory for every sale-report or transfer-slip read. Preserve complete evidence in a review artifact; chat may summarize with a link. Extractor output always has `review.import_allowed: false`; human approval is recorded separately.

Use the owner-approved [SomSaiJai Sales Extractor procedure](../../../docs/SOMSAIJAI_SALES_EXTRACTOR.md) for page-by-page reading and review JSON. This merges the submitted Gemini structure with the accuracy policy; it is not an implemented importer or automatic schema validator.

## When to use

- Handwritten sales, closing cash, ingredient or packaging stock reports for B1/B2/B3.
- Transfer slips, supplier receipts/invoices and their multiline descriptive notes.
- Structured extraction for human review, including handwritten menu additions, Durain and Sticky Rice.
- Not authorization to change financial records or deploy the dashboard.

The legacy `verify-sales`, `process-expenses`, `sync` and `pipeline` commands must not run against production records until their approval/data-loss gaps are fixed and tested. `process-sales` mutates shared staging, sets automatic verification and can discard conflicts; it is not a safe preview.

## Execution

1. Record the batch scope, then follow [OCR_RULES.md Section 10](../../../docs/OCR_RULES.md#10-mandatory-procedure-for-every-sale-report-or-transfer-slip-read) and the [Sales Extractor contract](../../../docs/SOMSAIJAI_SALES_EXTRACTOR.md). Save its complete review artifact; read-only inventory/extraction needs no separate approval.
2. Stop before any financial write. Follow the [OCR-to-Dashboard workflow](../../../docs/OCR_TO_DASHBOARD_WORKFLOW.md) for human review, source-bound approval, safe import, regeneration, separate deployment approval and live readback.
3. Keep `review.import_allowed: false` in extractor output. Human approval is a separate lifecycle record; it does not authorize a legacy command under the safety hold.

The branch workbooks are the accounting sources. Generated JSON/HTML are build artifacts, not source evidence. The current review contract requires a tested lossless adapter before it can enter the legacy flat schema.

## Resource Map
- **Scripts**:
  - `process_sales.js`: Legacy OCR extraction with unsafe automatic verification; see the gap review.
  - `verify_sales.js`: Excel merging and stats calculation.
  - `update_dashboard.js`: Excel to JSON sync and Vercel deployment.
- **Reference**:
  - `references/excel_schema.md`: Layout of the master Excel workbook.
- **Troubleshooting**:
  - Ambiguous readings: reinspect the source/crop and seek human confirmation. Do not tune a confidence threshold to force acceptance; the current script does not implement the fuzzy-match threshold previously described here.
  - Hosting issues: if the Vercel site shows errors, check your vercel configuration and run `npx vercel logs`.
