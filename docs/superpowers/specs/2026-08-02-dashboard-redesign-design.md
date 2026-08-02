# Dashboard Redesign — Design Spec

**Date:** 2026-08-02
**Status:** Approved, ready for implementation planning
**Scope:** `3_Automation_Dashboard/index.html` and its presentation layer

## Context

The live dashboard rendered nothing. `index.html` had grown to 1,749 lines in a
single file, and 52 lines of escaped backticks (`` return \` `` inside expression
context) across three render blocks made the entire inline script a syntax error.
One bad edit took down every section at once. That was fixed and deployed in
commit `6005ded`; this spec covers the redesign that follows.

The owner named four independent failures: it looks dated, information is hard to
find, it does not work on a phone, and it reports what happened without saying
what to do. These are design problems, not framework problems.

## Audience and jobs

Two readers, two jobs.

**The owner, daily, on a phone.** Needs, in order: how did yesterday go against
normal, is anything wrong right now, and what needs ordering.

**The owner and Ming, monthly, on a laptop, walking through it together.** Needs
the profit-share settlement to be self-evident — especially when a branch earns
money but pays out nothing because of a carried-forward loss. No PDF export and
no separate partner login are in scope.

## Architecture

Vanilla ES modules, no build step. `index.html` becomes a shell; logic splits
into focused modules served as static files.

```
index.html                shell + nav, ~120 lines
css/app.css               mobile-first, authored at 390px
js/data.js                load + validate data.json and reports_data.json
js/format.js              currency, percent, dates, deltas
js/alerts.js              alert rules as pure functions
js/views/daily.js
js/views/monthly.js
js/views/stock.js
js/views/log.js
js/charts.js              Chart.js wrappers
```

No module exceeds ~250 lines. Chart.js is kept. Deployment stays `npx vercel
--prod` over static files.

A bundler was considered and rejected. The pipeline is node scripts emitting JSON
plus static files; adding a build step inserts a new failure mode into a system
that has already demonstrated it can fail silently and completely. The root cause
was file size and blast radius, not the absence of a framework.

**Calculations do not move.** `Sales_System_Automation/logic/business_rules.js`
remains the single source of truth for allocation, profit share, and loss
carry-forward. This is a presentation-layer rewrite only. The existing tests
(`test_expense_rules.js`, `test_render_finance.js`) continue to guard the
numbers; `test_render_finance.js` is updated to target the new view modules.

Views are selected by URL hash (`#daily`, `#monthly`, `#stock`, `#log`) so a view
can be bookmarked. `#daily` is the default.

## Data flow

```
data.json          raw daily sales per branch/month + raw expense rows
reports_data.json  allocated per-branch P&L, profit share, carry-forward
        |
        v
   js/data.js   validates shape, exposes typed accessors
        |
        v
   view modules  render into their own container
```

`data.json` is the source for daily sales, cup counts, raw usage, and audit
flags. `reports_data.json` is the source for anything involving allocated COGS or
profit share — views never re-derive those.

## View 1 — Daily

The landing view. Layout selected from three mockups: group number first.

- **Hero card.** Group revenue for the most recent day, delta against that day's
  own trailing 30-day average, and a 7-day sparkline.
- **Branch rows.** B1, B2, B3 — revenue and delta each.
- **Needs attention.** Computed alerts only (rules below). When nothing fires,
  renders a single "All clear" line, never an empty container.
- **Date stepper.** Walk back through previous days.

"Most recent day" means the latest date present in `data.json`, not yesterday's
calendar date. These diverge routinely: on 2026-08-02 the newest record was
2026-07-31. The view labels the actual date and, when it is more than one day
behind the current date, says how stale the data is. It never presents an old
day as if it were yesterday.

## View 2 — Monthly

The settlement view, structured so the payout is the headline and the
justification is directly beneath it.

- **Settlement card.** Blessme and Ming payout totals for the month.
- **Branch settlement rows.** One per branch: net profit, loss carry-forward
  applied, resulting payout split. The carry-forward is stated inline on the row.
  This is the view's most important requirement — in July 2026 B2 earned ฿9,616
  and paid out ฿0 because its ฿27,301 carried loss absorbed the whole amount.
  That must read as an explained rule, not an error.
- **What moved.** Three to five facts computed from the data: largest revenue
  mover month-over-month, margin change, any branch below break-even. Generated
  from data, never hand-authored prose — written narrative goes stale the moment
  the numbers change.
- **Full P&L statement.** Branches as columns: revenue, allocated COGS, gross
  profit, rent, other OPEX, net profit, loss carried forward, distributable,
  Blessme share, Ming share.
- **OPEX breakdown** and the existing charts (revenue, payment mix, product mix,
  day-of-week).

## View 3 — Stock

Burn rate only. No days-of-stock-remaining and no reorder alerts: `stock_ledger.json`
contains one purchase (100 oranges, 2026-04-12) and physical counts that stop in
April 2026. Any "days left" figure would be fabricated.

The owner supplied the real 28-item purchase list. Only 8 items have daily usage
recorded and therefore support a real burn rate:

| Item | Column |
|---|---|
| Orange (basket) | `uo` |
| Watermelon (whole) | `uw` |
| Mango (Kg) | `umg` |
| Apple (whole) | `uap` |
| Guava (Kg) | `uguava` |
| Pineapple (whole) | `upine` |
| Coconut meat | `uco_meat` |
| Coconut water | `uco_water`, `uco_raw` |

Two further usage columns exist and are handled explicitly. `uco_conden`
(condensed milk) carries real non-zero usage and is shown as a ninth measured
line, mapped to the `Milk/Conden` expense category; it does not appear on the
owner's purchase list under that name. `uyco` (young coconut) is present in the
schema but zero across all branches, so it is omitted from the view rather than
rendered as a permanently empty row.

The view has two tiers:

- **Measured.** The 8 items above: units/day per branch, 7-day versus 30-day
  trend.
- **Spend only.** Remaining expense categories as ฿/month, explicitly labelled
  *spend only — no usage tracked*. The UI names what it cannot measure rather
  than implying full coverage.

Mangosteen, Mangosteen&Lychee, and Rambutan appear on the purchase list but exist
nowhere in the schema — no usage column, no cup count, no price in
`audit_params.json`. The stock view notes them as untracked. Adding them as real
products is out of scope here; it requires Excel and OCR pipeline changes.

The 16 packaging and consumable items collapse into the single `Packaging`
expense category (฿114,781 to date) with no per-item detail.

## View 4 — Log

The daily operations log table, carried over from the current dashboard.

## Alert rules

Pure functions in `js/alerts.js`, independently unit-testable. Each returns a
severity and a message, or nothing.

| Rule | Fires when |
|---|---|
| Revenue anomaly | A branch's latest day falls outside ±20% of its trailing 30-day average |
| Audit variance | Any day carries `audit.is_flagged` |
| Below break-even | A branch's month-to-date net is tracking below its fixed cost base, taken from the existing `PARAMS.fixed` values (B1 ฿74,000, B2 ฿59,000, B3 ฿69,500 per month) |
| Usage spike | A measured item's 7-day burn rate deviates more than 30% from its 30-day rate |

Thresholds live in one constants block, not inline.

`PARAMS.fixed` is currently hardcoded as a flat monthly figure per branch. B2's
rent is on a discounted ฿25,000 rate for July–September and reverts to ฿30,000 in
October 2026, which will silently make its break-even alert ฿5,000 optimistic
from that month. The rebuild keeps the existing flat structure — making fixed
costs time-varying is out of scope — but the constant carries a comment naming
the October change so it is corrected deliberately rather than discovered later.

## Error handling

The blank-page failure must become structurally impossible.

- Each view renders inside its own try/catch. A failing view shows an error card
  naming the view; the other views and the nav keep working.
- `js/data.js` validates the shape of both JSON files on load and reports what is
  missing or malformed, rather than throwing on first property access.
- A missing or unparseable `reports_data.json` degrades to a message telling the
  owner to run `npm run update-dashboard`. It does not blank the page.
- `npm test` gains a smoke check that renders every view against real data and
  fails on any thrown exception.

## Mobile

Authored mobile-first at 390px and widened, rather than the current desktop
layout compressed. The daily view is the phone-critical path and is designed for
that width first.

## Out of scope

- The 7-section Management Report is removed. Sections 1–4 are duplicated by the
  new monthly view; sections 5–7 (daily COGS dump, fruit ROI, shareholder
  insights) are document output rather than dashboard content.
- PDF export. The monthly review is walked through on screen together.
- Any change to allocation, profit share, or carry-forward logic.
- Adding Mangosteen, Mangosteen&Lychee, or Rambutan as tracked products.
- Per-item packaging tracking.
- Restarting physical stock counts.

## Open questions

None block implementation — all three concern spend-only items that the stock
view aggregates by expense category rather than by individual item.

1. `Cup(95)` appears twice in the supplied item list. Given `Lid (98)` and
   `Cup(98)` appear elsewhere in the same list, the second is likely `Cup(98)`.
2. `Goodwill`, `Falcon`, and `Barley` are unidentified — ingredient, brand, or
   supplier is unknown. `Falcon` appears in exactly one expense row.
3. `Coconut water (400ml) for other Cup(98)` may be one item or two.

## Known data gaps

Recorded here because they affect how much the dashboard can be trusted, not
because this spec resolves them.

- **January–March 2026 OPEX is roughly ฿175,000 short.** B1 fixed costs are
  ~฿74,000/month; the books show ฿31,324, ฿16,000, and ฿0. Q1 profit is
  overstated. This is missing source data, not a code defect.
- **No inventory accounting.** Purchases are booked when paid rather than when
  used, so monthly COGS swings between 35% and 65% of revenue. Month-end counts
  on the measured items would resolve this.
- **B1 records zero guava and zero pineapple usage in July** while B2 and B3 both
  record it. Either B1 does not sell them or B1 is not recording them.
- **`SomSaiJai_Dashboard.html`** is a divergent standalone copy with its own older
  render code. `sync_dashboard_html.js` refreshes only its embedded data, not its
  logic, so it does not receive fixes made to `index.html`.
