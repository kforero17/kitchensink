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
import { buildTemporalProfile } from '../ranking/temporalPatterns';
import { getSeason, buildSeasonalProfile } from '../ranking/seasonalSignal';
import { getActiveLeftovers } from './leftoverService';
import { getRecipeHistory } from '../utils/recipeHistory';
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

    // Build predictive context (temporal, seasonal, leftover signals)
    let temporalProfile: ReturnType<typeof buildTemporalProfile> | undefined;
    let seasonalProfile: ReturnType<typeof buildSeasonalProfile> | undefined;
    let targetDay: number | undefined;
    let currentSeason: ReturnType<typeof getSeason> | undefined;
    let activeLeftovers: Awaited<ReturnType<typeof getActiveLeftovers>> | undefined;

    try {
      const recipeHist = await getRecipeHistory();
      temporalProfile = buildTemporalProfile(recipeHist);
      targetDay = new Date().getDay();
      currentSeason = getSeason(new Date());

      // Build recipe tag lookup from candidate recipes for the seasonal profile
      const recipeTagLookup = new Map<string, string[]>();
      for (const recipe of candidates) {
        recipeTagLookup.set(recipe.id, recipe.tags || []);
      }
      seasonalProfile = buildSeasonalProfile(recipeHist, recipeTagLookup);
    } catch (err) {
      logger.warn('Cannot build temporal/seasonal context', err);
    }

    try {
      activeLeftovers = await getActiveLeftovers();
    } catch (err) {
      logger.warn('Cannot fetch active leftovers', err);
    }

    const scored = rankRecipes(candidates, {
      userTokens: buildUserTokens(prefs),
      pantryIngredients: pantryTokensForRanking,
      pantryItems: pantryItemsInfo,
      spoonacularBias: -1,
      pantryOnlyMode: prefs.pantryOnlyMode,
      weights: prefs.pantryOnlyMode ? undefined : { sourceBias: 0.15 },
      feedbackMap,
      seenRecipeIds,
      targetDay,
      temporalProfile,
      seasonalProfile,
      currentSeason,
      activeLeftovers,
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

    const tastyScored = scored.filter(s => s.recipe.source === 'tasty');
    const spoonScored = scored.filter(s => s.recipe.source === 'spoonacular');

    logger.info(`[RANK] tastyScored=${tastyScored.length} spoonScored=${spoonScored.length}`);
    // ---- Enforce ~50/50 source mix (or favour Tasty) ----
    const desiredTotal = scored.length;
    const half = Math.floor(desiredTotal / 2);

    // Take up to half from Tasty, refill remainder with Spoonacular.
    const finalScored: typeof scored = [];

    finalScored.push(...tastyScored.slice(0, half));

    // If we don't have enough Tasty to fill half, leave gap to be filled by spoon
    const neededFromSpoon = desiredTotal - finalScored.length;
    finalScored.push(...spoonScored.slice(0, neededFromSpoon));

    // In case we had more than half tasty and want to favour them, we can append remaining tasty
    if (finalScored.length < desiredTotal) {
      const remaining = tastyScored.slice(half);
      finalScored.push(...remaining.slice(0, desiredTotal - finalScored.length));
    }

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