# OCR Common Issues
**Date:** 2026-05-04
**Tags:** #ocr #bug-fix #data-entry

## Context
OCR (Visual Recognition) frequently misinterprets handwritten dates and numbers on the LINE sales reports.

## Details
### 1. Date Errors
- **Future Dates:** OCR often sees `26` (year) as `86`. Always verify year is `2026`.
- **Impossible Days:** Check for days like `35/04`. This usually happens when a handwritten `13` or `15` is misread.
- **Image Source:** Check the filename (e.g., `...260430...`) to confirm the intended date.

### 2. Revenue Mismatches
- **Formula:** `Rev = Cash + Scan`.
- If `Rev` in the JSON doesn't match the sum of payments, visually check the "All => [Number]" on the handwritten slip.
- OCR often misses the "Scan" amount if it's written at the bottom.

## Related
- [[2026-05-04_April_Cleanup]]
