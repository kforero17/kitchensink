import { UnifiedRecipe } from '../shared/interfaces';
import { createSpoonacularUrl, SPOONACULAR_CONFIG } from '../config/spoonacular';
import { networkService } from '../utils/networkService';
import { mapSpoonacularRecipeToUnified } from '../mappers/recipeMappers';
import logger from '../utils/logger';

interface SearchParams {
  query?: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  maxReadyTime?: number;
  number?: number; // how many results
  includeIngredients?: string; // comma separated list
  offset?: number; // for pagination/variety
  addRecipeInformation?: boolean;
  fillIngredients?: boolean;
  sort?: string; // for variety: 'popularity', 'time', 'random'
  sortDirection?: string; // 'asc' or 'desc'
}

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds
const MAX_CACHE_SIZE = 30; // Maximum number of cached responses

// In-memory cache for API responses
interface CacheEntry {
  data: UnifiedRecipe[];
  timestamp: number;
  params: SearchParams;
}

const apiCache = new Map<string, CacheEntry>();

// Track recently fetched recipe IDs to prevent duplicates across calls
const recentlyFetchedIds = new Set<string>();
const MAX_RECENT_IDS = 500; // Keep track of last 500 recipe IDs

// Variety enhancement: track offsets used for each parameter combination
const offsetTracker = new Map<string, number>();

function generateCacheKey(params: SearchParams): string {
  // Create a deterministic cache key based on parameters (excluding offset for variety)
  const keyParts = [
    params.query || 'none',
    params.cuisine || 'none',
    params.diet || 'none',
    params.intolerances || 'none',
    params.maxReadyTime?.toString() || 'none',
    params.number?.toString() || '10',
    params.includeIngredients || 'none',
    params.sort || 'none',
    params.sortDirection || 'none'
  ];
  return keyParts.join('|');
}

function cleanupCache(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  
  // Remove expired entries
  for (const [key, entry] of apiCache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      expiredKeys.push(key);
    }
  }
  
  expiredKeys.forEach(key => apiCache.delete(key));
  
  // If cache is still too large, remove oldest entries
  if (apiCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(apiCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => apiCache.delete(key));
  }
  
  // Clean up recently fetched IDs if too many
  if (recentlyFetchedIds.size > MAX_RECENT_IDS) {
    const idsArray = Array.from(recentlyFetchedIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_RECENT_IDS);
    toRemove.forEach(id => recentlyFetchedIds.delete(id));
  }
}

function deduplicateRecipes(recipes: UnifiedRecipe[]): UnifiedRecipe[] {
  const seen = new Set<string>();
  const unique: UnifiedRecipe[] = [];
  
  for (const recipe of recipes) {
    // Use recipe ID as primary deduplication key
    if (!seen.has(recipe.id)) {
      seen.add(recipe.id);
      unique.push(recipe);
    }
  }
  
  return unique;
}

function filterRecentlyFetched(recipes: UnifiedRecipe[]): UnifiedRecipe[] {
  const filtered: UnifiedRecipe[] = [];
  
  for (const recipe of recipes) {
    if (!recentlyFetchedIds.has(recipe.id)) {
      recentlyFetchedIds.add(recipe.id);
      filtered.push(recipe);
    }
  }
  
  return filtered;
}

function getVarietyOffset(params: SearchParams): number {
  const baseKey = generateCacheKey(params);
  const currentOffset = offsetTracker.get(baseKey) || 0;
  
  // Increment offset for variety (cycle through different pages)
  const newOffset = (currentOffset + (params.number || 10)) % 1000; // Max offset of 1000
  offsetTracker.set(baseKey, newOffset);
  
  return currentOffset;
}

function getRandomSortOption(): { sort: string; sortDirection: string } {
  const sortOptions = [
    { sort: 'popularity', sortDirection: 'desc' },
    { sort: 'time', sortDirection: 'asc' },
    { sort: 'time', sortDirection: 'desc' },
    { sort: 'random', sortDirection: 'asc' },
    { sort: 'calories', sortDirection: 'asc' },
    { sort: 'calories', sortDirection: 'desc' },
    { sort: 'protein', sortDirection: 'asc' },
    { sort: 'protein', sortDirection: 'desc' }
  ];
  
  return sortOptions[Math.floor(Math.random() * sortOptions.length)];
}

function getRandomCuisineQuery(): string | undefined {
  const cuisines = [
    'italian', 'mexican', 'chinese', 'indian', 'japanese', 'thai', 'french', 
    'mediterranean', 'american', 'greek', 'spanish', 'korean', 'vietnamese',
    'middle eastern', 'african', 'caribbean', 'latin american'
  ];
  
  // 30% chance to add a random cuisine query for variety
  if (Math.random() < 0.3) {
    return cuisines[Math.floor(Math.random() * cuisines.length)];
  }
  
  return undefined;
}

/**
 * Fetches lightweight recipe metadata from Spoonacular and converts it to the
 * `UnifiedRecipe` contract.  Keeps the payload minimal to respect Spoonacular
 * content licensing.
 */
