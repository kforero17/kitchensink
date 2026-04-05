import { UnifiedRecipe } from '../shared/interfaces';
import { UserPreferences } from '../types/FirestoreSchema';
import { getRecipeHistory, RecipeHistoryItem } from '../utils/recipeHistory';
import { buildTemporalProfile, TemporalProfile } from '../ranking/temporalPatterns';
import { getSeason, buildSeasonalProfile, Season, SeasonalProfile } from '../ranking/seasonalSignal';
import { getActiveLeftovers } from './leftoverService';
import { getPantryItems } from './pantryService';
import { generateRecipeCandidates } from '../candidate-generation/candidateGenerationService';
import { rankRecipes, ScoredRecipe, RankRecipesOptions } from '../ranking/rankRecipes';
import { FeatureContext, PantryIngredientInfo } from '../ranking/featureEngineering';
import { buildFeedbackMap, buildSeenRecipeIds } from '../ranking/feedbackSignal';
import { recipeFeedbackService } from './recipeFeedbackService';
import { Leftover } from '../types/Leftover';
import auth from '@react-native-firebase/auth';
import logger from '../utils/logger';

export interface PredictedMeal {
  recipe: UnifiedRecipe;
  mealType: string;
  confidence: number;
  reasons: string[];
}

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

const CONFIDENCE_THRESHOLD = 0.3;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Predicts what the user is likely to want to cook today by combining temporal
 * patterns, seasonal affinity, leftovers, pantry expiry, and feedback signals.
 *
 * Returns up to one prediction per meal type (breakfast, lunch, dinner), each
 * with a confidence score and human-readable reasons.
 */
export async function predictTodaysMeals(
  prefs: UserPreferences,
  targetDate?: Date,
): Promise<PredictedMeal[]> {
  const date = targetDate ?? new Date();
  const targetDay = date.getDay();
  const currentSeason = getSeason(date);

  const history = await getRecipeHistory();
  if (history.length === 0) {
    return [];
  }

  const temporalProfile = buildTemporalProfile(history);

  const candidates = await fetchCandidates(prefs);
  if (candidates.length === 0) {
    return [];
  }

  const recipeTagLookup = buildRecipeTagLookup(candidates);
  const seasonalProfile = buildSeasonalProfile(history, recipeTagLookup);

  const activeLeftovers = await getActiveLeftovers();

  const pantryItems = await fetchPantryItems();
  const pantryIngredients = pantryItems.map(item => item.name);
  const pantryItemsWithExpiry: PantryIngredientInfo[] = pantryItems.map(item => ({
    name: item.name,
    expirationDate: item.expirationDate,
  }));

  const feedbackHistory = await loadFeedbackHistory();
  const feedbackMap = buildFeedbackMap(feedbackHistory);
  const seenRecipeIds = buildSeenRecipeIds(feedbackHistory);

  const userTokens = buildUserTokens(prefs);

  const context: RankRecipesOptions = {
    userTokens,
    pantryIngredients,
    pantryItems: pantryItemsWithExpiry,
    seenRecipeIds,
    feedbackMap,
    targetDay,
    temporalProfile,
    seasonalProfile,
    currentSeason,
    activeLeftovers,
  };

  const scoredRecipes = rankRecipes(candidates, context);

  const predictions: PredictedMeal[] = [];

  for (const mealType of MEAL_TYPES) {
    const topForMeal = findTopQualifiedRecipe(scoredRecipes, mealType, CONFIDENCE_THRESHOLD);
    if (!topForMeal) {
      continue;
    }

    const confidence = computeConfidence(topForMeal);

    const reasons = generateReasons(
      topForMeal,
      mealType,
      targetDay,
      currentSeason,
      activeLeftovers,
      pantryItemsWithExpiry,
    );

    predictions.push({
      recipe: topForMeal.recipe,
      mealType,
      confidence,
      reasons,
    });
  }

  return predictions;
}

function findTopQualifiedRecipe(
  scoredRecipes: ScoredRecipe[],
  mealType: string,
  minConfidence: number,
): ScoredRecipe | undefined {
  return scoredRecipes.find(sr => {
    const tags = sr.recipe.tags.map(t => t.toLowerCase());
    return tags.includes(mealType) && computeConfidence(sr) >= minConfidence;
  });
}

function computeConfidence(scored: ScoredRecipe): number {
  const f = scored.features;

  const weightedSum =
    f.sim * 0.22 +
    f.pantry * 0.15 +
    f.popularity * 0.05 +
    f.novelty * 0.08 +
    f.expiryUrgency * 0.10 +
    f.feedback * 0.12 +
    f.temporalFit * 0.10 +
    f.seasonalFit * 0.08 +
    f.leftoverAware * 0.07;

  // sourceBias is excluded from confidence since it can be negative and is
  // more of a correction term than a confidence signal.
  // Clamp to [0, 1].
  return Math.max(0, Math.min(1, weightedSum));
}

