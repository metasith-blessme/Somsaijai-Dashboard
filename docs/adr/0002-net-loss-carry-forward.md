# 0002: Net Loss Carry-Forward

We decided to implement a **Net Loss Carry-Forward** policy for multi-branch profit-sharing calculations. If a branch incurs a net operational loss (negative Net Profit) in a given month, that loss is quarantined to that specific branch and carried forward to offset future profitable months of *that branch* only. This prevents a new or temporary underperforming branch's startup losses from immediately penalizing profit payouts from other healthy, established branches.
