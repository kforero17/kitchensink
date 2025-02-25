import { SPOONACULAR_CONFIG, createSpoonacularUrl } from '../config/spoonacular';
import fetch from 'node-fetch';

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

  const url = createSpoonacularUrl(`${SPOONACULAR_CONFIG.ENDPOINTS.RECIPES}/complexSearch`, queryParams);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API call failed with status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    throw error;
  }
}; 