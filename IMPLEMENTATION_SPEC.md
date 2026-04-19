# Diversity Metric — Rolling-Window Novelty

**Working branch:** `diversity-rolling-novelty` (forked off `simulation-harness`; the tracker code only exists on that branch).

---

## 1. Problem Statement

`DiversityTracker.finalize()` (`KitchenSinkNew/simulation/quality/DiversityTracker.ts:68-101`) currently emits `uniqueCount / totalIds` over a 14-day window of collected plans. In practice every persona reports **mean = 1.0000, std = 0.0000** — the metric is saturated and carries no signal.

Two shapes the bug could take, both equally uninformative:

1. **Single-plan degenerate case.** Each 7-slot meal plan is unique-by-construction (the planner never suggests the same recipe twice in one week), so if only one plan is in the window, the ratio is always 1.
2. **Sparse-pool case.** Even across a 14-plan × 7-slot window (≤98 recipe IDs), the recommendation pool is large enough that collisions rarely happen, so the ratio stays pinned at 1.

Either way the metric answers a question we don't care about ("are recipes unique inside the window?") instead of the question we do care about ("does the planner give the user fresh plans week-over-week, or does it keep recycling the same few recipes?").

### Desired signal

**Week-over-week novelty** — for each day *D* with sufficient history, what fraction of today's recipes did **not** appear in the plan from *D − N* days ago.

```
overlap(D)  = |plan(D) ∩ plan(D - N)| / |plan(D)|
novelty(D)  = 1 - overlap(D)
```

Aggregated across days → mean/std/min/max per persona. Default **N = 7** (a "week ago"), matching the user's example of comparing day-30 to day-23. Configurable.

Expected spread across personas:
- Planner that recycles the same 7 recipes → novelty ≈ 0
- Planner that produces a fully fresh week every week → novelty ≈ 1
- Realistic personas → somewhere in between

---

## 2. Codebase Context (discovered)

| Concern | Finding |
| --- | --- |
| Metric code | `KitchenSinkNew/simulation/quality/DiversityTracker.ts` — `DiversityTracker` class, `finalize()` at `:68-101` |
| Per-plan recipe data | `plan.recipeIds: string[]` on the window entries fed to `finalize()` (fed via `record()`, `:49-66`) |
| Report aggregation | `KitchenSinkNew/simulation/reports/SummaryReportGenerator.ts:184-231` — `appendQualityTrends()` reads `m.diversity.mean`, calls `this.stdDev(values)` at `:211`, renders at `:226-228` |
| DaySnapshot storage | `QualityTracker` keeps every `DaySnapshot` in `private snapshots: DaySnapshot[] = []` — historical plans are already retained, no new data-capture plumbing needed |
| Plan structure | `DayState.currentMealPlan: UnifiedRecipe[]` in `simulation/profiles/types.ts:99-106`; `UnifiedRecipe.id` is the stable recipe key |
| Tests | `KitchenSinkNew/simulation/__tests__/quality/trackers.test.ts` — Jest. `DiversityTracker` block at `:99-201`. Key tests at `:121-137` (single-plan ⇒ 1.0) and `:139-164` (two overlapping plans ⇒ 0.75). Both will need to be replaced. |
| Jest config | `KitchenSinkNew/jest.config.js` |

---

## 3. Approach

Replace the within-window uniqueness ratio with a **day-over-day novelty** computation over the tracker's own retained per-day plans. No new data needs to flow in.

### 3.1 Algorithm (plain prose)

For each recorded day *D* in order:
1. If we don't have a plan from day *D − N*, skip.
2. If `plan(D)` is empty or `plan(D − N)` is empty, skip.
3. Compute `overlap = |plan(D).recipeIds ∩ plan(D − N).recipeIds| / |plan(D).recipeIds|`.
4. Append `1 - overlap` to `perDay`.

Aggregate: `mean`, `std`, `min`, `max` across `perDay`. If `perDay` is empty (run shorter than N days), emit the no-data sentinel shape (see §3.3).

### 3.2 Configurable lookback

- New public field on `DiversityTracker`: `lookbackDays: number` (default `7`).
- Constructor-injectable so tests can exercise N=1, N=3, etc.
- Record the chosen `lookbackDays` on the emitted metric so the report can label it (e.g. "Novelty (7d)").

### 3.3 Output shape

Replaces the current `perWindow` output. All call sites (see §5) must be updated.

```ts
export interface DiversityMetrics {
  perDay: number[];        // novelty per day with valid lookback, in day order
  mean: number;            // mean over perDay; NaN if perDay empty
  std: number;             // population std over perDay; NaN if fewer than 2 samples
  min: number;             // NaN if perDay empty
  max: number;             // NaN if perDay empty
  lookbackDays: number;    // echo of config, e.g. 7
  skippedDays: number;     // days we had no lookback match (for report footnote)
}
```

> Rename `perWindow` → `perDay`. Keep `mean` so the report renderer needs no restructuring beyond NaN handling.

### 3.4 Semantic flip — DO NOT SILENTLY INVERT

