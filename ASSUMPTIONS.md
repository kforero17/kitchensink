# Assumptions — Diversity Metric Rolling-Window Novelty

Living doc. Planning-phase assumptions start here; append as implementation sub-agents report new ones.

## Planning-phase

1. **Default lookback = 7 days.** Matches the user's explicit example ("day-30 vs day-23") and the 7-slot plan cadence. Exposed as a constructor arg so tests can vary it.

2. **Novelty semantic = "fraction of today's plan absent from D − N".** This is the complement of overlap, and matches the user's phrasing ("fraction of day-30 recipes [that also appeared / that did not appear] in day-23's plan"). Higher = more novel = better planner variety, preserving the old "higher = better" reading.

3. **Recipe identity = `UnifiedRecipe.id`.** Stable, source-scoped (`tasty-abc`, `spn-123`). The existing `plan.recipeIds` field already uses this; nothing to change at the data layer.

4. **Tracker already retains per-day plans.** `DiversityTracker.record()` appends day plans in order, and `QualityTracker` retains every `DaySnapshot`. No new data-capture plumbing needed — `finalize()` can index by day number.

5. **Day numbering is monotonic from 0.** Tests and runner both feed sequential day numbers. Safe to use day index directly as the key into the history array.

6. **Single lookback, not multi-N.** Emitting a matrix (7d, 30d, 90d) is appealing but out of scope. One number per persona is what the report consumes.

7. **Replace, don't dual-write.** The old `perWindow` field has no downstream consumer beyond the report. Replacing it (rather than keeping both) keeps the diff honest.

8. **Report std/min/max renderer is reusable.** The `appendQualityTrends()` function reads `m.diversity.mean` directly. Keeping `mean` on the output means only the *label* and *NaN handling* change — not the aggregation.

9. **NaN rendering → "—".** When a persona's run is shorter than the lookback, the report cell should read `—` not `NaN`. Consistent with typical Markdown-table conventions for missing data.

10. **Semantics of std on the report row.** `SummaryReportGenerator` computes std **across personas** from each persona's `mean`. That stays correct with novelty (each persona still emits a scalar `mean`). We do NOT roll the per-day std into the report — that would be a separate histogram.

11. **No existing diversity consumer outside the report.** The planning search didn't exhaustively enumerate references to `.diversity.perWindow` or `.diversity.mean`. The implement-phase sub-agent must grep and fix any we missed. TypeScript will catch structural breaks at compile.
