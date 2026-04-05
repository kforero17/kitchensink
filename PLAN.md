# Remove Spoonacular API and Mock Recipes from Meal Planning

Simplify recipe sourcing to use only Tasty recipes from Firebase Firestore, removing Spoonacular API integration and hardcoded mock recipe data.

## Changes

1. **candidateGenerationService.ts** — Removed Spoonacular adapter, kept Tasty API + Firestore fallback only
2. **recommendationMealPlanService.ts** — Removed 50/50 source mixing, use all Tasty scored recipes directly
3. **featureEngineering.ts / rankRecipes.ts** — Removed `sourceBias` and `spoonacularBias`, redistributed weights
4. **apiRecipeService.ts** — Deleted entirely (no remaining consumers after screen/swapper cleanup)
5. **shared/interfaces.ts / Recommendation.ts** — Simplified `source` type to `'tasty'` only
6. **mappers/recipeMappers.ts** — Removed `mapSpoonacularRecipeToUnified()`
7. **Screens** — Removed `apiRecipeService` usage from LoadingMealPlanScreen, MealPlanScreen
8. **recipeSwapper.ts** — Switched from `apiRecipeService` to `fetchRecommendedRecipes`
9. **mealPlanSelector.ts** — Removed `recipeDatabase` import, stubbed exploration bonus lookups
10. **environment.ts / envUtils.ts** — Removed all Spoonacular env vars and config
11. **DebugScreen.tsx** — Removed all Spoonacular connectivity tests and UI buttons
12. **cachingService.ts** — Renamed Firestore collection from `spoonacularCandidateCache` to `recipeCandidateCache`
13. **candidateGenerationService.test.ts** — Rewritten for Tasty-only candidate generation

## Deleted Files (13 total)

- `unifiedRecipeService.ts`, `spoonacular.ts`, `spoonacularApi.ts`, `recipeApiService.ts`
- `mockRecipes.ts`, `recipeDatabase.ts`, `seasonalRecipes.ts`, `additionalRecipes.ts`
- `apiRecipeService.ts`, `testEnv.ts`
- `spoonacularApiService.test.ts`, `testSpoonacular.ts`, `mealPlanTest.ts`

## Net Result

- **-4,554 lines** removed, **+174 lines** added
- Single recipe source: Tasty/Firebase only
- Simpler ranking pipeline (no source bias feature)
- No mock recipe fallback (empty array on failure)
