/**
 * InsightsAction - Read-only action that computes weekly stats.
 *
 * Calculates metrics like recipes cooked in the last 7 days, pantry
 * utilization, unique recipe count, and cuisine variety. Does not
 * write to Firestore.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult } from '../profiles/types';

export class InsightsAction implements ActionExecutor {
  readonly type = 'check_insights' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, currentDate } = ctx;
      const history = currentState.recipeHistory;
      const mealPlan = currentState.currentMealPlan;
      const pantryItems = currentState.pantryItems;

      // Count recipes cooked in last 7 days
      const sevenDaysAgo = new Date(currentDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const recentHistory = history.filter(h => h.usedDate >= sevenDaysAgoStr);
      const recipesThisWeek = recentHistory.length;

      // Unique recipes in the recent window
      const uniqueRecipeIds = new Set(recentHistory.map(h => h.recipeId));
      const uniqueRecipes = uniqueRecipeIds.size;

      // Pantry utilization: ratio of pantry ingredients that appear in the meal plan
      let pantryUtilization = 0;
      if (pantryItems.length > 0 && mealPlan.length > 0) {
        const planIngredientNames = new Set(
          mealPlan.flatMap(r =>
            r.ingredients.map(i => i.name.toLowerCase().trim()),
          ),
        );
        const matchedPantryItems = pantryItems.filter(p =>
          planIngredientNames.has(p.name.toLowerCase().trim()),
        );
        pantryUtilization = matchedPantryItems.length / pantryItems.length;
      }

      // Cuisine variety: count distinct cuisine-related tags from recent recipes
      const cuisineTags = new Set<string>();
      for (const entry of recentHistory) {
        const recipe = mealPlan.find(r => r.id === entry.recipeId);
        if (recipe) {
          for (const tag of recipe.tags) {
            cuisineTags.add(tag.toLowerCase());
          }
        }
      }
      const cuisineVariety = cuisineTags.size;

      return {
        type: this.type,
        success: true,
        data: {
          recipesThisWeek,
          uniqueRecipes,
          pantryUtilization: Math.round(pantryUtilization * 100) / 100,
          cuisineVariety,
          pantryItemCount: pantryItems.length,
          mealPlanSize: mealPlan.length,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `InsightsAction failed: ${err.message ?? err}`,
      };
    }
  }
}
