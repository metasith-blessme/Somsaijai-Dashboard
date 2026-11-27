# Photo reader eval

`october_eval.js` reads the 1-17 October 2026 sheets in `B1/`, `B2/`, `B3/`, `B4/` with the real
reader (Gemini) and scores what Approve would book (branch, date, Total, cash, scan) against
Parn's closed figures in `data.json`. Nothing is written anywhere.

```
GEMINI_API_KEY=... node eval/october_eval.js --lib <line_bot/lib> --out result.json --concurrency 1 --pause 4000
node eval/october_eval.js --retry result.json --out result.json   # re-read only photos that errored
```

The Gemini key is on the free tier (15 requests a minute on flash-lite, plus a daily cap shared
with the live bot). Keep concurrency at 1 with a pause, and do not run it in the evening when staff send photos.

Photos and days do not match 1:1. B3 has no photo for 10 and 17 Oct and two photos for 12 Oct (12A, 12B).
B4 has one undated photo. Those three photos are skipped, so 65 photos are scored.

On B2 (1-6, 8, 10 Oct) and B4 (16 Oct) staff wrote cash and Total after ice, and Parn booked them
before ice. Score against "as written" for reader accuracy: data.json minus that ice.

## 27 Nov 2026, gemini-3.5-flash, 63 photos (B1 1 Oct and B3 1 Oct left out)

| Prompt | vs data.json | vs as written | Confident wrong (as written) | Sheets all right (as written) |
|---|---:|---:|---:|---:|
| line-bot-ocr-5 (live) | 91.4% | 97.1% | 4 | 54/63 |
| candidate: form guide + 2 approved examples | 90.5% | 96.2% | 8 | 52/63 |

The candidate was not shipped. It added three date misreads (B4 11 Oct read as 1 Oct, the
examples' date), so worked examples with a single date leak into new readings.
One run each, so a 1-point gap is within run-to-run noise.
