import { generateRecipeCandidates } from '../candidate-generation/candidateGenerationService';
import { rankRecipes } from '../ranking/rankRecipes';
import { unifiedToAppRecipe } from '../utils/unifiedToAppRecipe';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { PantryIngredientInfo } from '../ranking/featureEngineering';
import { getPantryItems } from './pantryService';
import { recipeFeedbackService } from './recipeFeedbackService';
import { buildFeedbackMap, buildSeenRecipeIds } from '../ranking/feedbackSignal';
import { logPantryModeUsed } from './analyticsService';
import auth from '@react-native-firebase/auth';
import logger from '../utils/logger';

const PANTRY_STOP_WORDS = new Set([
  'water','salt','pepper','teaspoon','tablespoon','tsp','tbsp','cup','cups','ounce','ounces','oz','lb','lbs','gram','grams','kg','lean','hash'
]);
const MAX_PANTRY_INCLUDE = 5;

export async function fetchRecommendedRecipes(
  prefs: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
    usePantryItems?: boolean;
    pantryOnlyMode?: boolean;
  }
): Promise<import('../contexts/MealPlanContext').Recipe[]> {
  try {
    let pantryTokensForInclude: string[] = [];
    let pantryTokensForRanking: string[] = [];
    let pantryItemsInfo: PantryIngredientInfo[] = [];
    if (prefs.usePantryItems) {
      const uid = auth().currentUser?.uid;
      if (uid) {
        try {
          const items = await getPantryItems(uid);
          pantryItemsInfo = items.map(i => ({
            name: i.name,
            expirationDate: i.expirationDate,
          }));

          const tokens = items
            .map(i => i.name.split(' ')[0].toLowerCase())
            .filter(tok => tok.length >= 3 && !PANTRY_STOP_WORDS.has(tok));

          const dedup: string[] = [];
          for (const tok of tokens) {
            if (!dedup.includes(tok)) dedup.push(tok);
          }

          if (prefs.pantryOnlyMode) {
            pantryTokensForInclude = dedup;
            pantryTokensForRanking = dedup;
          } else {
            pantryTokensForInclude = dedup.slice(0, MAX_PANTRY_INCLUDE);
            pantryTokensForRanking = dedup.slice(0, 5);
          }
        } catch (err) { logger.warn('Cannot fetch pantry items', err); }
      }
    }

    // Fetch user feedback history for personalised ranking
    let feedbackMap: Map<string, { score: number; decayedScore: number }> | undefined;
    let seenRecipeIds: Set<string> | undefined;
    try {
      const history = await recipeFeedbackService.getUserFeedbackHistory(100);
      if (history.length > 0) {
        feedbackMap = buildFeedbackMap(history);
        seenRecipeIds = buildSeenRecipeIds(history);
      }
    } catch (err) {
      // Feedback is non-critical — continue without it
    }

    const candidates = await generateRecipeCandidates({
      userEmbedding: [],
      diet: buildDietParam(prefs.dietary),
      intolerances: buildIntoleranceParam(prefs.dietary),
      cuisine: prefs.food.preferredCuisines?.join(',') || undefined,
      pantryTopK: pantryTokensForInclude,
      maxReadyTime: deriveMaxReadyTime(prefs.cooking),
    });

    const scored = rankRecipes(candidates, {
      userTokens: buildUserTokens(prefs),
      pantryIngredients: pantryTokensForRanking,
      pantryItems: pantryItemsInfo,
      pantryOnlyMode: prefs.pantryOnlyMode,
      feedbackMap,
      seenRecipeIds,
    });

    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);
    const expiringCount = pantryItemsInfo.filter(item => {
      if (!item.expirationDate) return false;
      const exp = new Date(item.expirationDate);
      return exp <= threeDaysFromNow;
    }).length;
    logPantryModeUsed({
      pantryOnlyMode: !!prefs.pantryOnlyMode,
      pantryItemCount: pantryItemsInfo.length,
      expiringCount,
    });

    logger.info(`[RANK] scored=${scored.length} recipes (Tasty-only)`);

    // Use all scored recipes directly (single source, no split needed)
    const finalScored: typeof scored = [...scored];

    // ------------------------------------------------------------------
    // Ensure we have at least 4 recipes per primary meal type so the UI
    //   tab view always gives users enough choice.
    // ------------------------------------------------------------------
    const MIN_PER_TYPE = 4;

    const byType = (type: string, arr: typeof scored) => arr.filter(s => s.recipe.tags.includes(type));

    const addExtras = (type: string) => {
      const current = byType(type, finalScored);
      if (current.length >= MIN_PER_TYPE) return;
      const needed = MIN_PER_TYPE - current.length;
      const pool = scored.filter(s => !finalScored.includes(s) && s.recipe.tags.includes(type));
      finalScored.push(...pool.slice(0, needed));
    };

    ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(addExtras);

    // Finally convert to app recipes
    const recipes = finalScored.map(s => unifiedToAppRecipe(s.recipe));
    logger.debug(`Recommendation service returned ${recipes.length} recipes`);
    return recipes;
  } catch (err) {
    logger.error('Recommendation service error', err);
    return [];
  }
}

function buildDietParam(d: DietaryPreferences): string | undefined {
  const diets: string[] = [];
  if (d.vegan) diets.push('vegan');
  if (d.vegetarian) diets.push('vegetarian');
  if (d.lowCarb) diets.push('low carb');
  return diets.length ? diets.join(',') : undefined;
}
function buildIntoleranceParam(d: DietaryPreferences): string | undefined {
  const ints: string[] = [];
  if (d.glutenFree) ints.push('gluten');
  if (d.dairyFree) ints.push('dairy');
  if (d.allergies) ints.push(...d.allergies);
  return ints.length ? ints.join(',') : undefined;
}
function deriveMaxReadyTime(c: CookingPreferences): number | undefined {
  switch (c.preferredCookingDuration) {
    case 'under_30_min': return 30;
    case '30_to_60_min': return 60;
    default: return undefined;
  }
}
function buildUserTokens(prefs: any): string[] {
  return [
    ...prefs.food.favoriteIngredients || [],
    ...prefs.food.dislikedIngredients || [],
    ...(prefs.food.preferredCuisines || []),
  ].flatMap(t => t.split(' '));
} 