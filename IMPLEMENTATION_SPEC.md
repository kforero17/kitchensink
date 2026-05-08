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

1. **Filter runs after the ranker.** The ranker scores generic appeal (similarity,
   pantry overlap, seasonality, etc.) with no dietary awareness, so non-compliant
   recipes can dominate the top of the list, and the post-filter then discards
   most of the candidate pool — triggering the fallback.
2. **No hard veto.** Dietary preferences are treated as soft annotations rather
   than mandatory constraints.

The mapping logic itself (`DIETARY_TAG_MAP` in `MealPlanAction.ts:38–48` and the
identical map in `simulation/invariants/DietaryInvariant.ts:22–36`) is correct.
Tag normalization in `src/mappers/recipeMappers.ts:102–116` is correct
(`"dairy free"` → `"dairy-free"`, lowercasing, etc.). The bug is purely the
silent fallback plus pipeline ordering.

## Approach

1. **Filter before ranking.** Move the dietary filter upstream of `rankRecipes()`
   in `MealPlanAction.ts`. The ranker only sees diet-compliant recipes; whatever
   it ranks is safe to select.
2. **Remove the fallback.** No silent relaxation. If the compliant pool is empty,
   surface a clear error (let the simulation/app decide how to handle scarcity
   rather than masking the constraint violation).
3. **Promote the helpers.** Move `DIETARY_TAG_MAP` and `passesDietaryFilter` out
   of the simulation action into a shared module so the production app and the
   invariant validator can both consume them. Eliminates the duplicated map in
   `DietaryInvariant.ts` (DRY).
4. **Tests.** Unit tests covering: each preference key vetoes correctly, multi-
   constraint personas (gluten-free + nut-free) require both tags, an empty
   compliant pool does not silently degrade.

## Files to Modify

| File | Change |
|------|--------|
| `KitchenSinkNew/src/utils/dietaryFilter.ts` | **NEW**: export `DIETARY_TAG_MAP`, `passesDietaryFilter`, `filterByDiet`. Single source of truth. |
| `KitchenSinkNew/simulation/actions/MealPlanAction.ts` | Filter recipes by diet **before** `rankRecipes()`. Remove `filtered.length >= 3 ? filtered : scored` fallback. Import from `dietaryFilter.ts`. |
| `KitchenSinkNew/simulation/invariants/DietaryInvariant.ts` | Replace local `DIETARY_TAG_REQUIREMENTS` with import from `dietaryFilter.ts` (preserve `label` field if needed via small adapter). |
| `KitchenSinkNew/src/utils/__tests__/dietaryFilter.test.ts` | **NEW**: unit tests for the helpers. |

## Files to Add

- `KitchenSinkNew/src/utils/dietaryFilter.ts`
- `KitchenSinkNew/src/utils/__tests__/dietaryFilter.test.ts`

## Test Strategy

### Unit (new)
- `passesDietaryFilter` returns `false` when a required tag is absent.
- Returns `true` when all required tags are present.
- Multi-constraint user (gluten-free + nut-free) requires **both** tags.
- Tag matching is case-insensitive and accepts both `"dairy-free"` and
  `"dairy free"` shapes (mirrors existing `DIETARY_TAG_MAP`).
- Allergies/restrictions arrays do not crash the filter when empty.

### Integration / simulation
- Re-run the simulation harness. The `Recipe X lacks required Y tag for Y
  preference` violation count must drop to 0 for the personas listed in the
  bug report (vegan-explorer, dairy-free-beginner, allergy-aware-japanese).
- If the compliant pool is empty for a persona, the planner should surface a
  diagnostic rather than emit silent violations.

### No-mock policy
Tests use real `UnifiedRecipe` and `DietaryPreferences` objects per `The Word`
(do not mock data models).

## Risks

1. **Empty compliant pool.** Removing the `>=3` fallback may cause meal-plan
   generation to fail for personas with very strict dietary needs if the recipe
   corpus is too sparse. Mitigation: error path returns a structured message
   the simulation/app can surface; the right fix is broader (more compliant
   recipes), not silently serving non-compliant food.
2. **Ranker assumes a populated input.** If the filter shrinks the pool below
   `weeklyMealPrepCount`, the existing top-N selector at
   `MealPlanAction.ts:157–161` should already handle that gracefully — verify
   during implementation.
3. **Duplication consolidation.** Centralizing `DIETARY_TAG_MAP` could break
   `DietaryInvariant.ts` if its `label` field is used elsewhere. Adapter or
   parallel structure keeps the validator working.

## Implementation Order

1. Create `src/utils/dietaryFilter.ts` with the consolidated helpers.
2. Update `MealPlanAction.ts`: filter before rank, remove fallback, import shared helpers.
3. Update `DietaryInvariant.ts`: import shared map (keep label adapter).
4. Add unit tests.
5. Run simulation harness; confirm dietary violations drop to ~0 from 610.
6. Run typecheck/lint/tests; commit; PR.
