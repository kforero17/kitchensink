# Open Questions — Fix Dietary Filter Veto

Living doc. Questions flagged during planning; append as implementation sub-agents surface more.

## Planning-phase

1. **Empty compliant pool — error vs. partial plan?** If a persona's dietary
   constraints leave fewer than `weeklyMealPrepCount` compliant recipes, should
   the planner (a) error out, (b) emit a partial plan with a warning, or (c)
   try a fallback corpus? Current spec assumes error / structured diagnostic.

B.

2. **Should the ranker score dietary fit as a soft signal too?** Filtering
   upstream is sufficient for correctness, but a small bonus on positive tags
   could improve diversity within the compliant pool. Out of scope for this PR
   unless the simulation surfaces a related issue.

yes

3. **`DietaryInvariant.ts` `label` field** — is the human-readable label used
   anywhere besides the violation message? If so, the shared map needs to
   carry it; if not, we can keep it local to the validator with a thin
   adapter.

not sure

4. **Production app pipeline** — the `MealPlanAction` we are fixing lives
   under `simulation/actions/`. Does the actual production app
   (`src/services/...` or similar) have its own meal-plan generator that
   shares this bug? Worth a quick check during implementation; if so, the
   shared utility benefits both.

i think so

5. **Allergies & restrictions** — out of scope here, but the
   `DietaryPreferences.allergies` and `restrictions` arrays are currently
   ignored by the filter. Worth a follow-up if allergy violations show up in
   the simulation report.

## Implementation-phase

6. **Lost spaced-variant tag aliases.** The previous local `DIETARY_TAG_REQUIREMENTS`
   in `DietaryInvariant.ts` accepted both hyphenated (`'gluten-free'`) and
   spaced (`'gluten free'`) forms, plus `'keto'` as a low-carb alias. The
   shared module accepts only hyphenated. Per planning assumption #4, the
   ingest-time normalization in `recipeMappers.ts` makes the spaced forms
   unreachable in practice. **Open follow-up:** if any legacy
   recipe data bypasses the mapper, those tags will now produce false-positive
   violations.

7. **Q2 (ranker dietary bonus) deferred.** Filtering upstream gives the ranker
   a fully-compliant pool, so a "dietary fit" feature would be a constant 1.0.
   No-op for ranking. Re-open only if a future change reintroduces non-veto
   dietary handling.

8. **Production `essentialDietaryFilter` promoted from 2-flag to 6-flag gate.**
   The original code only hard-rejected vegan/vegetarian violations and
   relegated `glutenFree`/`dairyFree`/`nutFree`/`lowCarb` to soft scoring
   penalties. This was the precise pattern that let nut-free and low-carb
   violations through. The promotion may shrink eligible-recipe pools more
   aggressively for users with strict combos — the relaxation-level fallback
   in `mealPlanSelector` should still produce a partial plan rather than
   panic, but this is worth watching in production.

9. **`mealPlanSelector` test failures pre-existing.** `src/tests/mealPlanSelector.test.ts`
   has unrelated typecheck errors (`cuisines` missing from `Recipe`,
   `FoodPreferences` shape drift). Not introduced by this PR; not fixed by this PR.

