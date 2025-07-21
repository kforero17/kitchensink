import { UnifiedRecipe } from '../shared/interfaces';
import { networkService } from '../utils/networkService';
import { ENV } from '../config/environment';
import { mapTastyRecipeToUnified } from '../mappers/recipeMappers';
import logger from '../utils/logger';

interface FetchParams {
  mealType?: string;
  diet?: string;
  intolerances?: string;
  cuisine?: string;
  includeIngredients?: string[];
  maxReadyTime?: number;
}

const DEFAULT_BASE_URL =
  'https://us-central1-kitchensink-c4872.cloudfunctions.net/getRecipes';

// Cache configuration
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_CACHE_SIZE = 50; // Maximum number of cached responses

// In-memory cache for API responses
interface CacheEntry {
  data: UnifiedRecipe[];
  timestamp: number;
  url: string;
}

const apiCache = new Map<string, CacheEntry>();

// Track recently fetched recipe IDs to prevent duplicates across calls
const recentlyFetchedIds = new Set<string>();
const MAX_RECENT_IDS = 1000; // Keep track of last 1000 recipe IDs

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  return qs ? `${base}?${qs}` : base;
}

function generateCacheKey(params: FetchParams): string {
  // Create a deterministic cache key based on parameters
  // Note: We don't include seed in cache key to allow caching of shuffled results
  const keyParts = [
    params.mealType || 'all',
    params.diet || 'none',
    params.intolerances || 'none',
    params.cuisine || 'none',
    params.includeIngredients?.sort().join(',') || 'none',
    params.maxReadyTime?.toString() || 'none'
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

export async function fetchTastyRecipesViaApi(params: FetchParams): Promise<UnifiedRecipe[]> {
  const baseUrl = (ENV as any).TASTY_FUNCTION_URL || DEFAULT_BASE_URL;

  // Build include list safely (remove empties and limit to 2)
  let includeParam: string | undefined;
  if (params.includeIngredients && params.includeIngredients.length > 0) {
    const cleaned = params.includeIngredients.filter(Boolean).slice(0, 2);
    if (cleaned.length > 0) includeParam = cleaned.join(',');
  }

  // Add a seed parameter to ensure variety when the same parameters are used
  const seed = Date.now().toString() + Math.random().toString(36).substring(2, 8);
  
  const url = buildUrl(baseUrl, {
    mealType: params.mealType,
    diet: params.diet,
    intolerances: params.intolerances,
    cuisine: params.cuisine,
    include: includeParam,
    maxReadyTime: params.maxReadyTime ? params.maxReadyTime.toString() : undefined,
    seed: seed,
  });

  // Clean up cache before checking
  cleanupCache();
  
  // Check cache first
  const cacheKey = generateCacheKey(params);
  const cachedEntry = apiCache.get(cacheKey);
  
  if (cachedEntry && (Date.now() - cachedEntry.timestamp) < CACHE_DURATION) {
    logger.debug(`[TASTY API] Using cached response for ${cachedEntry.data.length} recipes`);
    
    // Filter out recently fetched recipes from cache
    const filteredFromCache = filterRecentlyFetched(cachedEntry.data);
    logger.debug(`[TASTY API] After filtering recently fetched: ${filteredFromCache.length} recipes`);
    
    return filteredFromCache;
  }

  // Log at request *start* so the order is unambiguous in production builds.
  logger.debug(`[TASTY API] GET ${url}`);
  const resp = await networkService.get<{ recipes: any[] }>(url);
  if (resp.error) throw new Error(resp.error);
  if (!resp.data) {
    throw new Error('Failed to fetch Tasty recipes via API');
  }

  const fetched = resp.data?.recipes?.length ?? 0;
  logger.debug(`[TASTY API] fetched ${fetched} recipes`);

  // Fallback: if we used include but got zero results, retry once without include
  if (fetched === 0 && includeParam) {
    logger.debug('[TASTY API] includeIngredients returned 0 results – retrying without include');
    return fetchTastyRecipesViaApi({ ...params, includeIngredients: undefined });
  }

  // Convert to unified format and deduplicate
  const unifiedRecipes = resp.data.recipes.map(mapTastyRecipeToUnified);
  const deduplicatedRecipes = deduplicateRecipes(unifiedRecipes);
  
  logger.debug(`[TASTY API] After deduplication: ${deduplicatedRecipes.length} recipes`);
  
  // Filter out recently fetched recipes
  const filteredRecipes = filterRecentlyFetched(deduplicatedRecipes);
  logger.debug(`[TASTY API] After filtering recently fetched: ${filteredRecipes.length} recipes`);
  
  // Cache the full response (before filtering recently fetched)
  apiCache.set(cacheKey, {
    data: deduplicatedRecipes,
    timestamp: Date.now(),
    url: url
  });
  
  return filteredRecipes;
}

// Export cache management functions for testing and debugging
export function clearTastyApiCache(): void {
  apiCache.clear();
  recentlyFetchedIds.clear();
  logger.debug('[TASTY API] Cache cleared');
}

export function resetRecentlyFetchedIds(): void {
  recentlyFetchedIds.clear();
  logger.debug('[TASTY API] Recently fetched IDs reset');
}

export function getTastyApiCacheStats(): { cacheSize: number; recentIdsSize: number } {
  return {
    cacheSize: apiCache.size,
    recentIdsSize: recentlyFetchedIds.size
  };
} 