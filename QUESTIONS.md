# Open Questions — Diversity Metric Rolling-Window Novelty

Living doc. Questions flagged during planning; append as implementation sub-agents surface more.

## Planning-phase

1. **Lookback value — 7 fixed or configurable default?**
   **Proposed:** default `7`, constructor-injectable. Report label reads the actual value (`Novelty (7d, mean)`).
   *Blocking?* No. Proceed with default.

2. **Fallback when run shorter than lookback?**
   **Proposed:** `perDay = []`, `mean = NaN`, report renders `"—"`. Alternative would be `mean = 0` or omit the row.
   *Blocking?* No. NaN + "—" is the cleanest.

3. **Should the old `perWindow` field stay during a transition?**
   **Proposed:** no — replace cleanly. Branch is pre-merge; no historical reports exist.
   *Blocking?* No.

4. **Report label rename — keep "Diversity" or switch to "Novelty"?**
   **Proposed:** rename to `Novelty (7d, mean)`. The word "diversity" at this point is overloaded.
   *Blocking?* No. If the user prefers the old label, trivial to revert.

5. **Is `DiversityTracker.record()` day-indexed?**
   The planning exploration said records are appended in order and QualityTracker keeps all DaySnapshots. Whether the tracker gets an explicit day number or infers it from array index will need to be confirmed by the implement sub-agent. If there's a gap (missed days), we use the *stored day number* rather than array position.
   *Blocking?* No — implement-phase sub-agent should verify.

6. **Do any other trackers or services consume `QualityMetrics.diversity.perWindow`?**
   Not enumerated exhaustively during planning. Implement-phase must grep.
   *Blocking?* No — caught at compile time.

7. **Should per-day novelty values be exposed alongside mean/std?**
   The `perDay` array is part of the emitted shape. Not currently rendered but available for downstream reports / dashboards later. If the user wants the simulation run to write a CSV of per-day novelty, that's a follow-up.

8. **Edge case: plan(D-N) exists but is empty.**
   Proposed to skip that day (count as skipped). Alternative: treat today's plan as fully novel (since nothing to compare against).
   *Blocking?* No. Skipping keeps the metric semantics tight.

9. **Edge case: plan(D) and plan(D-N) have different sizes.**
   Formula is `|A ∩ B| / |A|` — denominator is today's size only. If today has 5 recipes and week-ago had 7, still divides by 5. Correct.
