# Remove Spoonacular API and Mock Recipes from Meal Planning

## Problem Statement

Meal plan generation currently pulls recipes from three sources:
1. **Tasty recipes** from Firebase Firestore (via `tastyApiService` and direct Firestore queries)
2. **Spoonacular API** (external paid API)
3. **Mock/hardcoded recipes** (`mockRecipes.ts`, `recipeDatabase.ts`, `seasonalRecipes.ts`)

We want to simplify to a single source: **Tasty recipes from Firebase only**.

## Architecture Overview

Two parallel meal plan generation pipelines exist:

### Pipeline A: Recommendation Pipeline (primary)
`recommendationMealPlanService.ts` -> `candidateGenerationService.ts` -> `rankRecipes.ts`
- `candidateGenerationService.ts` fetches from both Tasty (Firestore) AND Spoonacular
- `rankRecipes.ts` has `spoonacularBias` and source-based 50/50 mixing logic
- `recommendationMealPlanService.ts` enforces 50/50 Tasty/Spoonacular split

### Pipeline B: Legacy API Pipeline (fallback)
`apiRecipeService.ts` -> `recipeApiService.ts` (Spoonacular) OR `recipeDatabase.ts` (mocks)
- Used by `LoadingMealPlanScreen.tsx`, `MealPlanScreen.tsx`, `recipeSwapper.ts`
- Falls back to mock recipes on API failure or rate limiting

## Changes Required

### 1. `candidateGenerationService.ts` - Remove Spoonacular adapter
- Remove `fetchSpoonacularCandidates()` function and `SpoonacularAdapterParams` interface
- Remove imports: `fetchUnifiedRecipesFromSpoonacular`, `resetSpoonacularRecentlyFetchedIds`
- In `generateRecipeCandidates()`: remove Spoonacular fetch block, simplify to Tasty-only
- Remove `titleSimilarity`/`bigramJaccard` imports (only used for Tasty-vs-Spoon dedup)
- Keep the `deduplicate()` function (still useful for Tasty self-dedup)
- Keep `fetchTastyCandidates()` as Firestore fallback

### 2. `recommendationMealPlanService.ts` - Remove source mixing logic
- Remove the 50/50 source split logic (lines 112-133)
- Remove `spoonacularBias: -1` from ranking options
- Simplify: just use all scored recipes directly (no source filtering)
- Keep meal-type minimum enforcement (lines 139-151)

### 3. `apiRecipeService.ts` - Remove mock fallback, use Firebase only
- Remove imports: `recipeDatabase`, `mockRecipes`, `additionalMockRecipes`, `dessertMockRecipes`, `allSeasonalRecipes`
- Remove imports: `clearSpoonacularApiCache` from `unifiedRecipeService`
- Remove `getMockRecipes()` method entirely
- Remove rate-limiting logic (was for Spoonacular)
- On failure/offline: return empty array (let caller handle) instead of mock fallback
- Remove `clearSpoonacularApiCache()` call from cache clearing

### 4. `rankRecipes.ts` / `featureEngineering.ts` - Remove source bias
- Remove `sourceBias` from `RankingWeights`, `FeatureVector`, `FeatureContext`
- Remove `spoonacularBias` from `FeatureContext`
- Redistribute weight from `sourceBias` (0.05) to other features
- Updated default weights (redistribute 0.05 evenly):
  - sim: 0.30 -> 0.32
  - pantry: 0.20 -> 0.21
  - popularity: 0.08 -> 0.09
  - novelty: 0.10 -> 0.10
  - expiryUrgency: 0.12 -> 0.13
  - feedback: 0.15 -> 0.15
- Similarly update `PANTRY_ONLY_WEIGHTS`

### 5. Files to DELETE (no longer needed)
- `src/services/unifiedRecipeService.ts` - Spoonacular-only service
- `src/config/spoonacular.ts` - Spoonacular config
- `src/utils/spoonacularApi.ts` - Spoonacular utility
- `src/utils/recipeApiService.ts` - Spoonacular-based recipe fetcher
- `src/data/mockRecipes.ts` - Hardcoded mock recipes
- `src/data/recipeDatabase.ts` - Aggregator of mock data
- `src/data/seasonalRecipes.ts` - Hardcoded seasonal recipes
- `src/data/additionalRecipes.ts` - Additional hardcoded recipes
- `src/tests/spoonacularApiService.test.ts` - Spoonacular tests
- `src/tests/testSpoonacular.ts` - Spoonacular test utility
- `src/tests/mealPlanTest.ts` - Uses mock data extensively

### 6. Files to UPDATE (remove Spoonacular/mock references)
- `src/screens/LoadingMealPlanScreen.tsx` - Remove `apiRecipeService` import and fallback fetch
- `src/screens/MealPlanScreen.tsx` - Remove `apiRecipeService` import and cache clearing
- `src/utils/recipeSwapper.ts` - Remove `apiRecipeService` usage, use recommendation pipeline
- `src/screens/DebugScreen.tsx` - Remove any Spoonacular debug references
- `src/config/environment.ts` - Remove Spoonacular env vars
- `src/utils/envUtils.ts` - Remove Spoonacular env references
- `src/utils/mealPlanSelector.ts` - Remove `recipeDatabase` import, adapt to work without it
- `src/services/cachingService.ts` - Remove Spoonacular cache references if any
- `src/types/Recommendation.ts` - Remove Spoonacular source references
- `src/shared/interfaces.ts` - Change `source` type from `'tasty' | 'spoonacular'` to `'tasty'`

### 7. `src/mappers/recipeMappers.ts` - Remove Spoonacular mapper
- Remove `mapSpoonacularRecipeToUnified()` function
- Keep `mapTastyRecipeToUnified()`

## Implementation Order

1. Core pipeline changes (candidateGenerationService, recommendationMealPlanService)
2. Ranking changes (featureEngineering, rankRecipes)
3. Remove apiRecipeService mock fallback
4. Update screens and utilities
5. Delete unused files
6. Update interfaces and types
7. Clean up imports and verify compilation

## Risks

- **Insufficient Tasty recipes**: If Firebase has few recipes, meal plans may be sparse. Mitigated by keeping the MIN_PER_TYPE enforcement.
- **Offline mode**: Without mock fallback, offline users get empty results. Acceptable tradeoff - the app requires connectivity for Firebase anyway.
- **recipeSwapper.ts**: Currently uses `apiRecipeService` which falls back to mocks. Needs to be updated to use the recommendation pipeline or Firebase directly.
- **mealPlanSelector.ts**: Uses `recipeDatabase` for recent recipe lookups. Needs adaptation.
