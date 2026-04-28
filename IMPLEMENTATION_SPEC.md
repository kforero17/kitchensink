# Diagnose Seasonal Ranking — `seasonalRelevance` ≈ 0

**Working branch:** `diagnose-seasonal-ranking` (off `main`).
**Mode:** investigation + targeted fix. Ships a confirmation experiment, a single-file ranker fix that introduces a cold-start seasonal prior, and a tracker realignment so the metric reflects what the ranker is actually steering by.

---

## 1. Problem Statement

The simulation's `seasonalRelevance` quality metric reports **mean = 0.0203, max = 0.1000** across all personas and all simulated days. The metric measures the fraction of plan recipes whose tags overlap with a per-season keyword whitelist (`SeasonalRelevanceTracker.ts:16-21` — `winter: [soup, stew, comfort, warm, roast, roasted, baked, braised]`, etc.).

A concrete confirming case: the `vegan-explorer` persona's **winter** plan served *Christmas Cookie Clusters* and *Tofu Teriyaki Steak* — neither carries a `winter` (or any) season tag in the corpus.

The user's framing posed two hypotheses:
- **H1**: the ranker isn't weighting seasonal fit at all.
- **H2**: the corpus doesn't have enough season-tagged recipes to move the needle.

This investigation found **three compounding root causes**, plus a downstream consequence for the upcoming "summer frozen-clock baseline" (2026-06-15) decision.

---

## 2. Findings

