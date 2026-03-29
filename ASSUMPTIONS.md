# Assumptions

- Firebase Firestore has sufficient Tasty recipes to fill meal plans without Spoonacular supplementation
- The app requires network connectivity anyway (for Firebase), so removing offline mock fallback is acceptable
- `recipeSwapper.ts` swap candidates come from `fetchRecommendedRecipes` (recommendation pipeline handles auth internally)
- `mealPlanSelector.ts` exploration bonuses degrade gracefully to 0 without `recipeDatabase` — acceptable since these are small randomized contributions
- Removing the extra breakfast backfill in LoadingMealPlanScreen is acceptable — the recommendation pipeline should return breakfast-tagged recipes when breakfast is requested
- Renaming Firestore cache collection from `spoonacularCandidateCache` to `recipeCandidateCache` orphans old cached data — acceptable since it's a 48-hour TTL cache
- `PANTRY_ONLY_WEIGHTS` redistribution: allocated sourceBias 0.05 to pantry-dominant features (sim +0.01, pantry +0.02, expiryUrgency +0.02)
- No cache-busting needed for recipe swaps — `fetchRecommendedRecipes` handles freshness through the pipeline
