# Feedback Loop Metric — Fix netEffectiveness Collapse to Zero

See `IMPLEMENTATION_SPEC.md` for the full plan. This file mirrors it for PR-visibility purposes.

---

## TL;DR

**Symptom:** `feedbackLoop.netEffectiveness = 0.0000` for all 10 personas across all engagement tiers, even though high-tier personas cook 78+ times and trigger `give_feedback` at 80% probability per cook.

**Root cause:** Not event loss — the `FeedbackAction → DaySnapshot → FeedbackLoopTracker.record()` pipeline is intact. The correlation formula in `FeedbackLoopTracker.correlationRate()` (`KitchenSinkNew/simulation/quality/FeedbackLoopTracker.ts:102-125`) requires the *exact same `recipeId`* to reappear in the *next 2 weekly plans* (`LOOKAHEAD_PLANS = 2`). With a large Tasty corpus and a diversity-seeking planner (see the merged diversity-rolling-novelty work), exact recipe IDs essentially never repeat across adjacent plans, so `found / events.length = 0 / N = 0` in both numerators. Tests at `__tests__/quality/trackers.test.ts:559-673` use hand-picked 2-plan scenarios that mask this.

**Fix:**
1. Match on **recipe signature** (cuisine/protein/meal-type tag overlap, K ≥ 2) instead of exact id. Keep exact-id count as a diagnostic.
2. Extend lookahead from 2 plans to the full remaining run (configurable).
3. Emit diagnostic counters (`feedbackEventCount`, `exactRecipeHits`, `signatureHits`, `overlapDensity`).
4. Render `NaN` (no feedback events) as `"—"`, not `"0.0000"`.
5. Add regression tests covering realistic multi-week sparsity.

**Risk:** Tag allowlist may not match real Tasty tag values; verify against seed data during implementation. Extending lookahead to ∞ makes the "disliked recipe reappeared" signal weaker — signature path dominates, so exact-id semantic is now diagnostic only.

See `ASSUMPTIONS.md` and `QUESTIONS.md` for planning-phase caveats.
