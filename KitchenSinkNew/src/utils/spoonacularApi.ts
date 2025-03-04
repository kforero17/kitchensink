import { SPOONACULAR_CONFIG, createSpoonacularUrl } from '../config/spoonacular';
import { networkService } from './networkService';
import { ENV } from '../config/environment';

export interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  pricePerServing: number;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  sustainable: boolean;
  analyzedInstructions: {
    steps: {
      number: number;
      step: string;
      ingredients: { id: number; name: string; }[];
    }[];
  }[];
}

export interface SearchRecipesResponse {
  results: SpoonacularRecipe[];
  offset: number;
  number: number;
  totalResults: number;
}

/**
 * Search recipes using Spoonacular API with robust error handling
 */
export const searchRecipes = async (
  preferences: {
    diet?: string[];
    intolerances?: string[];
    excludeIngredients?: string[];
    maxReadyTime?: number;
    number?: number;
  }
): Promise<SearchRecipesResponse> => {
  const queryParams: Record<string, string> = {
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    number: (preferences.number || 10).toString(),
  };

  if (preferences.diet?.length) {
    queryParams.diet = preferences.diet.join(',');
  }

  if (preferences.intolerances?.length) {
    queryParams.intolerances = preferences.intolerances.join(',');
  }

  if (preferences.excludeIngredients?.length) {
    queryParams.excludeIngredients = preferences.excludeIngredients.join(',');
  }

  if (preferences.maxReadyTime) {
    queryParams.maxReadyTime = preferences.maxReadyTime.toString();
  }

  // Create the URL using our helper
  const url = createSpoonacularUrl(`${SPOONACULAR_CONFIG.ENDPOINTS.RECIPES}/complexSearch`, queryParams);

  try {
    // Use our network service
    const response = await networkService.get<SearchRecipesResponse>(url, {
      timeout: SPOONACULAR_CONFIG.NETWORK.TIMEOUT_MS,
      allowInsecure: SPOONACULAR_CONFIG.NETWORK.ALLOW_INSECURE,
    });

    if (response.error) {
      throw new Error(`API Error: ${response.error}`);
    }

    if (!response.data) {
      throw new Error('No data returned from API');
    }

    return response.data;
  } catch (error: any) {
    if (ENV.DEBUG_NETWORK) {
      console.error('Failed to search recipes:', error.message);
    }
    
    // Rethrow with a friendly message
    throw new Error(`Failed to search recipes: ${error.message}`);
  }
}; 