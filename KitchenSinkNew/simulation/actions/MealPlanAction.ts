/**
 * MealPlanAction - Generates a weekly meal plan using the ranking pipeline.
 *
 * Steps:
 * 1. Load all recipes, history, and feedback from Firestore
 * 2. Build FeatureContext with user preferences, pantry, temporal/seasonal profiles
 * 3. Filter recipes by dietary preferences (strict, no fallback)
 * 4. Call rankRecipes() on the compliant pool
 * 5. Select top N recipes based on weeklyMealPrepCount
 * 6. Reset previous meal plan flags and save new plan
 * 7. Return plan in ActionResult.data
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
  FeatureContext,
  PantryIngredientInfo,
  RankRecipesOptions,
} from '../bridge/appImports';
import { filterByDiet } from '../../src/utils/dietaryFilter';

// ---------------------------------------------------------------------------
// MealPlanAction
// ---------------------------------------------------------------------------

export class MealPlanAction implements ActionExecutor {
  readonly type = 'generate_meal_plan' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { profile, uid, currentDate, firestore, currentState } = ctx;
      const prefs = profile.preferences;

      // 1. Load all recipes
      const allRecipes = await firestore.getAllRecipes();
      if (allRecipes.length === 0) {
        return {
          type: this.type,
          success: false,
          error: 'No recipes available in database',
        };
      }

      // 2. Build context components
      const history = currentState.recipeHistory;
      const feedback = currentState.feedbackHistory;
      const pantryItems = currentState.pantryItems;
      const leftovers = currentState.leftovers;

      // User tokens: favorite ingredients + preferred cuisines + dietary keywords
      const userTokens: string[] = [
        ...prefs.food.favoriteIngredients.map(i => normalizeIngredientName(i)),
        ...prefs.food.preferredCuisines,
      ];

      // Pantry ingredient names and info
      const pantryIngredients = pantryItems.map(p =>
        normalizeIngredientName(p.name),
      );
      const pantryIngredientInfo: PantryIngredientInfo[] = pantryItems.map(
        p => ({
          name: normalizeIngredientName(p.name),
          expirationDate: p.expirationDate,
        }),
      );

      // Temporal and seasonal profiles
      const temporalProfile = buildTemporalProfile(history);
      const recipeTagLookup = new Map<string, string[]>();
      for (const recipe of allRecipes) {
        recipeTagLookup.set(recipe.id, recipe.tags);
      }
      const seasonalProfile = buildSeasonalProfile(history, recipeTagLookup);
      const currentSeason = getSeason(currentDate);
      const targetDay = currentDate.getDay();

      // Feedback signals
      const feedbackMap = buildFeedbackMap(feedback, currentDate);
      const seenRecipeIds = buildSeenRecipeIds(feedback);

      // Active leftovers
      const activeLeftovers = leftovers.filter(l => l.status === 'available');

      // 3. Rank recipes
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

      const dietary = prefs.dietary;
      const compliant = filterByDiet(allRecipes, dietary);
      const scored = rankRecipes(compliant, featureContext);
      const candidates = scored;

      const planSize = prefs.cooking.weeklyMealPrepCount || 5;
      const selectedRecipes = candidates
        .slice(0, planSize)
        .map(s => s.recipe);

      // 6. Reset previous flags and save new plan
      await firestore.resetWeeklyMealPlanFlags(uid);

      for (const recipe of selectedRecipes) {
        await firestore.saveRecipe(uid, {
          ...recipe,
          isWeeklyMealPlan: true,
          generatedAt: currentDate.toISOString(),
        });
      }

      return {
        type: this.type,
        success: true,
        data: {
          planSize: selectedRecipes.length,
          recipeIds: selectedRecipes.map(r => r.id),
          recipeTitles: selectedRecipes.map(r => r.title),
          season: currentSeason,
          dietaryFiltered: compliant.length !== allRecipes.length,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `MealPlanAction failed: ${err.message ?? err}`,
      };
    }
  }
}
