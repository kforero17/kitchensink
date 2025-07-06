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
}

/**
 * Fetches lightweight recipe metadata from Spoonacular and converts it to the
 * `UnifiedRecipe` contract.  Keeps the payload minimal to respect Spoonacular
 * content licensing.
 */
export async function fetchUnifiedRecipesFromSpoonacular(params: SearchParams): Promise<UnifiedRecipe[]> {
  logger.debug('Fetching recipes from Spoonacular with params:', params);
  
  const queryParams: Record<string, string> = {
    number: (params.number ?? 10).toString(),
  };

  if (params.query) queryParams.query = params.query;
  if (params.cuisine) queryParams.cuisine = params.cuisine;
  if (params.diet) queryParams.diet = params.diet;
  if (params.intolerances) queryParams.intolerances = params.intolerances;
  if (params.maxReadyTime) queryParams.maxReadyTime = params.maxReadyTime.toString();
  if (params.includeIngredients) queryParams.includeIngredients = params.includeIngredients;

  // Step 1: complexSearch to get candidate IDs
  const searchUrl = createSpoonacularUrl(`${SPOONACULAR_CONFIG.ENDPOINTS.RECIPES}/complexSearch`, queryParams);
  logger.debug('Spoonacular search URL:', searchUrl);
  
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

  logger.debug(`Successfully fetched ${unified.length} unified recipes from Spoonacular`);
  return unified;
} 