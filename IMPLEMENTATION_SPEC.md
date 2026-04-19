# Feedback Loop Metric — Fix netEffectiveness Collapse to Zero

**Working branch:** TBD — propose `fix-feedback-net-effectiveness` off `main`. See QUESTIONS.md §1.

---

## 1. Problem Statement

The simulation report shows `feedbackLoop.netEffectiveness = 0.0000` for **all 10 personas across every engagement tier**, even though high-tier personas cook 78+ times and emit `give_feedback` at 80% probability per cook. A dead-zero reading across this much activity is a metric bug, not an app bug.

Discovery ruled out event loss (**H1**): the pipeline from `FeedbackAction.execute()` → `ActionResult` → `DaySnapshot.actionsExecuted` → `FeedbackLoopTracker.record()` is wired correctly (`KitchenSinkNew/simulation/quality/FeedbackLoopTracker.ts:58-71`, `KitchenSinkNew/simulation/engine/DaySimulator.ts:142`).

The bug is **recipe-id sparsity** (**H2**). `correlationRate()` (`FeedbackLoopTracker.ts:102-125`) asks:

> "Does feedback event's exact `recipeId` appear in *any of the next 2 plans* (`LOOKAHEAD_PLANS = 2`)?"

This dovetails with the diversity work: with a large Tasty corpus and a diversity/novelty-seeking planner, the same `recipeId` almost never reappears in the next 2 weekly plans. So `found = 0` in both numerators, both correlations = 0, netEffectiveness = 0 - 0 = **0.0000**. The formula doesn't collapse — it's simply measuring something that has no signal in this regime.

Supporting evidence: existing tests at `__tests__/quality/trackers.test.ts:559-673` only exercise 2-plan scenarios with hand-picked recipe IDs guaranteed to reappear. No test reproduces realistic multi-week runs with a diverse corpus.

### Desired signal

"Does the planner respond to a user's feedback?" — i.e., after a persona likes a Thai-noodle dish, do *similar* recipes appear more often in future plans? After they dislike a dense-cheesy bake, do *similar* recipes appear less?

That's the question we want, and it must produce non-zero numbers on the simulation fixtures that today give 0.0000.

---

## 2. Approach

Three layered fixes. Each is independently valuable; together they give the metric meaningful signal and make future debugging trivial.

### Fix A — Replace exact-id matching with recipe-signature matching

Replace `planSnapshots[i].recipeIds.has(event.recipeId)` with a match on a **recipe signature** (cuisine + primary-protein tags + meal-type). The existing `currentMealPlan: UnifiedRecipe[]` carries `tags: string[]` already (see `FeedbackAction.ts:95`, `MealPlanAction.ts:56`), so no plumbing change — just read more fields in `record()`.

Signature: the sorted, deduped subset of `recipe.tags` that are in a curated "identity tags" allowlist (cuisine tags like `italian`/`thai`, protein tags like `chicken`/`tofu`, meal-type tags like `breakfast`/`dinner`). A feedback event matches a future plan if **any recipe in that plan shares ≥ K signature tags** with the feedback recipe (default K = 2; configurable).

Why this works: with a large corpus and 7 recipes/plan, the probability that *some* recipe in the next plan shares a cuisine+protein with a given liked recipe is meaningfully > 0. That is exactly the signal we want: "did the planner lean toward the preferred cuisine/protein?"

Fallback: keep the exact-id match as a secondary counter (reported but not the primary number) so we retain visibility into the old reading.

### Fix B — Extend lookahead

Change `LOOKAHEAD_PLANS = 2` to `LOOKAHEAD_PLANS = Infinity` (or concretely, `this.planSnapshots.length`) — look at *all* plans after the feedback event, not just the next two.

Justification: the feedback loop is a standing signal (once stored, it should shape every subsequent plan). A 2-plan window is an arbitrary restriction that compounds the sparsity. Inspect every downstream plan; count the event as a hit if *any* later plan contains a signature-matching recipe.