export async function fetchUnifiedRecipesFromSpoonacular(params: SearchParams): Promise<UnifiedRecipe[]> {
  logger.debug('Fetching recipes from Spoonacular with params:', params);
  
  // Clean up cache before checking
  cleanupCache();
  
  // Add variety enhancements
  const varietyParams = { ...params };
  
  // Add offset for variety if not specified
  if (!varietyParams.offset) {
    varietyParams.offset = getVarietyOffset(params);
  }
  
  // Add random sort option for variety if not specified
  if (!varietyParams.sort) {
    const randomSort = getRandomSortOption();
    varietyParams.sort = randomSort.sort;
    varietyParams.sortDirection = randomSort.sortDirection;
  }
  
  // Add random cuisine query for variety (30% chance)
  if (!varietyParams.cuisine && !varietyParams.query) {
    const randomCuisine = getRandomCuisineQuery();
    if (randomCuisine) {
      varietyParams.cuisine = randomCuisine;
    }
  }
  
  // Ensure we have recipe information and ingredients
  varietyParams.addRecipeInformation = true;
  varietyParams.fillIngredients = true;
  
  const queryParams: Record<string, string> = {
    number: (varietyParams.number ?? 10).toString(),
    addRecipeInformation: 'true',
    fillIngredients: 'true',
  };

  if (varietyParams.query) queryParams.query = varietyParams.query;
  if (varietyParams.cuisine) queryParams.cuisine = varietyParams.cuisine;
  if (varietyParams.diet) queryParams.diet = varietyParams.diet;
  if (varietyParams.intolerances) queryParams.intolerances = varietyParams.intolerances;
  if (varietyParams.maxReadyTime) queryParams.maxReadyTime = varietyParams.maxReadyTime.toString();
  if (varietyParams.includeIngredients) queryParams.includeIngredients = varietyParams.includeIngredients;
  if (varietyParams.offset) queryParams.offset = varietyParams.offset.toString();
  if (varietyParams.sort) queryParams.sort = varietyParams.sort;
  if (varietyParams.sortDirection) queryParams.sortDirection = varietyParams.sortDirection;

  // Check cache first (using base params without offset for caching)
  const cacheKey = generateCacheKey(params);
  const cachedEntry = apiCache.get(cacheKey);
  
  if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_DURATION) {
    logger.debug(`[SPOONACULAR] Using cached response for ${cachedEntry.data.length} recipes`);
    
    // Filter out recently fetched recipes from cache
    const filteredFromCache = filterRecentlyFetched(cachedEntry.data);
    logger.debug(`[SPOONACULAR] After filtering recently fetched: ${filteredFromCache.length} recipes`);
    
    return filteredFromCache;
  }

  // Step 1: complexSearch to get candidate IDs
  const searchUrl = createSpoonacularUrl(`${SPOONACULAR_CONFIG.ENDPOINTS.RECIPES}/complexSearch`, queryParams);
  logger.debug(`[SPOONACULAR] Search URL: ${searchUrl}`);
  
  const searchResp = await networkService.get<{ results: { id: number }[] }>(searchUrl);
  
  if (searchResp.error) {
    logger.error('Spoonacular complexSearch failed:', searchResp.error);
    throw new Error(`Spoonacular API error: ${searchResp.error}`);
  }
  
  if (searchResp.error || !searchResp.data) {
    throw new Error(searchResp.error ?? 'Unknown error calling Spoonacular complexSearch');
  }

  logger.debug('Spoonacular search response:', searchResp.data);
  
  const ids = (searchResp.data.results || []).map(r => r.id);
  logger.debug(`Found ${ids.length} recipe IDs from Spoonacular`);
  
  if (ids.length === 0) return [];

  // Step 2: For each id fetch /information (includeNutrition)
  const recipePromises = ids.map(async id => {
    const infoUrl = createSpoonacularUrl(`${SPOONACULAR_CONFIG.ENDPOINTS.RECIPES}/${id}/information`, {
      includeNutrition: 'true',
    });
    logger.debug(`Fetching recipe details for ID ${id}:`, infoUrl);
    const infoResp = await networkService.get<any>(infoUrl);
    if (infoResp.error || !infoResp.data) {
      logger.error(`Failed to fetch recipe ${id}:`, infoResp.error);
      throw new Error(infoResp.error ?? `Failed to fetch info for recipe ${id}`);
    }
    return mapSpoonacularRecipeToUnified(infoResp.data);
  });

  // Run requests in parallel but respect API rate limits using Promise.allSettled
  const settled = await Promise.allSettled(recipePromises);
  const unified: UnifiedRecipe[] = [];
  settled.forEach(res => {
    if (res.status === 'fulfilled') unified.push(res.value);
    else logger.warn('[Spoonacular] Failed recipe details:', res.reason);
  });

  // Apply deduplication and filtering
  const deduplicatedRecipes = deduplicateRecipes(unified);
  logger.debug(`[SPOONACULAR] After deduplication: ${deduplicatedRecipes.length} recipes`);
  
  const filteredRecipes = filterRecentlyFetched(deduplicatedRecipes);
  logger.debug(`[SPOONACULAR] After filtering recently fetched: ${filteredRecipes.length} recipes`);
  
  // Cache the full response (before filtering recently fetched)
  apiCache.set(cacheKey, {
    data: deduplicatedRecipes,
    timestamp: Date.now(),
    params: varietyParams
  });

  logger.debug(`Successfully fetched ${filteredRecipes.length} unified recipes from Spoonacular`);
  return filteredRecipes;
}

// Export cache management functions for testing and debugging
export function clearSpoonacularApiCache(): void {
  apiCache.clear();
  recentlyFetchedIds.clear();
  offsetTracker.clear();
  logger.debug('[SPOONACULAR] Cache cleared');
}

export function resetSpoonacularRecentlyFetchedIds(): void {
  recentlyFetchedIds.clear();
  logger.debug('[SPOONACULAR] Recently fetched IDs reset');
}

export function getSpoonacularApiCacheStats(): { cacheSize: number; recentIdsSize: number; offsetTrackerSize: number } {
  return {
    cacheSize: apiCache.size,
    recentIdsSize: recentlyFetchedIds.size,
    offsetTrackerSize: offsetTracker.size
  };
} 