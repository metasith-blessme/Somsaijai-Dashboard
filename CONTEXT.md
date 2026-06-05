# SomSaiJai Multi-Branch Sales & Stock Automation

This domain context automates and visualizes multi-branch sales records, centralized inventory tracking, and net profit-sharing calculations for SomSaiJai cold-press juice bars.

## Language

**Shared COGS**:
Global operational costs (fruit, ice, packaging) that are accumulated centrally and allocated proportionally to each branch based on its revenue share.
_Avoid_: Central expense, base cost

**Wastage**:
Physical loss, spoil, or arithmetic discrepancy in raw material inventory, detected during physical stock checks.
_Avoid_: Loss, shrinkage, damage

**Wastage Allocation**:
The process of distributing raw material **Wastage** proportionally based on each branch's actual raw material usage (calculated via cup inventory yield).
_Avoid_: Wastage split, gross allocation

**Stock Ledger**:
The central repository tracking physical purchases, physical checks, and the remaining global stock of ingredients.
_Avoid_: Inventory log, central pool

**Theoretical Yield Ratio**:
The historical average coefficient of cups sold per unit of a specific raw material, used as a conversion standard.
_Avoid_: Ideal conversion, average yield

**Derived Usage**:
Estimated raw material consumption figures automatically calculated using the **Theoretical Yield Ratio** when daily reports have missing or invalid raw material entries.
_Avoid_: Estimated usage, guess count

**Inventory Deficit**:
A negative balance in the **Stock Ledger** occurring when cumulative recorded raw material usage exceeds registered stock purchases.
_Avoid_: Negative stock, overdraft

**Stock-In**:
The operational event where new raw material purchases are logged and added to the **Stock Ledger**.
_Avoid_: Stock add, raw purchase

**Fruit COGS**:
The accumulated global cost of purchasing raw fruit, allocated to branches based on their actual raw material usage.
_Avoid_: Fruit cost, direct fruit charge

**Revenue-Proportional COGS**:
Common, shared operational overhead (like Ice and Packaging) that is accumulated globally and allocated to branches based strictly on branch revenue share.
_Avoid_: Split COGS, general overhead

**Net Profit**:
A branch's gross revenue minus direct expenses, allocated **Fruit COGS**, allocated **Revenue-Proportional COGS**, and fixed operational costs.
_Avoid_: Gross net, final revenue

**Net Loss Carry-Forward**:
The financial policy where a branch's net operational losses are quarantined to that branch and carried forward to offset future profitable months of that branch.
_Avoid_: Loss share, aggregated loss offset

## Example Dialogue

**Dev**: "If B2 has higher sales of Watermelon, but we do a physical stock count and find 5 missing watermelons, who pays for that **Wastage**?"
**Domain Expert**: "According to **Wastage Allocation**, we check each branch's actual watermelon usage derived from cup inventory yields. If B2 used 80% of the watermelons this month, they are allocated 80% of the **Wastage** (4 watermelons) in their **Shared COGS** calculation."

**Dev**: "What if B1 staff forgot to write down how many baskets of oranges they used on May 16, but they sold 65 cups?"
**Domain Expert**: "We calculate a **Derived Usage** using the **Theoretical Yield Ratio** for oranges. If the ratio is 30 cups per basket, we'll auto-fill that day's orange usage as 2.17 baskets and flag it with a warning in the dashboard log."

**Dev**: "The ledger shows an **Inventory Deficit** of -5 baskets of oranges today. Should we throw an error?"
**Domain Expert**: "No, don't block the sync. Let the balance go negative in the **Stock Ledger**, but highlight it in red on the dashboard so we know we forgot to log the **Stock-In** event when the oranges arrived."

**Dev**: "If B2 makes a negative **Net Profit** of -10,000 THB in May, does that reduce Blessme's B1 payout for that month?"
**Domain Expert**: "No, under our **Net Loss Carry-Forward** policy, B2's loss is quarantined. It will carry forward to June to offset B2's future profits. B1's profit payout is untouched."
