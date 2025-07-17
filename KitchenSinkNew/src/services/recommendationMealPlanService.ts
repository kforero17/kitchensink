import { generateRecipeCandidates } from '../candidate-generation/candidateGenerationService';
import { rankRecipes } from '../ranking/rankRecipes';
import { unifiedToAppRecipe } from '../utils/unifiedToAppRecipe';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { getPantryItems } from './pantryService';
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
  }
): Promise<import('../contexts/MealPlanContext').Recipe[]> {
  try {
    // collect pantry top-K (max 5)
    let pantryTokensForInclude: string[] = [];
    let pantryTokensForRanking: string[] = [];
    if (prefs.usePantryItems) {
      const uid = auth().currentUser?.uid;
      if (uid) {
        try {
          const items = await getPantryItems(uid);
          const tokens = items
            .map(i => i.name.split(' ')[0].toLowerCase())
            .filter(tok => tok.length >= 3 && !PANTRY_STOP_WORDS.has(tok));

          // Deduplicate while preserving order
          const dedup: string[] = [];
          for (const tok of tokens) {
            if (!dedup.includes(tok)) dedup.push(tok);
          }
          pantryTokensForInclude = dedup.slice(0, MAX_PANTRY_INCLUDE); // smaller list for API
          pantryTokensForRanking = dedup.slice(0, 5); // up to 5 for ranking weight
        } catch (err) { logger.warn('Cannot fetch pantry items', err); }
      }
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
      spoonacularBias: -1,
      // Keep light bias against Spoonacular but let new default weights dominate
      weights: {
        sourceBias: 0.15,
      },
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