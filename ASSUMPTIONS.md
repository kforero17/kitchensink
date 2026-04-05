# Assumptions

1. **History cap increase is safe**: Bumping `MAX_HISTORY_ITEMS` from 100 to 365 won't cause AsyncStorage performance issues on mobile devices. 365 `RecipeHistoryItem` objects (~50 bytes each) = ~18KB.

2. **3-day leftover expiry default**: Cooked food leftovers are assumed safe for 3 days. This is a reasonable default per USDA guidelines. Users cannot customize this yet.

3. **Season boundaries are hemisphere-agnostic**: Using Northern Hemisphere seasons (Mar-May=spring, etc.). No Southern Hemisphere support initially.

4. **Temporal patterns need 4+ weeks**: Below 4 weeks of history, temporal and seasonal features return 0.5 (neutral) to avoid noisy predictions.

5. **Leftover logging is optional**: If user dismisses the leftover prompt, we assume all servings were eaten. No leftover entry created.

6. **Confidence threshold of 0.3**: Below this, "Today's Picks" won't show. This is a tuning parameter that may need adjustment based on real usage.

7. **Recipe tags reliably indicate meal type**: The existing tag system (`breakfast`, `lunch`, `dinner`, `snacks`) is sufficient for temporal pattern analysis.

8. **Dual-write pattern**: Leftovers follow the same AsyncStorage-first, Firestore-if-authenticated pattern used throughout the app.

9. **Snack normalization**: Both 'snack' and 'snacks' tags are normalized to 'snack' in temporal pattern analysis.

10. **Unrecognized meal types**: History items with non-standard meal types count toward day activity but not meal frequency, diluting the temporal fit ratio appropriately.

11. **Seasonal tag threshold**: `computeSeasonalFit` returns 0.5 (neutral) when fewer than 2 of the recipe's tags have seasonal data in the profile.

12. **Leftover complementarity heuristic**: Uses recipe name + ingredient name token overlap. Overlap >= 0.8 = redundant (penalty), 0.2-0.8 = complementary (boost), < 0.2 = unrelated.

13. **Prediction confidence**: Computed using the same weights as `DEFAULT_WEIGHTS` in rankRecipes (minus sourceBias), keeping confidence aligned with actual ranking.

14. **Recipe tag lookup from candidates**: The recommendation service builds the tag lookup from candidate recipes being ranked, not from full history.

15. **TodaysPicks per-session dismiss**: Dismiss state resets on app restart. Not persisted to AsyncStorage.

16. **MealType from first tag**: `recipe.tags[0]` is used as the meal type for leftover records, consistent with existing `getRecipesByType` filtering.

17. **MealPlan leftover prompt**: Shows for the first selected recipe only (v1). Could iterate all recipes in future.
