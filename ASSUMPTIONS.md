# Assumptions — Fix Dietary Filter Veto

Living doc. Planning-phase assumptions start here; append as implementation sub-agents surface more.

## Planning-phase

1. The `>=3` fallback at `MealPlanAction.ts:155` was an early defensive guard
   against an empty meal plan, not an intentional product decision to relax
   dietary constraints. Removing it is the correct fix.
2. Dietary tags are **mandatory** when set (the `DietaryInvariant.ts` test
   asserts this). They are not soft preferences.
3. The recipe corpus contains enough vegan/gluten-free/dairy-free/nut-free
   tagged recipes for personas to plan a full week. If not, the right fix is
   to expand the corpus, not to silently serve non-compliant recipes.
4. Tag normalization in `src/mappers/recipeMappers.ts:102–116` is sufficient
   — kebab-case lowercase tags reach the filter intact. No new normalization
   is required.
5. Allergies and restrictions (`DietaryPreferences.allergies`,
   `DietaryPreferences.restrictions`) are out of scope for this fix; the
   simulation violations are all about the boolean flags
   (`vegan`/`vegetarian`/`glutenFree`/`dairyFree`/`nutFree`/`lowCarb`).
6. The ranker (`rankRecipes`) does not need dietary awareness: filtering
   upstream gives it a clean compliant pool, so adding dietary features to
   the score would be redundant.
7. Centralizing `DIETARY_TAG_MAP` into a shared utility will not break the
   simulation invariant validator as long as its `label` field is preserved.

## Implementation-phase

8. Production scope **expanded** during implementation. The user confirmed the
   production app shares this bug. Two additional sites needed migration:
   - `src/utils/mealPlanSelector.ts` — `meetsAllDietaryRequirements()` and
     three more in-file tag-check sites (`calculateDietaryScore` and
     `essentialDietaryFilter`) hardcoded only 4 of the 6 dietary flags
     (missing `nutFree` and `lowCarb`). All migrated to `passesDietaryFilter`.
   - `src/services/recommendationMealPlanService.ts` — added a defensive
     post-fetch dietary filter so the ranker only sees compliant candidates,
     mirroring the simulation fix.
9. The shared module's hyphenated-only tag matching (e.g. `'gluten-free'`
   only, not `'gluten free'`) is acceptable because `recipeMappers.ts:102–116`
   normalizes spaced/underscored variants to hyphenated at ingest time.
   The previous `DietaryInvariant` accepted both forms — this was defensive
   redundancy that is no longer needed.
10. Promoting the production `essentialDietaryFilter` from a 2-flag gate
    (vegan/vegetarian only) to a 6-flag gate is a deliberate behavior change.
    The original code's "ethical-only" carve-out is the precise pattern that
    let `nutFree` violations through. This is the fix.
11. Q2 (ranker dietary bonus as soft signal) deferred. Once the filter runs
    upstream of the ranker, every candidate is compliant — a soft "dietary
    fit" feature would always be 1.0 and contribute nothing to ranking. The
    bonus is only meaningful if the filter is soft, which it no longer is.
    Logged in QUESTIONS.md as accepted-but-deferred.
12. Tests live at `src/utils/__tests__/dietaryFilter.test.ts` per `jest.config.js`
    `testMatch` pattern. Jest is configured (`ts-jest` preset) but the binary
    is not installed locally; the suite was not run as part of this commit.
    Tests will run in CI / `npm install`-fresh environments.