Make it a constructor arg (default ∞, tests override to 2 to preserve current unit-test expectations).

### Fix C — Diagnostic counters + degenerate-case rendering

Emit alongside the existing three fields:

```
feedbackLoop: {
  positiveCorrelation,       // current
  negativeCorrelation,       // current
  netEffectiveness,          // current
  feedbackEventCount,        // NEW: total liked + disliked + neutral events recorded
  exactRecipeHits,           // NEW: how many feedback events had exact-id overlap
  signatureHits,             // NEW: how many had signature overlap
  overlapDensity,            // NEW: (liked+disliked hit rate) — single number to eyeball sparsity
}
```

When both `liked.length === 0` AND `disliked.length === 0` (no data at all), return `netEffectiveness: NaN` and render it as `"—"` in SummaryReportGenerator, distinguishing "no data" from "genuine zero."

Wire new fields into `QualityMetrics['feedbackLoop']` type, `SummaryReportGenerator` table, and `RawDataExporter` CSV.

### Out of scope (this change)

- Measuring KL divergence of candidate distributions pre/post-feedback (heavier; separate follow-up).
- Baseline-adjusted correlation (P(liked reappears) − P(random recipe reappears)). Worth doing, but only if Fix A+B doesn't resolve the 0.0000 problem.
- Re-examining `FeedbackAction` probability tuning. The event pipeline is fine; don't touch it.
- The diversity-rolling-novelty work on a different tracker.

---

## 3. Files to Modify

| File | Change |
|------|--------|
| `KitchenSinkNew/simulation/quality/FeedbackLoopTracker.ts` | Core: signature extraction, extended lookahead, new counters, NaN for empty |
| `KitchenSinkNew/simulation/profiles/types.ts` | Extend `QualityMetrics['feedbackLoop']` with new fields |
| `KitchenSinkNew/simulation/reports/SummaryReportGenerator.ts` | Render new columns; render NaN as `"—"` |
| `KitchenSinkNew/simulation/reports/RawDataExporter.ts` | Include new fields in CSV |
| `KitchenSinkNew/simulation/__tests__/quality/trackers.test.ts` | Preserve existing tests (override lookahead=2, K=∞ for exact-id semantics); add new tests |
| `KitchenSinkNew/simulation/__tests__/reports/SummaryReportGenerator.test.ts` | Update fixtures for new columns |
| `KitchenSinkNew/simulation/__tests__/reports/RawDataExporter.test.ts` | Update fixtures for new columns |

## 4. New Files

None. All changes fit in the existing tracker + report shape.

## 5. Implementation Plan

### Step 1 — Identity-tag allowlist

In `FeedbackLoopTracker.ts`, add a const:

```ts
const IDENTITY_TAG_PREFIXES = new Set([
  // Cuisine
  'cuisine:', 'italian', 'thai', 'mexican', 'indian', 'japanese', 'chinese',
  'mediterranean', 'french', 'american', 'korean', 'vietnamese',
  // Primary protein
  'chicken', 'beef', 'pork', 'fish', 'salmon', 'tofu', 'vegetarian', 'vegan',
  'seafood', 'shrimp',
  // Meal type
  'breakfast', 'lunch', 'dinner', 'dessert', 'snack',
]);
```

Extract helper:

```ts
function recipeSignature(tags: string[]): Set<string> {
  return new Set(
    tags
      .map(t => t.toLowerCase().trim())
      .filter(t => IDENTITY_TAG_PREFIXES.has(t) || [...IDENTITY_TAG_PREFIXES].some(p => p.endsWith(':') && t.startsWith(p))),
  );
}
```

Implement grepping-by-allowlist-or-prefix. Unit-test on a few Tasty recipes to confirm non-empty signatures.

### Step 2 — Change `PlanSnapshot` shape

```ts
interface PlanSnapshot {
  recipeIds: Set<string>;                   // keep for exactRecipeHits
  recipeSignatures: Array<Set<string>>;     // one signature per recipe in plan
}
```

