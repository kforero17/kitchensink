import {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT,
} from '@env';

if (!SPOONACULAR_API_KEY) {
  throw new Error('Spoonacular API key is not defined in environment variables');
}

export const SPOONACULAR_CONFIG = {
  API_KEY: SPOONACULAR_API_KEY,
  BASE_URL: SPOONACULAR_BASE_URL || 'https://api.spoonacular.com',
  ENDPOINTS: {
    INGREDIENTS: SPOONACULAR_INGREDIENTS_ENDPOINT || '/food/ingredients',
    RECIPES: SPOONACULAR_RECIPES_ENDPOINT || '/recipes',
  },
} as const;

// Helper function to create API URLs
export const createSpoonacularUrl = (endpoint: string, queryParams: Record<string, string> = {}) => {
  const url = new URL(`${SPOONACULAR_CONFIG.BASE_URL}${endpoint}`);
  
  // Always include the API key
  url.searchParams.append('apiKey', SPOONACULAR_CONFIG.API_KEY);
  
  // Add any additional query parameters
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  
  return url.toString();
}; 