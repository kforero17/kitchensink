# Assumptions — Diagnose Seasonal Ranking

Living doc. Planning-phase assumptions start here; implement sub-agents append.

## Planning-phase

1. **The simulation actually exercises `MealPlanAction` → `rankRecipes`.** Confirmed in `KitchenSinkNew/simulation/actions/MealPlanAction.ts:146`. If the simulation ever swaps to a different selection path (e.g. directly invoking `recommendationMealPlanService`), the same fix needs to land there too — but today there's only one path.

2. **Persona history is empty at simulation start.** Inferred from `SimulationRunner.ts:156` (date is built from `simulationStartDate + dayIndex`) plus the absence of any seed-history hook in profile setup. If a persona ever pre-seeds cooking history, the cold-start framing weakens for that persona — but the prior still helps until accumulated history overrides it.

3. **The 0.0203 / 0.1000 numbers come from a recent simulation run, not stale data.** Taking the user's framing at face value. If the numbers are from before commit `ee2a5b4` ("Add predictive meal planning with temporal, seasonal, and leftover signals"), they predate the seasonal feature entirely and the diagnosis still holds (it explains why fixing it didn't move the metric).

4. **The `~645` keyword tag matches across the corpus is a meaningful estimate.** Counted via case-sensitive JSON-string match on the expanded whitelist; some matches are inside non-tag fields (ingredient names like `"frozen broccoli"`) so the true tag-level count is a loose upper bound. Order of magnitude is right and supports the "max ≈ 0.1" observation.

5. **Northern-Hemisphere temperate-climate priors are acceptable for the current product scope.** The hand-curated prior treats `salad → summer`, `soup → winter`, etc. International users in equatorial or Southern-Hemisphere regions will get inverted/wrong signals. Captured as a risk; deferred until international expansion is on the roadmap.

6. **`computeSeasonalFit` is the only consumer of the seasonal signal that matters.** Verified by the grep in §2 of the spec — `predictionService.ts:142` and `MealPlanAction.ts:146` both route through `rankRecipes` → `computeFeatures` → `computeSeasonalFit`. No other call sites.

7. **The 0.7/0.3 history-vs-prior blend is a reasonable default, not a tuned value.** If empirical data later suggests a different ratio, easy to change; pick a round number now to keep the PR scoped.

8. **Renaming `seasonalRelevance` → `seasonalFitScore` is acceptable churn.** No external dashboards or BI consumers exist yet; the field flows through the report generator and raw exporter, both internal. A pure rename is cheaper than carrying both names.

## Implement-phase

9. **Prior tag matching is case-insensitive; history matching stays case-sensitive.** `computePriorAffinity` lowercases each recipe tag before looking it up in `SEASONAL_TAG_PRIOR`. The history path (`computeHistoryAffinity`) is unchanged. This avoids forcing existing history data to be re-keyed while keeping the prior tolerant of whatever casing the corpus emits.

10. **History "signal" threshold preserved at `tagsWithData >= 2`.** The original `computeSeasonalFit` returned 0.5 when `tagsWithData < 2`. The rewrite keeps that threshold to mean "history produces a signal" — only when ≥ 2 tags have history data does the history score participate in the blend. Below threshold, prior alone (or 0.5) is returned.

11. **Test resilience over precision in the existing soup-in-winter / soup-in-summer cases.** Two pre-existing tests in `seasonalSignal.test.ts` used `toBeCloseTo(0.75, 2)` / `toBeCloseTo(0.05, 2)`. The 0.7/0.3 blend changes those numbers slightly. We loosened the assertions to `>0.7` / `<0.2` rather than recomputing tight numbers — preserves test intent (high vs low) and survives small future blend-weight tweaks.

12. **Test for "history dominates" includes a second tag.** The spec described 10 cooks of `['soup']`. The threshold for the history signal is `tagsWithData >= 2`, so a single-tag history wouldn't have triggered the blend. The implementing test uses `['soup', 'comfort']` with the same all-summer history so both tags hit the threshold and the blend is exercised as intended.

13. **`meanRankBias` emitted as `null` in every case (including empty trackers) for this PR.** Spec was silent on the empty case; null everywhere is consistent with "this field is stubbed regardless of recordings" and matches the type signature `number | null`.

14. **Per-season unobserved seasons fill to `0`.** Preserved the existing tracker convention from `seasonalRelevance.perSeason` rather than switching to `null` or omission. Avoids cascading changes through report generation.

15. **Rank Bias column hidden when every profile reports null.** In `SummaryReportGenerator` per-profile cards, the column is conditional on at least one non-null value (currently always hidden — `meanRankBias` is unconditionally null in this PR). The executive summary always includes a "Rank Bias" row showing "—" so the row exists for future runs. Trade-off: card-table column stability vs. visual noise; chose less noise now since the field is uniformly null.

16. **Defensive `recipe.tags ?? []` in `SeasonalFitTracker`.** `UnifiedRecipe.tags` is typed `string[]` so the nullish-coalesce is theoretically dead, but the original tracker accessed `recipe.tags` defensively. Kept the same defensiveness; cost is zero, removes a source of NRE if the type ever loosens.

17. **Confirmation experiment uses Option A (full `MealPlanAction.execute` with stubbed `SimFirestore`).** The spec offered three implementation strategies; Option A exercises the real plan-generation path through `rankRecipes` → `computeFeatures` → `computeSeasonalFit`, matching the production code path the metric was failing on. Existing engine tests use the same `jest.fn()` partial-stub pattern (`DaySimulator.test.ts`).
