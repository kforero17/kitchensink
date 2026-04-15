/**
 * CookRecipeAction - Simulates cooking a recipe from the current meal plan.
 *
 * Picks the first uncooked recipe from the meal plan (skipping those already
 * cooked today), records a history item in Firestore, and returns the cooked
 * recipe in the action result.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult } from '../profiles/types';

export class CookRecipeAction implements ActionExecutor {
  readonly type = 'cook_recipe' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, firestore, uid, currentDate } = ctx;
      const mealPlan = currentState.currentMealPlan;
      const cookedIds = new Set(currentState.cookedToday);

      // Find uncooked recipes from the plan
      const uncookedRecipes = mealPlan.filter(r => !cookedIds.has(r.id));

      if (uncookedRecipes.length === 0) {
        return {
          type: this.type,
          success: false,
          error: 'No uncooked recipes in plan',
        };
      }

      // Pick from uncooked recipes. Use rng for tie-breaking when multiple exist.
      const pickIndex = Math.floor(ctx.rng() * uncookedRecipes.length);
      const recipe = uncookedRecipes[pickIndex];

      // Determine meal type from profile preferences or default to 'dinner'
      const mealTypes = ctx.profile.preferences.cooking.mealTypes;
      const mealType =
        mealTypes.length > 0
          ? mealTypes[Math.floor(ctx.rng() * mealTypes.length)]
          : 'dinner';

      // Record in history
      const dateStr = currentDate.toISOString().split('T')[0];
      await firestore.addHistoryItem(uid, {
        recipeId: recipe.id,
        usedDate: dateStr,
        mealType,
      });

      return {
        type: this.type,
        success: true,
        data: {
          recipeId: recipe.id,
          recipeTitle: recipe.title,
          mealType,
          date: dateStr,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `CookRecipeAction failed: ${err.message ?? err}`,
      };
    }
  }
}
