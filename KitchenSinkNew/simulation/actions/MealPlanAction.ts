/**
 * MealPlanAction - Generates a weekly meal plan using the ranking pipeline.
 *
 * Steps:
 * 1. Load all recipes, history, and feedback from Firestore
 * 2. Build FeatureContext with user preferences, pantry, temporal/seasonal profiles
 * 3. Call rankRecipes() to get scored recipes
 * 4. Apply dietary filtering as a safety net
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
  UnifiedRecipe,
  DietaryPreferences,
} from '../bridge/appImports';
import type {
  FeatureContext,
  PantryIngredientInfo,
  RankRecipesOptions,
} from '../bridge/appImports';

// ---------------------------------------------------------------------------
// Dietary filter helpers
// ---------------------------------------------------------------------------

/** Boolean dietary keys and the recipe tags that satisfy each constraint. */
const DIETARY_TAG_MAP: Array<{
  key: keyof Pick<DietaryPreferences, 'vegan' | 'vegetarian' | 'glutenFree' | 'dairyFree' | 'nutFree' | 'lowCarb'>;
  tags: string[];
}> = [
  { key: 'vegan', tags: ['vegan'] },
  { key: 'vegetarian', tags: ['vegetarian'] },
  { key: 'glutenFree', tags: ['gluten-free', 'gluten free'] },
  { key: 'dairyFree', tags: ['dairy-free', 'dairy free'] },
  { key: 'nutFree', tags: ['nut-free', 'nut free'] },
  { key: 'lowCarb', tags: ['low-carb', 'low carb', 'keto'] },
];

/**
 * Returns true if the recipe satisfies all active dietary constraints.
 * A constraint is active when the corresponding boolean on `DietaryPreferences`
 * is true. The recipe must carry at least one of the matching tags.
 */
function passesDietaryFilter(
  recipe: UnifiedRecipe,
  dietary: DietaryPreferences,
): boolean {
  const lowerTags = recipe.tags.map(t => t.toLowerCase());

  for (const { key, tags: requiredTags } of DIETARY_TAG_MAP) {
    if (dietary[key]) {
      const hasTag = requiredTags.some(rt => lowerTags.includes(rt));
      if (!hasTag) return false;
    }
  }
  return true;
}

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

      const scored = rankRecipes(allRecipes, featureContext);

      // 4. Apply dietary filtering as safety net
      const dietary = prefs.dietary;
      const filtered = scored.filter(s =>
        passesDietaryFilter(s.recipe, dietary),
      );

      // Fall back to unfiltered if dietary filter is too aggressive
      const candidates = filtered.length >= 3 ? filtered : scored;

      // 5. Select top N based on weeklyMealPrepCount
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
          dietaryFiltered: filtered.length !== scored.length,
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
