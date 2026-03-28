# Pantry-Aware Recommendations — Implementation Spec

## Problem Statement
Meal plans don't prioritize ingredients the user already has, especially those about to expire. Users waste food because the app doesn't actively suggest recipes that use up expiring pantry items. We need a "Use What You Have" mode that filters and ranks recipes to minimize waste.

## Current State
- `featureEngineering.ts` computes `expiryUrgency` feature (1.0 at ≤3 days, linear decay to 0 at 7 days)
- `rankRecipes.ts` has `expiryUrgency` weight at 0.15
- `recommendationMealPlanService.ts` passes `pantryIngredients` (name strings only) to ranking but does NOT pass `pantryItems` with expiration dates — so expiryUrgency always computes to 0
- No "pantry-only" candidate filtering exists
- `usePantryItems` preference exists (defaults to true) but only controls whether pantry names are passed to ranking

## Approach

### Change 1: Wire pantry expiration data into ranking
**File:** `src/services/recommendationMealPlanService.ts`
- When loading pantry items, build `PantryIngredientInfo[]` with both `name` and `expirationDate`
- Pass this as `pantryItems` in the `RankRecipesOptions` alongside existing `pantryIngredients`
- This activates the already-implemented expiryUrgency computation in featureEngineering.ts

### Change 2: Add "Use What You Have" mode with pantry-only filtering
**File:** `src/ranking/rankRecipes.ts`
- Add `pantryOnlyMode?: boolean` to `RankRecipesOptions`
- Add `pantryMatchThreshold?: number` (default 0.6 = 60% of recipe ingredients must be in pantry)
- When `pantryOnlyMode` is true:
  - Pre-filter recipes: only keep those where `pantry` feature >= threshold
  - Use boosted weights: `{ sim: 0.20, pantry: 0.30, popularity: 0.05, novelty: 0.05, sourceBias: 0.05, expiryUrgency: 0.35 }`
  - This dramatically prioritizes using what's expiring

### Change 3: Add preference for pantry-only mode
**File:** `src/utils/preferences.ts`
- Add `PANTRY_ONLY_MODE` storage key
- Add `getPantryOnlyMode(): Promise<boolean>` and `savePantryOnlyMode(value: boolean): Promise<void>`

### Change 4: Add UI toggle for "Use What You Have" mode
**File:** `src/screens/CookingHabitsScreen.tsx`
- Add a toggle switch labeled "Use What You Have" with subtitle "Prioritize recipes using your pantry items, especially expiring ones"
- Wire to `savePantryOnlyMode()` / `getPantryOnlyMode()`
- This is the natural place since it's part of the meal plan generation preferences flow

### Change 5: Pass mode through meal plan generation flow
**File:** `src/screens/LoadingMealPlanScreen.tsx`
- Load `pantryOnlyMode` preference alongside other preferences
- Pass it through to `fetchRecommendedRecipes()`

**File:** `src/services/recommendationMealPlanService.ts`
- Accept `pantryOnlyMode` parameter
- Pass it to `rankRecipes()` options
- When in pantry-only mode, increase `pantryTopK` from 5 to all pantry ingredients (remove the limit)

### Change 6: Analytics event
**File:** `src/services/analyticsService.ts`
- Add `logPantryModeUsed(params: { pantryOnlyMode: boolean; pantryItemCount: number; expiringCount: number })` event

## Files to Modify (in order)
1. `src/utils/preferences.ts` — add pantry-only mode preference
2. `src/ranking/rankRecipes.ts` — add pantryOnlyMode option, boosted weights, pre-filter
3. `src/services/recommendationMealPlanService.ts` — wire pantry expiration data + pantry-only mode
4. `src/screens/CookingHabitsScreen.tsx` — add "Use What You Have" toggle
5. `src/screens/LoadingMealPlanScreen.tsx` — load and pass pantryOnlyMode
6. `src/services/analyticsService.ts` — add pantry mode analytics event

## No New Files
All changes are additions to existing files.

## Risks
- If user has very few pantry items, pantry-only mode might return too few recipes — mitigate with fallback to normal mode if <3 recipes match
- Expiration date data is optional — expiryUrgency gracefully handles missing dates (returns 0)