In `record()`, build both.

### Step 3 — Update `FeedbackEvent`

```ts
interface FeedbackEvent {
  recipeId: string;
  signature: Set<string>;          // NEW
  isLiked: boolean;
  isDisliked: boolean;
  planIndex: number;
}
```

In `record()`, resolve the recipe's tags from `snapshot.stateAfter.currentMealPlan` (find by id) and compute signature. If the recipe isn't found in the current plan (edge case), fall back to empty signature — the event still counts toward `feedbackEventCount` but can only hit via exact-id match.

### Step 4 — New constructor args

```ts
constructor(
  private lookaheadPlans: number = Infinity,
  private minSignatureOverlap: number = 2,
) {}
```

Wire the defaults into `QualityTracker` construction and let tests override.

### Step 5 — Rewrite `correlationRate`

```ts
private correlationRate(events: FeedbackEvent[]): { rate: number; idHits: number; sigHits: number } {
  if (events.length === 0) return { rate: NaN, idHits: 0, sigHits: 0 };

  let idHits = 0;
  let sigHits = 0;
  const end = Math.min(this.planSnapshots.length, Number.POSITIVE_INFINITY);

  for (const event of events) {
    const startPlan = event.planIndex + 1;
    const endPlan = Math.min(startPlan + this.lookaheadPlans, this.planSnapshots.length);

    let hitById = false;
    let hitBySig = false;
    for (let i = startPlan; i < endPlan; i++) {
      const plan = this.planSnapshots[i];
      if (!hitById && plan.recipeIds.has(event.recipeId)) hitById = true;
      if (!hitBySig && this.planHasSignatureMatch(plan, event.signature)) hitBySig = true;
      if (hitById && hitBySig) break;
    }
    if (hitById) idHits++;
    if (hitBySig) sigHits++;
  }

  return { rate: sigHits / events.length, idHits, sigHits };
}

private planHasSignatureMatch(plan: PlanSnapshot, eventSig: Set<string>): boolean {
  if (eventSig.size === 0) return false;
  for (const recipeSig of plan.recipeSignatures) {
    let overlap = 0;
    for (const t of eventSig) if (recipeSig.has(t)) overlap++;
    if (overlap >= this.minSignatureOverlap) return true;
  }
  return false;
}
```

`correlationRate` now returns signature-based rate as the primary; id-hits are reported separately.

### Step 6 — Rewrite `finalize`

```ts
finalize(): QualityMetrics['feedbackLoop'] {
  const liked = this.feedbackEvents.filter(e => e.isLiked);
  const disliked = this.feedbackEvents.filter(e => e.isDisliked);

  const pos = this.correlationRate(liked);
  const neg = this.correlationRate(disliked);

  const positiveCorrelation = pos.rate;   // NaN when liked.length === 0
  const negativeCorrelation = neg.rate;   // NaN when disliked.length === 0

  let netEffectiveness: number;
  if (Number.isNaN(positiveCorrelation) && Number.isNaN(negativeCorrelation)) {
    netEffectiveness = NaN;
  } else {
    const p = Number.isNaN(positiveCorrelation) ? 0 : positiveCorrelation;
    const n = Number.isNaN(negativeCorrelation) ? 0 : negativeCorrelation;
    netEffectiveness = p - n;
  }

  const totalEvents = this.feedbackEvents.length;
  const totalIdHits = pos.idHits + neg.idHits;
  const totalSigHits = pos.sigHits + neg.sigHits;

  return {
    positiveCorrelation,
    negativeCorrelation,
    netEffectiveness,
    feedbackEventCount: totalEvents,
    exactRecipeHits: totalIdHits,
    signatureHits: totalSigHits,
    overlapDensity: totalEvents === 0 ? NaN : totalSigHits / totalEvents,
  };
}
```

### Step 7 — Rendering