The old metric was "higher = more diverse". The new metric is **"higher = more novel week-over-week"** — same directional intuition (bigger = better variety), so the metric row stays in the same column set. Rename the label to `Novelty (7d, mean)` to make the basis explicit.

---

## 4. Files to Modify

| File | Change |
| --- | --- |
| `KitchenSinkNew/simulation/quality/DiversityTracker.ts` | Rewrite `finalize()`; add `lookbackDays` field + constructor arg (default 7); drop the window-based collection logic; operate on the ordered per-day history it already collects in `record()`. |
| `KitchenSinkNew/simulation/quality/types.ts` *(if metric shape defined there)* | Update `DiversityMetrics` interface per §3.3. If the shape lives inside `DiversityTracker.ts`, update there. |
| `KitchenSinkNew/simulation/__tests__/quality/trackers.test.ts` | Delete the two legacy DiversityTracker tests at `:121-137` and `:139-164`. Replace with novelty cases (see §6). |
| `KitchenSinkNew/simulation/reports/SummaryReportGenerator.ts` | Update the "Diversity (mean)" label to "Novelty (Nd, mean)" where N reads from the first persona's `diversity.lookbackDays`. Handle `NaN` from empty `perDay` (render as `"—"`). Keep std/min/max wiring. |
| Any other consumers of `QualityMetrics.diversity.*` | **Implement-phase sub-agent** must grep for `diversity.perWindow` and `diversity.mean` references across `KitchenSinkNew/simulation/` and update them. Likely zero hits outside the report layer, but verify. |

## 5. New Files

None. All existing files carry the fix.

## 6. Test Strategy

Replace the two existing DiversityTracker tests with three targeted novelty cases, plus two edge cases:

### 6.1 Repeating planner ⇒ novelty ≈ 0

Build 14 days of snapshots where every day's plan is the identical 7 recipe IDs. `finalize(lookbackDays: 7)` should produce `perDay` of length 7 (days 7..13), every entry equal to 0, `mean === 0`.

### 6.2 Fully fresh planner ⇒ novelty ≈ 1

Build 14 days, each day's 7 recipe IDs disjoint from every other day. `perDay` length 7, every entry 1, `mean === 1`.

### 6.3 Half-overlap ⇒ novelty ≈ 0.5

Construct a planner that repeats 3 of 7 recipes compared to 7 days prior, rotating the other 4. For the affected days, `novelty(D) = 1 - 3/7 ≈ 0.5714`. Assert exact value.

### 6.4 Short run < N days

Run for only 5 days with `lookbackDays: 7`. `perDay` empty, `mean === NaN`, `skippedDays === 5`. Verify the report renderer (via its own test or a snapshot) shows `"—"` instead of `NaN`.

### 6.5 Custom lookback

Run 4 days with `lookbackDays: 1` where plans alternate fully fresh/identical. Verify per-day values are `[0, 1, 0]` (days 1, 2, 3).

**Test style:** keep existing `makeRecipe`, `makeDayState`, `makeSnapshot` helpers (lines 99-201 of the test file). Add a small helper `makeDailyIds(day, ids)` if it shortens the tests. Do not mock — construct real snapshots.

---

## 7. Implementation Order

1. **Update `DiversityTracker.ts`:** rewrite `finalize()` and add `lookbackDays`. Keep `record()` unchanged (it already collects what we need).
2. **Update `DiversityMetrics` shape** wherever it lives (same file or `quality/types.ts`).
3. **Discover + fix downstream consumers:** grep `diversity\.(perWindow|mean|std|min|max)` under `simulation/`. Update.
4. **Update `SummaryReportGenerator.ts`:** label + NaN rendering. Verify the std/min/max table columns still populate.
5. **Rewrite tests:** replace the two legacy tests with §6.1–§6.5.
6. **Run Jest:** `cd KitchenSinkNew && npx jest simulation/__tests__/quality/trackers.test.ts`. Expect green.
7. **Smoke-run the sim** (optional, fast): `cd KitchenSinkNew && npm run simulate -- --archetype-only --days 30`. Inspect the markdown report: std should no longer be exactly 0 across personas; column should be labeled `Novelty (7d, mean)`.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| Some consumer relies on `diversity.perWindow` array shape | Grep before editing, fail build at compile if missed (TS catches). |
| `NaN` propagates silently into the report | Explicit guard in `SummaryReportGenerator`; test the short-run case. |
| Rotating-recipe personas that happen to cycle every exactly N days drive novelty to 0 — "correct" but could surprise | Document in the report row footer: "Novelty measures fraction of today's plan absent from the plan N days prior." |
| Changing the metric semantics breaks any historical comparisons | No historical reports exist yet — branch is pre-merge. Document the cutover in the PR body. |
| Test file churn obscures intent in review | Replace the two broken tests rather than adding more on top, so the diff is `-` for the old uniqueness semantics and `+` for novelty. |

---

## 9. Out of Scope

- Cross-persona diversity (how different are Alice's plans from Bob's) — different question.
- Multiple lookback windows simultaneously (e.g., 7d + 30d). Can be added later by making `lookbackDays` an array.
- Ingredient-level or cuisine-level diversity (different tracker).
- Any change to `RepetitionTracker` or other quality trackers (the user's note only called out diversity).
