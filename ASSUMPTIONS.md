# Assumptions — Feedback Loop netEffectiveness Fix

Living doc. Planning-phase assumptions listed here; append as implementation sub-agents surface new ones.

## Planning-phase

1. **Root cause is sparse recipe-id overlap (H2), not event loss (H1).** Discovery confirmed the full pipeline (`FeedbackAction.execute` → `ActionResult` → `DaySnapshot.actionsExecuted` → `FeedbackLoopTracker.record`) is wired and functional (see `FeedbackLoopTracker.ts:58-71`, `DaySimulator.ts:142`). If a diagnostic smoke-run shows `feedbackEventCount = 0` for high-tier personas, this assumption is wrong and the fix approach must pivot to investigating event wiring (unlikely but non-zero risk).

2. **Tasty recipes carry usable cuisine/protein/meal-type tags.** The planning assumption is that `UnifiedRecipe.tags` contains cuisine and protein identifiers across the Tasty corpus (supported by widespread use of `recipe.tags` in `MealPlanAction.ts`, `FeedbackAction.ts`). If seed data tags are sparse or free-form, the signature approach needs an early fallback (e.g., ingredient-based signatures from `recipe.ingredients`).

3. **Signature overlap threshold K = 2 is tunable later.** Start with K = 2 (cuisine + protein, or protein + meal-type). If this over-matches, raise to 3. If under-matches, drop to 1. The `signatureHits / feedbackEventCount` column surfaces this for tuning.

4. **Lookahead = ∞ is safer than = 2.** Default to examining every subsequent plan. The sparsity problem is worse than the "disliked recipe eventually reappears" problem, and diagnostic `exactRecipeHits` lets a reviewer see the distinction.

5. **Existing trackers tests use hand-picked 2-plan scenarios.** Preserving those tests requires either (a) constructing the tracker with `lookaheadPlans: 2, minSignatureOverlap: 999` to force exact-id fallback, or (b) rewriting tests to target the signature path explicitly. Chose (a) for minimal churn during planning; implementer can refactor if intrusive.

6. **`NaN` rendered as `"—"` is the right UX for "no data."** Matches the convention used by the (now-merged) diversity-rolling-novelty tracker for consistency.

7. **Branch strategy deferred.** Plan mode doesn't create the branch. Proposal: branch off `main` as `fix-feedback-net-effectiveness`. See `QUESTIONS.md` §1.

8. **`planIndex` off-by-one is unverified.** Discovery sub-agent flagged the `Math.max(0, this.planSnapshots.length - 1)` at `FeedbackLoopTracker.ts:69` as potentially mis-tracking which plan was active when feedback fires. Step 8 test #5 pins this down — if it fails, there's a second, smaller bug to fix in the same PR.

## Implementation-phase

9. **Expanded identity-tag allowlist.** Added `snacks` (plural, used by Tasty scraper at `scripts/tasty-scraper/firestore-uploader.js:87,94`) and `asian` (used at line 122). Kept protein tokens (`chicken`, `beef`, …) even though the scraper doesn't currently emit them — harmless on absent-tag recipes, forward-compatible.

10. **Excluded `tasty` provenance tag.** The scraper adds `tags.push('tasty')` to every recipe; treated as a source marker, not an identity signal, so not in the allowlist.

11. **`daily.csv` is the only CSV channel.** Profile-level feedbackLoop metrics are repeated on every daily row (space-inefficient but self-contained). Alternative `feedback.csv` deferred — would require test-harness changes.

12. **CSV NaN → empty string; summary NaN → `"—"`.** Standard conventions for each format.

13. **`formatNumber` → `formatMetric` rename.** Pre-existing `formatNumber` helper in `SummaryReportGenerator` had identical semantics; renamed rather than duplicated.

14. **Legacy tracker tests use `FeedbackLoopTracker(2, 999)`.** `minSignatureOverlap: 999` forces exact-id-only path, keeping old assertions valid with new formula. New behavior covered by a dedicated `describe('signature-matching (new behavior)')` block.

15. **Test #5 (planIndex) designed around a no-new-plan day.** That's the scenario that would expose off-by-one; implementation passed with current `Math.max(0, length - 1)`.
