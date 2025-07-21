import { UnifiedRecipe } from '../shared/interfaces';
import { mapTastyRecipeToUnified } from '../mappers/recipeMappers';
import { fetchTastyRecipesViaApi, resetRecentlyFetchedIds } from '../services/tastyApiService';
import { resetSpoonacularRecentlyFetchedIds } from '../services/unifiedRecipeService';
import { fetchUnifiedRecipesFromSpoonacular } from '../services/unifiedRecipeService';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
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
// How many Tasty documents to pull on each call.  
// 0 (or a negative number) means *no limit* – fetch every recipe document.  
// You can override this via the `TASTY_FETCH_LIMIT` env-var to quickly experiment
// without code changes (e.g. TASTY_FETCH_LIMIT=500 node run-script …).
const TASTY_FETCH_LIMIT = process.env.TASTY_FETCH_LIMIT ? Number(process.env.TASTY_FETCH_LIMIT) : 250;

// Page size for cursor-based pagination (defaults to 500 if not provided)
const TASTY_PAGE_SIZE = process.env.TASTY_PAGE_SIZE ? Number(process.env.TASTY_PAGE_SIZE) : 250;

async function fetchTastyCandidates(userEmbedding: number[]): Promise<UnifiedRecipe[]> {
  try {
    logger.debug(`Fetching Tasty candidates from Firestore using cursor paging (pageSize=${TASTY_PAGE_SIZE})…`);

    const maxDocs = TASTY_FETCH_LIMIT > 0 ? TASTY_FETCH_LIMIT : Infinity;
    const orderFields: (string | null)[] = ['updatedAt', 'createdAt', null];

    const collected: FirebaseFirestoreTypes.DocumentSnapshot[] = [];
    let lastDoc: FirebaseFirestoreTypes.DocumentSnapshot | undefined;
    let fieldIdx = 0;

    while (collected.length < maxDocs && fieldIdx < orderFields.length) {
      const field = orderFields[fieldIdx];

      // Build the query for this iteration
      let query: FirebaseFirestoreTypes.Query = firestore().collection('recipes');
      if (field) query = (query as any).orderBy(field as any, 'desc');
      if (lastDoc) query = query.startAfter(lastDoc);
      query = query.limit(TASTY_PAGE_SIZE);

      let snapshot: FirebaseFirestoreTypes.QuerySnapshot;
      try {
        snapshot = await query.get();
      } catch (err) {
        logger.warn(`Query failed for order field "${field}" – switching fallback`, err);
        // Reset cursor and move to next fallback field
        lastDoc = undefined;
        fieldIdx++;
        continue;
      }

      // If we didn't get any docs on the very first attempt, move to next field.
      if (snapshot.empty && collected.length === 0) {
        fieldIdx++;
        continue;
      }

      if (snapshot.empty) break; // No more pages for this ordering

      collected.push(...snapshot.docs);

      lastDoc = snapshot.docs[snapshot.docs.length - 1];

      // If we fetched less than a full page, we reached the end for this ordering
      if (snapshot.size < TASTY_PAGE_SIZE) break;
      // Loop again for next page (same order field)
    }

    if (collected.length === 0) {
      logger.warn('No Tasty recipes found in Firestore collection');
      return [];
    }

    const sliced = collected.slice(0, maxDocs);

    // Include Firestore doc.id so downstream mappers have access
    const docs = sliced.map((d: FirebaseFirestoreTypes.DocumentSnapshot) => ({ id: d.id, ...d.data() } as any));
    logger.info(`[TASTY DEBUG] fetched=${docs.length}`);

    const unified = docs.map(mapTastyRecipeToUnified);
    logger.debug(`Mapped ${unified.length} Tasty recipes to unified format`);

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
    number: 100, // Increased from 60 to get more variety
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
  
  // Reset recently fetched IDs to ensure variety in new meal plan generation
  resetRecentlyFetchedIds();
  resetSpoonacularRecentlyFetchedIds();
  
  // Fetch from both sources independently and tolerate failures so that
  // the recommendation pipeline can still proceed when one source is
  // unavailable (e.g. offline or API quota exceeded).

  let tastyCandidates: UnifiedRecipe[] = [];
  try {
    logger.info('[ORDER TRACE] → TASTY API fetch begins');
    tastyCandidates = await fetchTastyRecipesViaApi({
      mealType: undefined, // we don't know mealType here; server will filter if param missing
      diet: opts.diet,
      intolerances: opts.intolerances,
      cuisine: opts.cuisine,
      includeIngredients: opts.pantryTopK,
      maxReadyTime: opts.maxReadyTime,
    });
    logger.debug(`Fetched ${tastyCandidates.length} candidates via Tasty API`);
  } catch (apiErr) {
    logger.warn('Tasty API fetch failed, falling back to Firestore paging', apiErr);
    try {
      tastyCandidates = await fetchTastyCandidates(opts.userEmbedding);
    } catch (fsErr) {
      logger.error('Firestore fallback also failed', fsErr);
    }
  }

  let spoonCandidates: UnifiedRecipe[] = [];
  try {
    logger.info('[ORDER TRACE] → Spoonacular fetch begins');
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