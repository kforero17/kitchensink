# Assumptions

## Weekly Insights Dashboard

1. **Cost estimation uses category averages** — No per-item pricing exists. We'll use hardcoded category-based estimates (produce ~$3, dairy ~$4, meat ~$8, pantry staples ~$2, etc.). Good enough for directional insights.

Good for now but we should incorporate accurate grocery store pricing into the app somehow.

2. **"Waste avoided" = items removed before expiration** — We infer an item was "used" if it was deleted from pantry while status was not 'expired'. Items that reached 'expired' status count as waste.

3. **Pantry deletion history not tracked** — Firestore only stores current pantry items. To track waste avoided over time, we need to start logging pantry removals. For v1, we can only show current-week data based on items that are currently expired vs not.

4. **Nutrition data is optional** — Not all recipes have the `nutrition` field populated. The nutrition card should gracefully handle missing data with an empty state.

5. **8-week lookback is sufficient** — Charts show last 8 weeks of data. Older data is not displayed.

6. **react-native-chart-kit is adequate for v1** — Lightweight and simple. Can migrate to victory-native if more complex visualizations are needed later.

7. **Share format is plain text** — No image generation for v1. Just a formatted text summary.

8. **Logger uses default export** — `import logger from '../utils/logger'` matching existing service patterns.

9. **Recipe history key is 'recipe_history'** (no `@` prefix) — matches the raw string in `recipeHistory.ts`, not `STORAGE_KEYS.RECIPE_HISTORY`.

10. **Current meal plan used for nutrition lookup** — Reads `current_meal_plan` from AsyncStorage for recipe nutrition data, falls back to Firestore for missing recipes.

11. **Default insights populate 8 weeks of zero data** — Prevents chart crashes when no data is available, showing a flat chart instead of an empty state.

## Predictive Meal Planning

12. **History cap increase is safe**: Bumping `MAX_HISTORY_ITEMS` from 100 to 365 won't cause AsyncStorage performance issues on mobile devices. 365 `RecipeHistoryItem` objects (~50 bytes each) = ~18KB.

13. **3-day leftover expiry default**: Cooked food leftovers are assumed safe for 3 days. This is a reasonable default per USDA guidelines. Users cannot customize this yet.

14. **Season boundaries are hemisphere-agnostic**: Using Northern Hemisphere seasons (Mar-May=spring, etc.). No Southern Hemisphere support initially.

15. **Temporal patterns need 4+ weeks**: Below 4 weeks of history, temporal and seasonal features return 0.5 (neutral) to avoid noisy predictions.

16. **Leftover logging is optional**: If user dismisses the leftover prompt, we assume all servings were eaten. No leftover entry created.

17. **Confidence threshold of 0.3**: Below this, "Today's Picks" won't show. This is a tuning parameter that may need adjustment based on real usage.

18. **Recipe tags reliably indicate meal type**: The existing tag system (`breakfast`, `lunch`, `dinner`, `snacks`) is sufficient for temporal pattern analysis.

19. **Dual-write pattern**: Leftovers follow the same AsyncStorage-first, Firestore-if-authenticated pattern used throughout the app.

20. **Snack normalization**: Both 'snack' and 'snacks' tags are normalized to 'snack' in temporal pattern analysis.

21. **Unrecognized meal types**: History items with non-standard meal types count toward day activity but not meal frequency, diluting the temporal fit ratio appropriately.

22. **Seasonal tag threshold**: `computeSeasonalFit` returns 0.5 (neutral) when fewer than 2 of the recipe's tags have seasonal data in the profile.

23. **Leftover complementarity heuristic**: Uses recipe name + ingredient name token overlap. Overlap >= 0.8 = redundant (penalty), 0.2-0.8 = complementary (boost), < 0.2 = unrelated.

24. **Prediction confidence**: Computed using the same weights as `DEFAULT_WEIGHTS` in rankRecipes (minus sourceBias), keeping confidence aligned with actual ranking.

25. **Recipe tag lookup from candidates**: The recommendation service builds the tag lookup from candidate recipes being ranked, not from full history.

26. **TodaysPicks per-session dismiss**: Dismiss state resets on app restart. Not persisted to AsyncStorage.

27. **MealType from first tag**: `recipe.tags[0]` is used as the meal type for leftover records, consistent with existing `getRecipesByType` filtering.

28. **MealPlan leftover prompt**: Shows for the first selected recipe only (v1). Could iterate all recipes in the future.
