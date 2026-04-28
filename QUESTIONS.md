# Open Questions — Diagnose Seasonal Ranking

Living doc. Questions surfaced during planning; append as implementation reveals more.

## Planning-phase

1. **Should Fix #2 (corpus enrichment) ship in the same PR or as a follow-up?**
   **Proposed:** follow-up. The cold-start fix (Fix #1) and tracker realignment (Fix #3) together turn the metric into a usable signal; corpus enrichment is the long-term win but materially larger (one-shot enrichment script + Firestore migration, or runtime tagger). Splitting keeps each PR reviewable.
   *Blocking?* No.

2. **Prior version 1 — keyword set vs. ML-derived?**
   **Proposed:** start with the hand-curated keyword set in §3.1. Gives an immediate, inspectable cold-start signal. Once the corpus is enriched (Fix #2), revisit whether to derive the prior from corpus statistics instead.
   *Blocking?* No.

3. **History/prior blend ratio (0.7/0.3) — empirically tuned or assumed?**
   Assumed. No data yet on how quickly history should override the prior. After ~10 cooks of consistent counter-evidence, history weight at 0.7 still leaves the prior moving the score by ~0.15, which feels right intuitively. Re-tune if a follow-up experiment suggests otherwise.
   *Blocking?* No.

4. **`meanRankBias` — compute now, or stub to `null`?**
   Computing it requires the tracker to see the *candidate pool* the ranker selected from, not just the chosen plan. That plumbing doesn't exist today. Stub `null` for this PR and add it as a follow-up if the simpler `meanFitScore` doesn't tell the story we need on the next sim run.
   *Blocking?* No.

5. **Does the predictive `predictTodaysMeals` path also need the fix?**
   Yes — it goes through the same `computeSeasonalFit`, so Fix #1 lands automatically. The existing `predictionService.test.ts` cases at `:481-512` (winter Saturday) and `:264-285` (summer dinner) need spot-checking that they still pass with the new prior.
   *Blocking?* No, but worth confirming during implement.

6. **Southern Hemisphere / equatorial users.**
   The hand-curated prior is implicitly Northern-Hemisphere temperate. We don't currently locale-detect. Out of scope for this PR but flag as a known limitation.
   *Blocking?* No. (Filed in `ASSUMPTIONS.md` as well.)

7. **What's the right baseline date for the simulation harness?**
   The original framing favoured 2026-06-15 (summer) partly because winter would "look weird in a summer market". This investigation shows the simulation can't currently distinguish seasons regardless of date — so that reason doesn't apply. **Proposal:** pick the date on logistical grounds (e.g. start-of-month, mid-week, no DST transition), and once Fix #1 ships, run *both* a summer and a winter baseline to validate the fix actually moved the needle. The choice between the two as the *primary* baseline is a separate decision.
   *Blocking?* No — this PR doesn't need to pick the date, only document why the existing reasoning was undermined.

8. **Should we re-run historical baselines with the new metric?**
   No. The metric is renamed; old reports are point-in-time snapshots and stand as-is. New reports use the new metric. Document the cutover in the PR body.
   *Blocking?* No.

9. **Follow-up: corpus enrichment design.**
   Two flavours: (a) one-shot script that scans titles/cuisines/ingredients and writes derived `seasonHint` tags into Firestore, (b) runtime enricher that runs at recipe-load. (a) is simpler but stale on corpus updates; (b) is correct but adds latency. Defer the choice to the follow-up PR.
   *Blocking?* No (out of scope here).

10. **Per-cuisine seasonal nuance (Mediterranean salad year-round, Nordic winter).**
    The flat prior treats `salad` as universally summer. Some cuisines invert this. Out of scope for the initial fix; revisit if reports show systematic bias against specific cuisines.
    *Blocking?* No.

## Implement-phase

11. **Should the prior weight ramp down as `tagsWithData` grows?**
    The current 0.7/0.3 blend can pull a strongly history-personalised score toward the prior even after many cooks (e.g. someone who genuinely prefers grilled food year-round will be tugged toward "summer" in winter months). An obvious tweak: `priorWeight = max(0, 0.3 - 0.05 * (tagsWithData - 2))`, decaying to zero by `tagsWithData = 8`. **Proposed:** ship the flat 0.7/0.3 in this PR; add a follow-up only if simulation reports show personalised-preference erosion.
    *Blocking?* No.

12. **Rank Bias column visibility heuristic — hide-when-all-null vs always-render-with-em-dashes?**
    `SummaryReportGenerator` per-profile cards currently hide the column entirely when every value is null (i.e. always, in this PR). Always-rendering with em-dashes preserves column stability across simulation runs at the cost of visual noise. **Proposed:** keep hide-when-all-null; revisit once `meanRankBias` actually computes (follow-up).
    *Blocking?* No.

13. **Should `predictionService.test.ts` be re-baselined for the new prior?**
    The existing winter-Saturday and summer-dinner cases at `:481-512` and `:264-285` route through `computeSeasonalFit` and may now produce different scores. Verify pass/fail in the `Verify build, tests, lint` step; only re-baseline if the test asserts an exact pre-prior number.
    *Blocking?* No (resolved by running the affected tests).