function generateReasons(
  scored: ScoredRecipe,
  mealType: string,
  targetDay: number,
  currentSeason: Season,
  activeLeftovers: Leftover[],
  pantryItems: PantryIngredientInfo[],
): string[] {
  const reasons: string[] = [];
  const f = scored.features;
  const dayName = DAY_NAMES[targetDay];

  if (f.temporalFit > 0.6) {
    reasons.push(`You often cook ${mealType} on ${dayName}s`);
  }

  if (f.seasonalFit > 0.6) {
    reasons.push(`Great for ${currentSeason}`);
  }

  if (f.leftoverAware > 0) {
    const matchingLeftover = findMatchingLeftover(scored.recipe, activeLeftovers);
    if (matchingLeftover) {
      reasons.push(`Uses leftover ${matchingLeftover.recipeName}`);
    }
  }

  if (f.expiryUrgency > 0.5) {
    const expiringIngredient = findExpiringIngredient(scored.recipe, pantryItems);
    if (expiringIngredient) {
      reasons.push(`${expiringIngredient} expiring soon`);
    }
  }

  if (f.pantry > 0.6) {
    reasons.push('Uses ingredients you already have');
  }

  if (f.feedback > 0.3) {
    reasons.push('Based on recipes you have enjoyed');
  }

  return reasons;
}

function findMatchingLeftover(
  recipe: UnifiedRecipe,
  activeLeftovers: Leftover[],
): Leftover | undefined {
  const recipeNameTokens = new Set(
    recipe.title.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean),
  );
  const recipeIngTokens = new Set(
    recipe.ingredients.flatMap(ing =>
      (ing?.name || '').toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean),
    ),
  );
  const allRecipeTokens = new Set([...recipeNameTokens, ...recipeIngTokens]);

  for (const leftover of activeLeftovers) {
    const leftoverTokens = leftover.recipeName
      .toLowerCase()
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean);

    const hasOverlap = leftoverTokens.some(t => allRecipeTokens.has(t));
    if (hasOverlap) {
      return leftover;
    }
  }

  return undefined;
}

function findExpiringIngredient(
  recipe: UnifiedRecipe,
  pantryItems: PantryIngredientInfo[],
): string | undefined {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  for (const ing of recipe.ingredients) {
    if (!ing?.name) continue;
    const ingTokens = ing.name.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean);

    for (const item of pantryItems) {
      if (!item.expirationDate) continue;

      const itemTokens = item.name.toLowerCase().split(/[^a-zA-Z0-9]+/).filter(Boolean);
      const hasOverlap = ingTokens.some(t => itemTokens.includes(t));
      if (!hasOverlap) continue;

      const expiry = new Date(item.expirationDate);
      expiry.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysUntilExpiry <= 5) {
        return item.name;
      }
    }
  }

  return undefined;
}

function buildRecipeTagLookup(recipes: UnifiedRecipe[]): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const recipe of recipes) {
    lookup.set(recipe.id, recipe.tags);
  }
  return lookup;
}

function buildUserTokens(prefs: UserPreferences): string[] {
  const tokens: string[] = [];

  if (prefs.food?.favoriteIngredients) {
    for (const ing of prefs.food.favoriteIngredients) {
      tokens.push(...ing.toLowerCase().split(/\s+/).filter(Boolean));
    }
  }

  if (prefs.food?.preferredCuisines) {
    for (const cuisine of prefs.food.preferredCuisines) {
      tokens.push(cuisine.toLowerCase());
    }
  }

  if (prefs.dietary) {
    if (prefs.dietary.vegetarian) tokens.push('vegetarian');
    if (prefs.dietary.vegan) tokens.push('vegan');
    if (prefs.dietary.glutenFree) tokens.push('gluten-free', 'gluten', 'free');
    if (prefs.dietary.dairyFree) tokens.push('dairy-free', 'dairy', 'free');
  }

  return tokens;
}

async function fetchCandidates(prefs: UserPreferences): Promise<UnifiedRecipe[]> {
  try {
    const diet = deriveDiet(prefs);
    const intolerances = deriveIntolerances(prefs);
    const pantryTopK = prefs.food?.favoriteIngredients?.slice(0, 5);

    return await generateRecipeCandidates({
      userEmbedding: [],
      diet,
      intolerances,
      pantryTopK,
    });
  } catch (error) {
    logger.error('[predictionService] Failed to fetch candidates', error);
    return [];
  }
}

async function fetchPantryItems(): Promise<Array<{ name: string; expirationDate?: string }>> {
  try {
    const uid = auth().currentUser?.uid;
    if (!uid) return [];
    const items = await getPantryItems(uid);
    return items.map(item => ({
      name: item.name,
      expirationDate: item.expirationDate,
    }));
  } catch (error) {
    logger.error('[predictionService] Failed to fetch pantry items', error);
    return [];
  }
}

async function loadFeedbackHistory() {
  try {
    return await recipeFeedbackService.getUserFeedbackHistory(50);
  } catch (error) {
    logger.error('[predictionService] Failed to load feedback history', error);
    return [];
  }
}

function deriveDiet(prefs: UserPreferences): string | undefined {
  if (prefs.dietary?.vegan) return 'vegan';
  if (prefs.dietary?.vegetarian) return 'vegetarian';
  if (prefs.dietary?.glutenFree) return 'gluten free';
  return undefined;
}

function deriveIntolerances(prefs: UserPreferences): string | undefined {
  const intolerances: string[] = [];
  if (prefs.dietary?.dairyFree) intolerances.push('dairy');
  if (prefs.dietary?.nutFree) intolerances.push('tree nut');
  if (prefs.dietary?.glutenFree) intolerances.push('gluten');
  if (prefs.dietary?.allergies) {
    intolerances.push(...prefs.dietary.allergies);
  }
  return intolerances.length > 0 ? intolerances.join(',') : undefined;
}
