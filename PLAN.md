# Fix Dietary Filter Veto

## Problem

The simulation harness emits 658 invariant violations; **610 (93%)** match the pattern
`Recipe "X" lacks required Y tag for Y preference`. The planner serves vegan-explorer
non-vegan recipes (e.g. "Roasted Garlic Butter", "Dina's Hot and Spicy Tuna"),
serves dairy-free-beginner dairy-laden recipes ("Broccoli Rice and Cheese"), and
serves allergy-aware-japanese (gluten-free + nut-free required) recipes carrying
neither tag.

## Root Cause

`KitchenSinkNew/simulation/actions/MealPlanAction.ts:148–155`:

```ts
const filtered = scored.filter(s => passesDietaryFilter(s.recipe, dietary));
const candidates = filtered.length >= 3 ? filtered : scored;
```

When fewer than 3 ranked recipes pass the dietary filter, the filter is **silently
discarded** and the unfiltered ranked list is used. This is the dominant source
of the 93% violation rate.

Two contributing structural problems:

1. **Filter runs after the ranker.** The ranker scores generic appeal with no
   dietary awareness, so non-compliant recipes dominate the top of the list and
   the post-filter discards most of the candidate pool — triggering the fallback.
2. **No hard veto.** Dietary preferences are treated as soft annotations rather
   than mandatory constraints.

The mapping logic itself and tag normalization are correct. The bug is the
silent fallback plus pipeline ordering.

## Approach

1. **Filter before ranking.** Move the dietary filter upstream of `rankRecipes()`.
2. **Remove the fallback.** No silent relaxation; surface a clear diagnostic if
   the compliant pool is empty.
3. **Promote the helpers** into `src/utils/dietaryFilter.ts` so the production app
   and the invariant validator share one source of truth (DRY).
4. **Tests** for veto, multi-constraint personas, and empty pools.

## Files

| File | Change |
|------|--------|
| `KitchenSinkNew/src/utils/dietaryFilter.ts` | **NEW** — `DIETARY_TAG_MAP`, `passesDietaryFilter`, `filterByDiet` |
| `KitchenSinkNew/simulation/actions/MealPlanAction.ts` | Filter before rank; remove fallback |
| `KitchenSinkNew/simulation/invariants/DietaryInvariant.ts` | Consume shared map |
| `KitchenSinkNew/src/utils/__tests__/dietaryFilter.test.ts` | **NEW** — unit tests |

## Risks

1. Empty compliant pool may cause persona meal-plan failure — surface as
   structured error rather than silent fallback.
2. Top-N selector at `MealPlanAction.ts:157` must handle pools smaller than
   `weeklyMealPrepCount` (verify in implementation).
3. `DietaryInvariant.ts` uses a `label` field; consolidation needs an adapter.

## Verification

Re-run simulation harness; dietary-tag violation count must drop to ~0 from 610
for vegan-explorer, dairy-free-beginner, and allergy-aware-japanese personas.
