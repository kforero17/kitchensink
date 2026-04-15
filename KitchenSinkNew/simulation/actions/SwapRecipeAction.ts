/**
 * SwapRecipeAction - Swaps one recipe in the current meal plan for a better fit.
 *
 * Picks a random recipe from the plan, re-ranks all recipes excluding the
 * current plan, and replaces the picked recipe with the top-scoring alternative.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult } from '../profiles/types';
import {
  rankRecipes,
  buildTemporalProfile,
  buildSeasonalProfile,
  buildFeedbackMap,
  buildSeenRecipeIds,
  getSeason,
  normalizeIngredientName,
} from '../bridge/appImports';
import type {
  PantryIngredientInfo,
  RankRecipesOptions,
} from '../bridge/appImports';

export class SwapRecipeAction implements ActionExecutor {
  readonly type = 'swap_recipe' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, firestore, uid, currentDate, profile } = ctx;
      const rng = ctx.rng;
      const mealPlan = currentState.currentMealPlan;

      if (mealPlan.length < 2) {
        return {
          type: this.type,
          success: false,
          error: 'Meal plan too small to swap (need at least 2 recipes)',
        };
      }

      // 1. Pick a random recipe index to swap out
      const swapIndex = Math.floor(rng() * mealPlan.length);
      const oldRecipe = mealPlan[swapIndex];

      // 2. Load all recipes and exclude current plan
      const allRecipes = await firestore.getAllRecipes();
      const planIds = new Set(mealPlan.map(r => r.id));
      const candidates = allRecipes.filter(r => !planIds.has(r.id));

      if (candidates.length === 0) {
        return {
          type: this.type,
          success: false,
          error: 'No candidate recipes available for swap',
        };
      }

      // 3. Build ranking context
      const prefs = profile.preferences;
      const history = currentState.recipeHistory;
      const feedback = currentState.feedbackHistory;
      const pantryItems = currentState.pantryItems;
      const leftovers = currentState.leftovers;

      const userTokens: string[] = [
        ...prefs.food.favoriteIngredients.map(i => normalizeIngredientName(i)),
        ...prefs.food.preferredCuisines,
      ];

      const pantryIngredients = pantryItems.map(p =>
        normalizeIngredientName(p.name),
      );
      const pantryIngredientInfo: PantryIngredientInfo[] = pantryItems.map(
        p => ({
          name: normalizeIngredientName(p.name),
          expirationDate: p.expirationDate,
        }),
      );

      const temporalProfile = buildTemporalProfile(history);
      const recipeTagLookup = new Map<string, string[]>();
      for (const recipe of allRecipes) {
        recipeTagLookup.set(recipe.id, recipe.tags);
      }
      const seasonalProfile = buildSeasonalProfile(history, recipeTagLookup);
      const currentSeason = getSeason(currentDate);
      const targetDay = currentDate.getDay();

      const feedbackMap = buildFeedbackMap(feedback, currentDate);
      const seenRecipeIds = buildSeenRecipeIds(feedback);
      const activeLeftovers = leftovers.filter(l => l.status === 'available');

      const featureContext: RankRecipesOptions = {
        userTokens,
        pantryIngredients,
        pantryItems: pantryIngredientInfo,
        seenRecipeIds,
        feedbackMap,
        targetDay,
        temporalProfile,
        seasonalProfile,
        currentSeason,
        activeLeftovers,
      };

      // 4. Rank candidates and pick the best replacement
      const scored = rankRecipes(candidates, featureContext);
      const newRecipe = scored[0].recipe;

      // 5. Persist the swap: save replacement with isWeeklyMealPlan flag
      await firestore.saveRecipe(uid, {
        ...newRecipe,
        isWeeklyMealPlan: true,
        generatedAt: currentDate.toISOString(),
      });

      return {
        type: this.type,
        success: true,
        data: {
          removedRecipeId: oldRecipe.id,
          removedRecipeTitle: oldRecipe.title,
          addedRecipeId: newRecipe.id,
          addedRecipeTitle: newRecipe.title,
          swapIndex,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `SwapRecipeAction failed: ${err.message ?? err}`,
      };
    }
  }
}