`SummaryReportGenerator.ts:138-141` and the `avg()` helper at 286-289: add a `formatMetric(x)` helper that returns `"—"` for NaN and `x.toFixed(4)` otherwise. Use it for all feedbackLoop columns. Add new columns for `feedbackEventCount`, `overlapDensity`. Keep `exactRecipeHits` / `signatureHits` out of the summary table but include in `RawDataExporter` CSV for post-hoc analysis.

### Step 8 — Tests

Preserve existing tests by constructing the tracker with `lookaheadPlans: 2, minSignatureOverlap: 999` (forces exact-id fallback behaviour). Or refactor those tests to explicitly target the signature path; easier to keep them as they are since they were never meant to exercise signature matching.

Add new tests:

1. **Realistic multi-week sparsity test.** 13 plans × 7 unique recipes sharing `cuisine:italian` tags. Feedback event on plan 0 liking one Italian dish. Every subsequent plan contains ≥1 Italian dish. Expect `positiveCorrelation = 1.0`, `netEffectiveness = 1.0`.

2. **No signature overlap test.** 13 plans with disjoint cuisines. Feedback on a Thai dish in plan 0; subsequent plans have zero Thai. Expect `positiveCorrelation = 0`, documented as genuine-zero (not NaN).

3. **Degenerate-case NaN test.** No feedback events at all. Expect `netEffectiveness = NaN`.

4. **Diagnostic counters test.** Verify `feedbackEventCount`, `exactRecipeHits`, `signatureHits`, `overlapDensity` all populated correctly.

5. **Verify `record()` planIndex correctness.** Feedback given on day 10 (plan 1 active), day 20 (plan 2 active). Assert event planIndex matches the plan that was active, not an off-by-one. (Picks up QUESTIONS.md §2.)

### Step 9 — Smoke-run

Run the full 10-persona simulation (`npm run simulate` or equivalent; verify via `simulation/package.json`). Confirm:
- `netEffectiveness` is non-zero for at least the high-tier personas.
- Values are plausibly ordered (high tier > medium > low for positive; inverse for negative).
- No personas show `"—"` unless they actually generate zero feedback.

---

## 6. Risks

1. **Allowlist brittleness.** Hardcoded cuisine/protein list misses Tasty tag variants (`cuisine:italian` vs `italian-cuisine` vs `italian food`). Mitigation: peek at real Tasty tags in `KitchenSinkNew/simulation/seed-data/` during implementation; expand allowlist to match. Fall back to case-insensitive substring match if needed.

2. **Signature overlap too permissive.** With K = 2, many recipes will "match" (e.g., any two dinner+chicken recipes). Could push values toward 1.0 for everyone, just in the opposite failure mode. Mitigation: tune K on real runs; include `signatureHits/feedbackEventCount` in reports so the sparsity is visible and adjustable.

3. **Extending lookahead to ∞ changes negative-correlation semantics subtly.** "Disliked recipe appears in *any* future plan" is a much weaker signal than "...in the next 2 plans" — almost any disliked recipe will eventually reappear somewhere. Mitigation: the signature path dominates; exact-id is now diagnostic only. Optionally cap disliked lookahead at 4-6 plans — decide during implementation.

4. **Simulation seed data may not have rich enough tags.** If Tasty recipes in the seed fixture lack cuisine tags, signatures will be empty and the fix won't help. Mitigation: verify early (Step 1).

---

## 7. Acceptance Criteria

- [ ] `netEffectiveness` is non-zero (|value| > 0.05) for at least 7 of 10 personas on the standard 90-day simulation.
- [ ] High-tier personas show distinguishable `netEffectiveness` from low-tier (rank-order differs, not just magnitude).
- [ ] `overlapDensity` is reported and is > 0.05 for high-tier personas (proves signature matching is actually hitting).
- [ ] Degenerate case ("no feedback events") renders as `"—"`, not `"0.0000"`.
- [ ] All existing tests pass; new tests pass.
- [ ] No regression on `DiversityTracker` or other trackers.
