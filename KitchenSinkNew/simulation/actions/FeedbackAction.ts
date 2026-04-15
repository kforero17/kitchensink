/**
 * FeedbackAction - Simulates giving feedback on a cooked recipe.
 *
 * Determines whether the recipe aligns with the user's dietary preferences
 * and disliked ingredients, then generates probabilistic feedback (like/dislike,
 * rating) using the seeded RNG.
 */

import { ActionExecutor, ActionContext } from './ActionExecutor';
import { ActionResult, RecipeFeedback } from '../profiles/types';
import { normalizeIngredientName, UnifiedRecipe } from '../bridge/appImports';

type Alignment = 'aligned' | 'misaligned' | 'neutral';

/**
 * Determines how well a recipe aligns with the user profile.
 *
 * - "aligned": recipe satisfies dietary constraints and contains no disliked ingredients
 * - "misaligned": recipe contains a disliked ingredient
 * - "neutral": neither clearly aligned nor misaligned
 */
function classifyAlignment(
  recipe: UnifiedRecipe,
  dislikedIngredients: string[],
  dietaryTags: string[],
): Alignment {
  const normalizedDisliked = dislikedIngredients.map(d =>
    normalizeIngredientName(d),
  );
  const recipeIngNames = recipe.ingredients.map(i =>
    normalizeIngredientName(i.name),
  );

  // Check for disliked ingredients
  const hasDisliked = recipeIngNames.some(name =>
    normalizedDisliked.some(
      disliked =>
        name.includes(disliked) || disliked.includes(name),
    ),
  );
  if (hasDisliked) return 'misaligned';

  // Check dietary alignment via tags
  const lowerTags = recipe.tags.map(t => t.toLowerCase());
  const hasDietaryMatch = dietaryTags.length === 0 ||
    dietaryTags.some(dt => lowerTags.includes(dt));
  if (hasDietaryMatch) return 'aligned';

  return 'neutral';
}

/**
 * Builds the set of dietary tags the user cares about, used for
 * alignment classification.
 */
function buildDietaryTags(dietary: {
  vegan: boolean;
  vegetarian: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
  lowCarb: boolean;
}): string[] {
  const tags: string[] = [];
  if (dietary.vegan) tags.push('vegan');
  if (dietary.vegetarian) tags.push('vegetarian');
  if (dietary.glutenFree) tags.push('gluten-free', 'gluten free');
  if (dietary.dairyFree) tags.push('dairy-free', 'dairy free');
  if (dietary.nutFree) tags.push('nut-free', 'nut free');
  if (dietary.lowCarb) tags.push('low-carb', 'low carb', 'keto');
  return tags;
}

export class FeedbackAction implements ActionExecutor {
  readonly type = 'give_feedback' as const;

  async execute(ctx: ActionContext): Promise<ActionResult> {
    try {
      const { currentState, firestore, uid, currentDate, profile } = ctx;
      const rng = ctx.rng;

      // Get the most recently cooked recipe (last element of cookedToday)
      const cookedToday = currentState.cookedToday;
      if (cookedToday.length === 0) {
        return {
          type: this.type,
          success: false,
          error: 'No recipes cooked today to provide feedback on',
        };
      }

      const recipeId = cookedToday[cookedToday.length - 1];

      // Find the recipe details from the meal plan or by loading from Firestore
      let recipe = currentState.currentMealPlan.find(r => r.id === recipeId);
      if (!recipe) {
        recipe = (await firestore.getRecipeById(recipeId)) ?? undefined;
      }
      if (!recipe) {
        return {
          type: this.type,
          success: false,
          error: `Recipe ${recipeId} not found`,
        };
      }

      // Classify alignment
      const dietary = profile.preferences.dietary;
      const dislikedIngredients = profile.preferences.food.dislikedIngredients;
      const dietaryTags = buildDietaryTags(dietary);
      const alignment = classifyAlignment(recipe, dislikedIngredients, dietaryTags);

      // Generate feedback based on alignment
      let isLiked = false;
      let isDisliked = false;
      let rating: number;

      switch (alignment) {
        case 'aligned':
          isLiked = rng() < 0.8;
          isDisliked = !isLiked && rng() < 0.1;
          rating = 3 + Math.floor(rng() * 3); // 3, 4, or 5
          break;
        case 'misaligned':
          isDisliked = rng() < 0.7;
          isLiked = !isDisliked && rng() < 0.1;
          rating = 1 + Math.floor(rng() * 2); // 1 or 2
          break;
        case 'neutral':
        default:
          rating = 2 + Math.floor(rng() * 3); // 2, 3, or 4
          isLiked = rating >= 4 && rng() < 0.5;
          isDisliked = rating <= 2 && rng() < 0.3;
          break;
      }

      // Determine meal type
      const mealTypes = profile.preferences.cooking.mealTypes;
      const mealType =
        mealTypes.length > 0
          ? mealTypes[Math.floor(rng() * mealTypes.length)]
          : 'dinner';

      const feedback: RecipeFeedback = {
        recipeId,
        userId: uid,
        isCooked: true,
        isLiked,
        isDisliked,
        rating,
        feedbackDate: currentDate,
        mealType,
      };

      await firestore.saveFeedback(recipeId, uid, feedback);

      return {
        type: this.type,
        success: true,
        data: {
          recipeId,
          recipeTitle: recipe.title,
          alignment,
          isLiked,
          isDisliked,
          rating,
          mealType,
        },
      };
    } catch (err: any) {
      return {
        type: this.type,
        success: false,
        error: `FeedbackAction failed: ${err.message ?? err}`,
      };
    }
  }
}
