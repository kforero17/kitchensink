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

function buildUrl(base: string, params: Record<string, string | undefined>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
  return qs ? `${base}?${qs}` : base;
}

export async function fetchTastyRecipesViaApi(params: FetchParams): Promise<UnifiedRecipe[]> {
  const baseUrl = (ENV as any).TASTY_FUNCTION_URL || DEFAULT_BASE_URL;

  // Build include list safely (remove empties and limit to 2)
  let includeParam: string | undefined;
  if (params.includeIngredients && params.includeIngredients.length > 0) {
    const cleaned = params.includeIngredients.filter(Boolean).slice(0, 2);
    if (cleaned.length > 0) includeParam = cleaned.join(',');
  }

  const url = buildUrl(baseUrl, {
    mealType: params.mealType,
    diet: params.diet,
    intolerances: params.intolerances,
    cuisine: params.cuisine,
    include: includeParam,
    maxReadyTime: params.maxReadyTime ? params.maxReadyTime.toString() : undefined,
  });

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

  return resp.data.recipes.map(mapTastyRecipeToUnified);
} 