### 2.1 Corpus has zero explicit season tags
- `KitchenSinkNew/allrecipes_firestore.json` (724k lines, ~50k recipes): **0 occurrences** of `"spring"`, `"summer"`, `"fall"`, `"autumn"`, or `"winter"` as JSON values.
- The tracker's expanded keyword whitelist (`baked`, `roasted`, `fresh`, `soup`, `stew`, `salad`, `warm`, `cold`, `light`, `bbq`, `raw`, `herb`, `green`, `harvest`, `squash`, `pumpkin`, `apple`, `braised`, `grilled`, `comfort`) yields ~645 tag matches across the entire corpus — diffuse overlap that explains why max isn't literally 0 (it's 0.1) and why the metric is dominated by accidental hits like `"baked"` on a ham strata.
- Recipe tags are overwhelmingly cuisine (`american`, `italian`), meal-type (`dinner`, `breakfast`), dietary (`vegetarian`, `vegan`), and verbatim ingredient names (`light brown sugar`, `frozen broccoli`). No season vocabulary at all.
- → **H2 confirmed.**

### 2.2 Ranker is season-aware in code, season-blind in practice
- `MealPlanAction.ts:146` (the simulation's plan-generation path) calls `rankRecipes` with a `seasonalProfile` and `currentSeason`. **The seasonal signal is wired in.**
- `rankRecipes.ts:28-39`: `seasonalFit` carries weight `0.08` in `DEFAULT_WEIGHTS` (and `0.07` in `PANTRY_ONLY_WEIGHTS`).
- But `computeSeasonalFit` (`seasonalSignal.ts:62-91`) is **history-driven**: it scores a recipe by how often the user *historically* cooked its tags in the current season. With `tagsWithData < 2` it returns the neutral fallback **0.5** (line 88).
- `MealPlanAction.ts:121` builds `seasonalProfile` from the persona's recipe history — which is empty on day 1 and grows slowly across the simulation.
- For most of every persona's run, every recipe gets `seasonalFit = 0.5`, contributing an identical `0.5 × 0.08 = 0.04` to every score → **zero seasonal differentiation in the ranking**.
- → **H1 partially confirmed.** The ranker has a seasonal weight on paper; in the simulation regime, it has effectively no influence.

### 2.3 Definitional mismatch — tracker ≠ ranker
- `SeasonalRelevanceTracker` measures **keyword-overlap with a fixed whitelist**.
- `computeSeasonalFit` measures **user-history co-occurrence**.
- These are different objects. Even if the corpus were tagged perfectly and the ranker steered hard, the tracker could still report low scores (and vice versa). The metric is not a faithful proxy for the thing it's named after.

### 2.4 Consequence for QUESTIONS §7 (summer frozen-clock baseline 2026-06-15)
- The simulation's `currentDate` is a per-persona frozen clock (`SimulationRunner.ts:156`, `addDays(simulationStartDate, dayIndex)`); `DaySimulator.ts:133` records `season: getSeason(currentDate)` correctly. The seasonal *context* propagates fine.
- But because of 2.1 + 2.2, **the ranker produces visually identical selections regardless of which season the clock is in**, and the tracker reports near-zero match rates for both. A summer baseline and a winter baseline will be indistinguishable in the report.
- One of the two stated reasons for picking 2026-06-15 ("winter would look weird") therefore has no empirical force today. **Until at least 2.1 or 2.2 is fixed, baseline date should be chosen on other grounds** (e.g. start-of-month, no DST quirks).

---

## 3. Approach

Three discrete, independently shippable fixes; this spec lands #1 and #3 in this PR and defers #2 to a follow-up. **Do all three at once and the metric becomes a real signal; do only #1 and the ranker steers by season but the tracker may still report low numbers for the wrong reason; do only #3 and the metric becomes faithful but the underlying behaviour is unchanged.**

### 3.1 Fix #1 — Add a domain-prior to `computeSeasonalFit` (cold-start fix)

`seasonalSignal.ts` currently has:

```ts
if (tagsWithData < 2) return 0.5;
```

Replace this with a blend of (a) a small hand-curated tag→season prior and (b) any user-history signal that exists. This makes the ranker steer by season from day 1 — no history required — and degrades gracefully into the personalised signal as history accumulates.

**Prior to ship (initial version):**

```ts
const SEASONAL_TAG_PRIOR: Record<string, Season> = {
  // Winter
  soup: 'winter', stew: 'winter', braised: 'winter', roast: 'winter',
  roasted: 'winter', baked: 'winter', comfort: 'winter', warm: 'winter',
  // Summer
  salad: 'summer', grilled: 'summer', grill: 'summer', bbq: 'summer',
  cold: 'summer', fresh: 'summer', light: 'summer', raw: 'summer',
  // Spring
  herb: 'spring', green: 'spring',
  // Fall
  squash: 'fall', pumpkin: 'fall', apple: 'fall', harvest: 'fall',
  cinnamon: 'fall',
};
```

(Same vocabulary as the tracker — intentional, see §3.3.)

**Algorithm change** in `computeSeasonalFit`:
1. Compute history-based affinity exactly as today.
2. Compute prior-based affinity: for each recipe tag in `SEASONAL_TAG_PRIOR`, score `1.0` if it matches `currentSeason`, else `0.0`. Average across matched tags.
3. If neither produces any signal → return `0.5` (true neutral).
4. If only the prior produces signal → return prior score (this is the cold-start case).
5. If only history produces signal → return history score (current behaviour, unchanged).
6. If both → return `0.7 × history + 0.3 × prior` (history dominates once it exists).

**Why a blend, not pure prior**: preserves the existing personalised learning. A user who consistently cooks chili in July ends up with chili → summer affinity; the prior says chili is a winter dish, but personalisation wins after a handful of cooks. Matches the existing intent of the feature.

### 3.2 Fix #2 — Corpus enrichment (DEFERRED)

Better long-term fix: at corpus-load or at simulation startup, derive season hints from each recipe's title/cuisine/ingredients (e.g. "Christmas" → winter, "Watermelon" → summer). Self-describes the corpus and benefits both the ranker (more training signal once history exists) and the tracker (more ground truth to measure against).

**Out of scope for this PR.** Captured as a follow-up — requires either a one-shot enrichment script + Firestore migration or a runtime tagger; both are larger than the cold-start fix. Filed in `QUESTIONS.md`.

### 3.3 Fix #3 — Realign the tracker to read the same signal the ranker steers by

The tracker should measure what the ranker optimises, otherwise the metric reports on a different problem. Two options considered:

| Option | Description | Verdict |
| --- | --- | --- |
| 3.3a | Drop the keyword whitelist; have the tracker call `computeSeasonalFit` against an empty (prior-only) profile and average the returned scores. | **Chosen.** Same code path the ranker uses → faithful evaluation. |
| 3.3b | Keep the keyword whitelist; just expand it. | Rejected — preserves the definitional mismatch. |

Rename the metric from `seasonalRelevance` to `seasonalFitScore` (the value it now reports) and update the report column. Keep `perSeason` aggregation since it remains useful.

**One subtlety**: if the tracker uses the same prior as the ranker, low scores can mean either (i) the ranker is doing its job and we just have low ceilings because the corpus has no season tags — i.e. fix #2 not yet done, or (ii) the ranker isn't picking from the high-affinity bucket. Distinguish in the report by also emitting per-plan **mean rank-bias**: the average percentile of selected recipes' `seasonalFit` within the candidate pool. If that's > 0.5, the ranker is steering correctly; the absolute number being low just means the ceiling is low.

### 3.4 Confirmation experiment (ships in this PR as a test)

Add a single new test asserting the ranker now distinguishes seasons from a cold start:

```
Given an empty user history
When the simulation runs the same persona-week with currentDate=2026-01-15 vs 2026-07-15
Then the top-5 selected recipe IDs should overlap by < 60%
And the winter run should pick more 'soup'/'stew'/'baked' tagged recipes than the summer run
And the summer run should pick more 'salad'/'grilled'/'fresh' tagged recipes than the winter run
```

Today, the same input produces identical top-5s under both clocks. After fix #1, they diverge. This is the test that proves the fix works.

---

## 4. Files to Modify

| File | Change |
| --- | --- |
| `KitchenSinkNew/src/ranking/seasonalSignal.ts` | Add `SEASONAL_TAG_PRIOR` constant; rewrite `computeSeasonalFit` per §3.1. Export a new `computePriorOnlyFit(tags, season): number` for the tracker. |
| `KitchenSinkNew/src/ranking/seasonalSignal.test.ts` | Update the existing "neutral 0.5 when no profile" test (which now returns prior-based score for tagged recipes) and add cases for: cold-start prior steering, history-only behaviour preserved, blended behaviour, untagged recipes still 0.5. |
| `KitchenSinkNew/src/tests/ranking.test.ts` | One existing assertion expects `seasonalFit === 0.5` for an absent profile (`ranking.test.ts:426`). Update to match new behaviour or pass an explicitly empty prior. |
| `KitchenSinkNew/simulation/quality/SeasonalRelevanceTracker.ts` | Rewrite `record()` to call `computePriorOnlyFit` per recipe and average. Rename emitted metric field to `seasonalFitScore`. Add `meanRankBias` (see §3.3 footnote) — for now stub to `null` if computing rank-bias requires plumbing the candidate pool through; otherwise compute. |
| `KitchenSinkNew/simulation/profiles/types.ts` | Update `QualityMetrics['seasonalRelevance']` shape: rename to `seasonalFitScore`, fields `meanFitScore: number; perSeason: Record<Season, number>; meanRankBias: number \| null`. |
| `KitchenSinkNew/simulation/__tests__/quality/trackers.test.ts` | Replace `SeasonalRelevanceTracker` block with cases against the new prior-fit semantics. |
| `KitchenSinkNew/simulation/reports/SummaryReportGenerator.ts` | Update column label/lookup from `seasonalRelevance.meanMatchRate` to `seasonalFitScore.meanFitScore`; surface `meanRankBias` if non-null. |
| `KitchenSinkNew/simulation/reports/RawDataExporter.ts` | Same field rename. |
| `KitchenSinkNew/simulation/__tests__/reports/SummaryReportGenerator.test.ts` + `RawDataExporter.test.ts` | Field rename in fixtures. |

## 5. New Files

None. Confirmation experiment lives in `simulation/__tests__/engine/` next to existing engine tests.

## 6. Implementation Order

1. **Update `seasonalSignal.ts`** with prior + blend + export of `computePriorOnlyFit`.
2. **Update `seasonalSignal.test.ts`** and `ranking.test.ts` (the one neutral-fallback assertion).
3. **Update `SeasonalRelevanceTracker.ts`** to use `computePriorOnlyFit`. Update `types.ts` shape.
4. **Update `trackers.test.ts`** for the tracker.
5. **Update report files** (`SummaryReportGenerator.ts`, `RawDataExporter.ts`) and their tests for the field rename.
6. **Add confirmation experiment** asserting summer/winter divergence from cold start.
7. **Run all simulation tests:** `cd KitchenSinkNew && npx jest simulation/ src/ranking/ src/tests/ranking`.
8. **Smoke-run the sim** (optional): regenerate the summary report; confirm `seasonalFitScore` column now varies meaningfully across personas (vegan-explorer winter should be visibly lower than the same persona summer; mediterranean-summer persona should be high).

## 7. Test Strategy

Five unit cases + one integration-ish case. Behaviour, not implementation.

### 7.1 Cold-start prior steers (unit, `seasonalSignal.test.ts`)
Empty profile, recipe tags `['soup', 'comfort']`, `currentSeason = 'winter'` → score > 0.7.
Same recipe with `currentSeason = 'summer'` → score < 0.3.

### 7.2 History dominates once it exists (unit)
Profile with 10 cooks of `['soup']` in summer, `currentSeason = 'summer'` → score returns history affinity (≈ 1.0), not the prior's "soup→winter" signal. The 0.7/0.3 blend keeps history in the lead.

### 7.3 Untagged recipe stays neutral (unit)
`recipeTags = []` → 0.5. Unchanged.

### 7.4 Recipe with only non-prior tags stays neutral (unit)
`recipeTags = ['american', 'dinner']`, empty profile → 0.5. The prior shouldn't fabricate signal where there is none.

### 7.5 Tracker: prior-fit averaging (unit, `trackers.test.ts`)
Build a snapshot with 5 recipes — 2 with `['soup']`, 2 with `['salad']`, 1 with `['american']` — current season `winter`. Expected `meanFitScore = (1 + 1 + 0 + 0 + 0.5) / 5 = 0.5`.

### 7.6 Confirmation experiment — summer ≠ winter from cold start (integration)
Build the simulation harness's MealPlanAction once with `currentDate=2026-01-15` and once with `currentDate=2026-07-15`, same persona, empty history both runs. Selected recipe IDs should differ; tag composition should shift winter-ward and summer-ward respectively.

**Test style:** keep existing helpers in each test file. Don't mock `computeSeasonalFit`; exercise the real function. Construct the prior inline if needed for clarity.

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Hand-tuned prior bakes Northern-Hemisphere bias into the product | Document in code comment; flag on the corpus-enrichment follow-up that the prior should eventually be derived rather than hand-curated. |
| Prior pulls too hard, dominating personalisation | 0.7/0.3 blend caps prior contribution at 30% once history exists. Test 7.2 guards this. |
| Tracker rename breaks downstream consumers we missed | TS catches at build. Grep `seasonalRelevance` across the repo before merging. |
| `meanRankBias` requires plumbing candidate pool into the tracker — out-of-scope creep | Ship as `null` for now; revisit if `meanFitScore` alone doesn't tell the story. |
| Other personas' summer-baseline reports look different after the fix | Expected and desirable. The whole point is that summer and winter should now look different. Re-baseline. |
| Defining the prior the same way as the tracker keyword set is circular ("the ranker now matches what the tracker measures because they share a vocabulary") | True. The test in 7.6 is the real check: it asserts behavioural divergence in the *recipe selection*, which the prior couldn't fake. |

## 9. Out of Scope

- Corpus enrichment (Fix #2). Filed in `QUESTIONS.md` as the natural follow-up — right long-term solution but materially larger than this PR.
- Multi-region / Southern Hemisphere season inversion.
- Per-cuisine seasonal priors (Mediterranean salad year-round vs. Nordic winter).
- Ingredient-level seasonality (asparagus → spring) — the prior is tag-level only.
- Re-running the historical simulation reports with the new metric. New reports get the new metric automatically; old reports stand as-is.
- Resolving the `2026-06-15` baseline date question itself. This spec only documents *why* the date choice is currently uninformative; the team can pick the date on logistical grounds in a separate decision.
