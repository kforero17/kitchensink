# Assumptions

1. **Cost estimation uses category averages** — No per-item pricing exists. We'll use hardcoded category-based estimates (produce ~$3, dairy ~$4, meat ~$8, pantry staples ~$2, etc.). Good enough for directional insights.

Good for now but we should incorporate accurate gorcery store pricing into the app somehow.

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
