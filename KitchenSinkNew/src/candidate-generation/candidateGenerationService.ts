import { UnifiedRecipe } from '../shared/interfaces';
import { mapTastyRecipeToUnified } from '../mappers/recipeMappers';
import { fetchUnifiedRecipesFromSpoonacular } from '../services/unifiedRecipeService';
import firestore from '@react-native-firebase/firestore';
import { titleSimilarity, bigramJaccard } from '../utils/similarityUtils';
import { computeCacheKey, getCachedValue, setCachedValue } from '../services/cachingService';
import logger from '../utils/logger';

// =====  TastyAdapter  ===== //
async function fetchTastyCandidates(userEmbedding: number[]): Promise<UnifiedRecipe[]> {
  try {
    logger.debug('Fetching Tasty candidates from Firestore...');
    
    // TODO: Integrate Firestore vector search when enabled. For now, pick recent 60 recipes.
    const snapshot = await firestore()
      .collection('recipes')
      .orderBy('updatedAt', 'desc')
      .limit(60)
      .get()
      .catch(async (orderErr: any) => {
        logger.warn('Ordering by updatedAt failed or field missing, falling back to createdAt', orderErr);
        try {
          return await firestore()
            .collection('recipes')
            .orderBy('createdAt', 'desc')
            .limit(60)
            .get();
        } catch (createdErr) {
          logger.warn('Ordering by createdAt also failed, fetching without order', createdErr);
          return await firestore()
            .collection('recipes')
            .limit(60)
            .get();
        }
      });

    if (snapshot.empty) {
      logger.warn('No Tasty recipes found in Firestore collection');
      return [];
    }

    const docs = snapshot.docs.map(d => d.data() as any);
    logger.debug(`Found ${docs.length} Tasty recipes in Firestore`);
    
    const unified = docs.map(mapTastyRecipeToUnified);
    logger.debug(`Successfully mapped ${unified.length} Tasty recipes to unified format`);
    
    return unified;
  } catch (error) {
    logger.error('Failed to fetch Tasty candidates from Firestore:', error);
    return [];
  }
}

// =====  SpoonacularAdapter  ===== //
interface SpoonacularAdapterParams {
  diet?: string;
  intolerances?: string;
  cuisine?: string;
  includeIngredients?: string[]; // top-K from pantry
  maxReadyTime?: number;
}

async function fetchSpoonacularCandidates(params: SpoonacularAdapterParams, tastyTitles: string[]): Promise<UnifiedRecipe[]> {
  const cacheKey = await computeCacheKey(params);
  const cached = await getCachedValue<UnifiedRecipe[]>(cacheKey);
  if (cached) return cached;

  const results = await fetchUnifiedRecipesFromSpoonacular({
    diet: params.diet,
    intolerances: params.intolerances,
    cuisine: params.cuisine,
    includeIngredients: params.includeIngredients?.join(',') ?? undefined,
    maxReadyTime: params.maxReadyTime,
    number: 60,
  });

  // Filter out near-duplicate titles vs Tasty
  const filtered = results.filter(r => {
    return !tastyTitles.some(tTitle => titleSimilarity(r.title, tTitle) > 0.9);
  });

  // Cache for 48h
  await setCachedValue(cacheKey, filtered);
  return filtered;
}

// =====  Aggregator  ===== //
function deduplicate(candidates: UnifiedRecipe[]): UnifiedRecipe[] {
  const output: UnifiedRecipe[] = [];

  for (const recipe of candidates) {
    const isDup = output.some(existing => {
      // Title similarity check
      if (titleSimilarity(existing.title, recipe.title) > 0.9) return true;

      // Ingredient bigram Jaccard check – use first 6 ingredients
      const ingA = existing.ingredients.slice(0, 6).map(i => i.name);
      const ingB = recipe.ingredients.slice(0, 6).map(i => i.name);
      if (bigramJaccard(ingA, ingB) > 0.7) return true;

      return false;
    });

    if (!isDup) output.push(recipe);
  }

  return output;
}

// =====  Public API  ===== //
interface GenerateOptions {
  userEmbedding: number[]; // for Tasty vector search
  diet?: string;
  intolerances?: string;
  cuisine?: string;
  pantryTopK?: string[];
  maxReadyTime?: number;
}

export async function generateRecipeCandidates(opts: GenerateOptions): Promise<UnifiedRecipe[]> {
  // Fetch from both sources independently and tolerate failures so that
  // the recommendation pipeline can still proceed when one source is
  // unavailable (e.g. offline or API quota exceeded).

  let tastyCandidates: UnifiedRecipe[] = [];
  try {
    tastyCandidates = await fetchTastyCandidates(opts.userEmbedding);
    logger.debug(`Fetched ${tastyCandidates.length} candidates from Tasty/Firestore`);
  } catch (err) {
    logger.warn('Failed to fetch Tasty candidates – continuing with fallback', err);
  }

  let spoonCandidates: UnifiedRecipe[] = [];
  try {
    spoonCandidates = await fetchSpoonacularCandidates(
      {
        diet: opts.diet,
        intolerances: opts.intolerances,
        cuisine: opts.cuisine,
        includeIngredients: opts.pantryTopK,
        maxReadyTime: opts.maxReadyTime,
      },
      tastyCandidates.map(r => r.title)
    );
    logger.debug(`Fetched ${spoonCandidates.length} candidates from Spoonacular`);
  } catch (err) {
    logger.warn('Failed to fetch Spoonacular candidates – continuing with available recipes', err);
  }

  const combined = deduplicate([...tastyCandidates, ...spoonCandidates]);
  logger.debug(`After deduplication: ${combined.length} total candidates`);

  // Surface a warn log if still no candidates – helps diagnose upstream failures
  if (combined.length === 0) {
    logger.warn('Candidate generation returned 0 recipes - both Tasty/Firestore and Spoonacular failed');
    logger.warn('Check Firestore connection and Spoonacular API availability');
  }

  return combined;
} 