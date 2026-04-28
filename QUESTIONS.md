# Open Questions — Feedback Loop netEffectiveness Fix

Living doc. Planning-phase questions here; append as implementation sub-agents surface more.

## Planning-phase

1. **Branch strategy — confirm off `main`.**
   The diversity-rolling-novelty work has merged, so the adjacent tracker surface (`QualityMetrics` type, `SummaryReportGenerator` columns) is now stable.
   **Proposed:** Branch off `main` as `fix-feedback-net-effectiveness`.
   *Blocking?* No — resolve at top of implement phase.

2. **Is `planIndex` correctly assigned in `FeedbackLoopTracker.record()`?**
   Line 69 uses `Math.max(0, this.planSnapshots.length - 1)`. This is "the latest plan so far" — correct if plans are generated *before* feedback fires on the same day, off-by-one if feedback is logged *before* the new plan is recorded. The order of operations depends on `DaySimulator.simulateDay()` (unverified in planning).
   **Proposed:** Add test #5 in Step 8. If it fails, fix by snapshotting plan state at feedback-time rather than at finalize-time.
   *Blocking?* No — detected and fixed by the same PR's test suite.

3. **Signature allowlist — derive from Tasty data or hardcode?**
   Hardcoding (the spec's Step 1) is brittle; the alternative is to inspect actual tag values in `seed-data/` and derive the allowlist from frequency (top N tags).
   **Proposed:** Hardcode initial list; verify against `seed-data/` early in implementation. If coverage < 80% of recipes produce a non-empty signature, pivot to data-derived list.
   *Blocking?* No — probe early, adjust.

4. **Should `netEffectiveness` be signed or bounded?**
   Currently `positiveCorrelation - negativeCorrelation` ∈ [-1, 1]. After Fix A+B with extended lookahead, both correlations may be higher. Is the sign interpretation preserved?
   **Proposed:** Yes — positive still means "system honors likes more than it ignores dislikes." Add one sentence to the tracker's docstring. No semantic change.
   *Blocking?* No.

5. **Do `InsightsAction` or `CookRecipeAction` also emit feedback events?**
   Discovery confirmed `FeedbackAction` is the producer; worth a second pass to confirm nothing else emits `give_feedback`-typed ActionResults.
   **Proposed:** Grep for `type: 'give_feedback'` during implementation; if nothing else emits, move on. If there are other emitters, ensure the tracker handles them uniformly.
   *Blocking?* No.

6. **What about neutral feedback (`!isLiked && !isDisliked`)?**
   Currently filtered out of both correlation numerators. But neutral events *are* counted in `feedbackEventCount` (useful for denominator-check). Should neutral feedback contribute to the metric at all?
   **Proposed:** No — the metric is asymmetric by design. Neutral stays diagnostic-only. Document this.
   *Blocking?* No.

7. **Simulation smoke-run: what's the actual command?**
   Need to run 10-persona 90-day sim end-to-end to verify the fix. `KitchenSinkNew/simulation/package.json` likely has a script; unverified in planning.
   **Proposed:** Implement phase: `cd KitchenSinkNew/simulation && npm run simulate` (or check `package.json scripts`). If no single command exists, use `ts-node index.ts` directly.
   *Blocking?* No — implementer resolves.

## Implementation-phase

8. **Are Tasty seed tags actually populated in the emulator dataset?**
   The uploader (`scripts/tasty-scraper/firestore-uploader.js`) writes tags, but `simulation/seed-data/import-recipes.ts` passes recipe docs through from `allrecipes_firestore.json` unchanged; couldn't locate that file on disk to confirm it retains `tags`. If imported recipes lack `tags`, every signature is empty and the fix reverts to exact-id behavior (still broken).
   **Mitigation:** The new `overlapDensity` diagnostic surfaces this — if it's `0` across all personas, data is the culprit.

9. **Is `minSignatureOverlap = 2` too strict?**
   Typical Tasty recipe produces 3–4 identity tags (meal-type + cuisine + 0–2 dietary). K=2 requires two shared axes (cuisine + meal-type, or cuisine + dietary). If the first smoke-run shows low `signatureHits`, drop K to 1.
   *Blocking?* No — tunable post-merge.

10. **Single `Feedback` (netEffectiveness) label in the summary table is ambiguous.**
    Summary now has `Pos Corr`, `Neg Corr`, and `Feedback` as siblings. "Net Eff" would be clearer — label-only change, deferrable.

11. **Should there be a separate `feedback.csv` instead of repeating profile-level values per daily row?**
    Current approach: profile-level feedbackLoop values repeat 90× in `daily.csv`. Simple, joinable, space-inefficient. Refactor deferred.

12. **Snack vs snacks canonicalization** — scraper emits `snacks` (plural) but spec used singular. Allowlist accepts both. Data-side normalization not addressed.
