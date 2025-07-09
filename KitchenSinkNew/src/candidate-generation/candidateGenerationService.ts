import { UnifiedRecipe } from '../shared/interfaces';
import { mapTastyRecipeToUnified } from '../mappers/recipeMappers';
import { fetchUnifiedRecipesFromSpoonacular } from '../services/unifiedRecipeService';
import firestore from '@react-native-firebase/firestore';
import { titleSimilarity, bigramJaccard } from '../utils/similarityUtils';
import { computeCacheKey, getCachedValue, setCachedValue } from '../services/cachingService';
import logger from '../utils/logger';
import auth from '@react-native-firebase/auth';
// Utility to make sure we are authenticated before making Firestore reads.
async function ensureAuthReady(): Promise<void> {
  if (auth().currentUser) return;
  logger.info('[AUTH DEBUG] candidateGenerationService waiting for auth...');
  await new Promise(resolve => {
    const timeout = setTimeout(async () => {
      logger.warn('[AUTH DEBUG] Auth wait timeout in candidateGenerationService – attempting anonymous sign-in');
      try {
        const cred = await auth().signInAnonymously();
        logger.info('[AUTH DEBUG] Anonymous sign-in success:', cred.user.uid);
      } catch (anonErr) {
        logger.error('[AUTH DEBUG] Anonymous sign-in failed:', anonErr);
      }
      resolve(null);
    }, 5000);
    const unsub = auth().onAuthStateChanged(user => {
      if (user) {
        clearTimeout(timeout);
        unsub();
        logger.info('[AUTH DEBUG] Auth ready in candidateGenerationService:', user.uid);
        resolve(null);
      }
    });
  });
}

// =====  TastyAdapter  ===== //
// How many Tasty documents to pull on each call. Adjust here to rebalance source mix.
const TASTY_FETCH_LIMIT = 300;

async function fetchTastyCandidates(userEmbedding: number[]): Promise<UnifiedRecipe[]> {
  try {
    logger.debug('Fetching Tasty candidates from Firestore...');
    
    // TODO: Integrate Firestore vector search when enabled. For now, pick recent 60 recipes.
    const snapshot = await firestore()
      .collection('recipes')
      .orderBy('updatedAt', 'desc')
      .limit(TASTY_FETCH_LIMIT)
      .get()
      .catch(async (orderErr: any) => {
        logger.warn('Ordering by updatedAt failed or field missing, falling back to createdAt', orderErr);
        try {
          return await firestore()
            .collection('recipes')
            .orderBy('createdAt', 'desc')
            .limit(TASTY_FETCH_LIMIT)
            .get();
        } catch (createdErr) {
          logger.warn('Ordering by createdAt also failed, fetching without order', createdErr);
          return await firestore()
            .collection('recipes')
            .limit(TASTY_FETCH_LIMIT)
            .get();
        }
      });

    if (snapshot.empty) {
      logger.warn('No Tasty recipes found in Firestore collection');
      return [];
    }

    // Include Firestore doc.id so downstream mappers have access
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
    logger.info(`[TASTY DEBUG] snapshot size=${snapshot.size}`);
    if (snapshot.size > 0) {
      const first = snapshot.docs[0];
      logger.info('[TASTY DEBUG] first doc id:', first.id, 'fields:', Object.keys(first.data()));
    }
    logger.debug(`Found ${docs.length} Tasty recipes in Firestore`);
    
    const unified = docs.map(mapTastyRecipeToUnified);
    logger.debug(`Successfully mapped ${unified.length} Tasty recipes to unified format`);

    logger.info(`[TASTY PIPE] raw=${docs.length} unified=${unified.length}`);
    
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
  // Ensure we have Firebase auth before any Firestore interaction (Tasty fetch or cache).
  await ensureAuthReady();
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
  logger.info(`[CANDIDATE MIX] tasty=${tastyCandidates.length}  spoonacular=${spoonCandidates.length}  combined=${combined.length}`);
  logger.debug(`After deduplication: ${combined.length} total candidates`);

  // Surface a warn log if still no candidates – helps diagnose upstream failures
  if (combined.length === 0) {
    logger.warn('Candidate generation returned 0 recipes - both Tasty/Firestore and Spoonacular failed');
    logger.warn('Check Firestore connection and Spoonacular API availability');
  }

  return combined;
} 