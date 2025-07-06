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
    let pantryTopK: string[] = [];
    if (prefs.usePantryItems) {
      const uid = auth().currentUser?.uid;
      if (uid) {
        try {
          const items = await getPantryItems(uid);
          pantryTopK = items.slice(0, 5).map(i => i.name.split(' ')[0]);
        } catch (err) { logger.warn('Cannot fetch pantry items', err); }
      }
    }

    const candidates = await generateRecipeCandidates({
      userEmbedding: [],
      diet: buildDietParam(prefs.dietary),
      intolerances: buildIntoleranceParam(prefs.dietary),
      cuisine: prefs.food.preferredCuisines?.join(',') || undefined,
      pantryTopK,
      maxReadyTime: deriveMaxReadyTime(prefs.cooking),
    });

    const scored = rankRecipes(candidates, {
      userTokens: buildUserTokens(prefs),
      pantryIngredients: pantryTopK,
      spoonacularBias: -0.05,
    });

    const recipes = scored.map(s => unifiedToAppRecipe(s.recipe));
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