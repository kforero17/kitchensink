import { Recipe } from '../types/Recipe';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { md5 } = require('./cryptoWrapper');
import { env } from './loadEnv';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

// Read config from env file
const SPOONACULAR_API_KEY = env.SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = env.SPOONACULAR_BASE_URL;
const SPOONACULAR_RECIPES_ENDPOINT = env.SPOONACULAR_RECIPES_ENDPOINT;

// Cache configuration
// Define cache directory with strict type checking
const CACHE_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cache/recipes/` : '';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// For SSL certification bypass
const fetchOptions = {
  headers: {
    'X-Debug-Request-Id': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
};

// Enhanced debug logging
console.log('[NETWORK DEBUG] Environment setup:', {
  apiKey: SPOONACULAR_API_KEY ? 'Set (hidden)' : 'Not set',
  baseUrl: SPOONACULAR_BASE_URL,
  endpoint: SPOONACULAR_RECIPES_ENDPOINT,
  platform: Platform.OS,
  sslEnabled: true,
  nodeEnv: process.env.NODE_ENV,
});

// Create cache directory if it doesn't exist and documentDirectory is available
async function ensureCacheDirectory() {
  try {
    if (!FileSystem.documentDirectory) {
      console.error('File system document directory is not available');
      return;
    }
    
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

// Initialize cache directory
ensureCacheDirectory().catch(err => {
  console.warn('Failed to initialize cache directory:', err);
});

// Spoonacular API recipe interface
export interface SpoonacularRecipe {
  id: number;
  title: string;
  summary?: string;
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
  dishTypes?: string[];
  cuisines?: string[];
  diets?: string[];
  occasions?: string[];
  extendedIngredients?: {
    id: number;
    name: string;
    amount: number;
    unit: string;
    original: string;
  }[];
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
 * Generate a unique cache key based on user preferences
 */
async function generateCacheKey(preferences: {
  dietary: DietaryPreferences;
  food: FoodPreferences;
  cooking: CookingPreferences;
  budget: BudgetPreferences;
}): Promise<string> {
  // Create a deterministic string representation of preferences
  const preferencesStr = JSON.stringify(preferences, Object.keys(preferences).sort());
  
  // Use direct md5 import
  return md5(preferencesStr);
}

/**
 * Create a Spoonacular API URL with query parameters
 */
function createSpoonacularUrl(endpoint: string, queryParams: Record<string, string> = {}): string {
  try {
    // Ensure base URL ends with a slash if endpoint doesn't start with one
    let baseUrl = SPOONACULAR_BASE_URL;
    if (!baseUrl.endsWith('/') && !endpoint.startsWith('/')) {
      baseUrl += '/';
    } else if (baseUrl.endsWith('/') && endpoint.startsWith('/')) {
      // Remove duplicate slash
      endpoint = endpoint.substring(1);
    }
    
    const url = new URL(`${baseUrl}${endpoint}`);
    
    // Add API key first
    url.searchParams.append('apiKey', SPOONACULAR_API_KEY);
    
    // Add remaining parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  } catch (error) {
    console.error('Error creating Spoonacular URL:', error);
    // Fallback to string concatenation if URL constructor fails
    let urlString = `${SPOONACULAR_BASE_URL}${endpoint}?apiKey=${SPOONACULAR_API_KEY}`;
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlString += `&${key}=${encodeURIComponent(value)}`;
      }
    });
    return urlString;
  }
}

/**
 * Map app preferences to Spoonacular API parameters
 */
function mapPreferencesToApi(preferences: {
  dietary: DietaryPreferences;
  food: FoodPreferences;
  cooking: CookingPreferences;
  budget: BudgetPreferences;
}): Record<string, string | string[]> {
  const apiPreferences: Record<string, string | string[]> = {
    number: '50', // Get a good selection of recipes
    addRecipeInformation: 'true',
    fillIngredients: 'true',
    instructionsRequired: 'true',
  };

  // Map dietary preferences
  const diets: string[] = [];
  const intolerances: string[] = [];
  
  if (preferences.dietary.vegetarian) diets.push('vegetarian');
  if (preferences.dietary.vegan) diets.push('vegan');
  if (preferences.dietary.glutenFree) intolerances.push('gluten');
  if (preferences.dietary.dairyFree) intolerances.push('dairy');
  if (preferences.dietary.lowCarb) diets.push('low carb');
  
  // Add user's allergies as intolerances
  if (preferences.dietary.allergies && preferences.dietary.allergies.length > 0) {
    preferences.dietary.allergies.forEach(allergy => {
      // Map common allergies to Spoonacular's format
      const mappedAllergy = mapAllergyToIntolerance(allergy);
      if (mappedAllergy && !intolerances.includes(mappedAllergy)) {
        intolerances.push(mappedAllergy);
      }
    });
  }
  
  if (diets.length > 0) apiPreferences.diet = diets.join(',');
  if (intolerances.length > 0) apiPreferences.intolerances = intolerances.join(',');
  
  // Map excluded ingredients (disliked ingredients)
  if (preferences.food.dislikedIngredients && preferences.food.dislikedIngredients.length > 0) {
    apiPreferences.excludeIngredients = preferences.food.dislikedIngredients.join(',');
  }
  
  // Map cooking time preferences
  if (preferences.cooking.preferredCookingDuration) {
    switch (preferences.cooking.preferredCookingDuration) {
      case 'under_30_min':
        apiPreferences.maxReadyTime = '30';
        break;
      case '30_to_60_min':
        apiPreferences.maxReadyTime = '60';
        break;
      case 'over_60_min':
        // No max time for this preference
        break;
    }
  }

  // Include popular cuisines if user hasn't specified anything
  if (!apiPreferences.cuisine) {
    apiPreferences.cuisine = 'american,italian,mexican,asian,mediterranean';
  }
  
  return apiPreferences;
}

/**
 * Map common allergies to Spoonacular's intolerance format
 */
function mapAllergyToIntolerance(allergy: string): string | null {
  // Normalize the allergy string
  const normalizedAllergy = allergy.toLowerCase().trim();
  
  // Map to Spoonacular's supported intolerances
  const allergyMap: Record<string, string> = {
    'peanut': 'peanut',
    'peanuts': 'peanut',
    'tree nut': 'tree nut',
    'tree nuts': 'tree nut',
    'nut': 'tree nut',
    'nuts': 'tree nut',
    'shellfish': 'shellfish',
    'dairy': 'dairy',
    'milk': 'dairy',
    'egg': 'egg',
    'eggs': 'egg',
    'gluten': 'gluten',
    'wheat': 'gluten',
    'soy': 'soy',
    'seafood': 'seafood',
    'fish': 'seafood',
    'sesame': 'sesame',
    'mustard': 'mustard',
    'celery': 'celery',
    'sulfite': 'sulfite',
    'sulfites': 'sulfite',
    'corn': 'grain'
  };
  
  return allergyMap[normalizedAllergy] || null;
}

/**
 * Convert Spoonacular recipe to app Recipe format
 */
export function convertApiToRecipe(apiRecipe: SpoonacularRecipe): Recipe {
  // Generate appropriate tags based on API data
  const tags: string[] = [];
  
  // Map dietary tags
  if (apiRecipe.vegetarian) tags.push('vegetarian');
  if (apiRecipe.vegan) tags.push('vegan');
  if (apiRecipe.glutenFree) tags.push('gluten-free');
  if (apiRecipe.dairyFree) tags.push('dairy-free');
  
  // Map meal type tags from dishTypes
  if (apiRecipe.dishTypes) {
    if (apiRecipe.dishTypes.some(type => ['breakfast', 'brunch', 'morning meal'].includes(type.toLowerCase()))) {
      tags.push('breakfast');
    }
    if (apiRecipe.dishTypes.some(type => ['lunch', 'main course', 'main dish'].includes(type.toLowerCase()))) {
      tags.push('lunch');
    }
    if (apiRecipe.dishTypes.some(type => ['dinner', 'main course', 'main dish', 'supper'].includes(type.toLowerCase()))) {
      tags.push('dinner');
    }
    if (apiRecipe.dishTypes.some(type => ['snack', 'appetizer', 'side dish', 'finger food'].includes(type.toLowerCase()))) {
      tags.push('snacks');
    }
  }
  
  // If no meal type was identified, classify based on cooking time and ingredients
  if (!tags.some(tag => ['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag))) {
    // Default classification logic
    if (apiRecipe.readyInMinutes <= 15) {
      tags.push('snacks');
    } else if (apiRecipe.readyInMinutes <= 30) {
      tags.push('lunch');
    } else {
      tags.push('dinner');
    }
  }
  
  // Add any other relevant tags
  if (apiRecipe.cuisines) {
    apiRecipe.cuisines.forEach(cuisine => tags.push(cuisine.toLowerCase()));
  }
  
  if (apiRecipe.diets) {
    apiRecipe.diets.forEach(diet => {
      // Normalize diet names to match our tag format
      const normalizedDiet = diet.replace(/\s+/g, '-').toLowerCase();
      tags.push(normalizedDiet);
    });
  }
  
  // Create the recipe object in our app's format
  return {
    id: apiRecipe.id.toString(),
    name: apiRecipe.title,
    description: apiRecipe.summary 
      ? apiRecipe.summary.replace(/<\/?[^>]+(>|$)/g, '').substring(0, 150) + '...' 
      : 'A delicious recipe',
    prepTime: `${Math.round(apiRecipe.readyInMinutes / 3)} mins`, // Estimate prep time as 1/3 of total time
    cookTime: `${Math.round(apiRecipe.readyInMinutes * 2 / 3)} mins`, // Estimate cook time as 2/3 of total time
    servings: apiRecipe.servings,
    ingredients: apiRecipe.extendedIngredients 
      ? apiRecipe.extendedIngredients.map(ing => ({
          item: ing.name,
          measurement: `${ing.amount} ${ing.unit}`.trim()
        }))
      : [],
    instructions: apiRecipe.analyzedInstructions && apiRecipe.analyzedInstructions.length > 0
      ? apiRecipe.analyzedInstructions[0].steps.map(step => step.step)
      : ['No detailed instructions available'],
    tags: tags,
    estimatedCost: apiRecipe.pricePerServing / 25 // Convert from cents per serving to dollars per recipe
  };
}

// Helper function to handle network errors
function handleNetworkError(error: any, url: string): never {
  console.error('[NETWORK DEBUG] Detailed error information:', {
    message: error.message,
    code: error.code,
    type: error.type,
    stack: error.stack,
    url: url.replace(/apiKey=[^&]+/, 'apiKey=HIDDEN')
  });

  // Check for specific error types
  if (error.message.includes('SSL')) {
    console.error('[NETWORK DEBUG] SSL Error detected. Please check SSL configuration.');
    if (Platform.OS === 'ios') {
      console.error('[NETWORK DEBUG] iOS SSL Error - Check ATS configuration in Info.plist');
    }
  }

  if (error.message.includes('Network request failed')) {
    console.error('[NETWORK DEBUG] Network request failed. Possible causes:');
    console.error('1. No internet connection');
    console.error('2. SSL certificate issues');
    console.error('3. API endpoint is down');
    console.error('4. Firewall/proxy blocking');
  }

  throw error;
}

/**
 * Search for recipes using Spoonacular API
 * @returns Promise containing either the search results or throws an error with detailed information
 */
export async function searchRecipes(
  apiPreferences: Record<string, string | string[]>
): Promise<SearchRecipesResponse> {
  const queryParams: Record<string, string> = {};
  Object.entries(apiPreferences).forEach(([key, value]) => {
    queryParams[key] = Array.isArray(value) ? value.join(',') : value;
  });
  
  queryParams.apiKey = SPOONACULAR_API_KEY;

  const url = createSpoonacularUrl(`${SPOONACULAR_RECIPES_ENDPOINT}/complexSearch`, queryParams);
  console.log('[API DEBUG] Making Spoonacular API request to:', url.replace(/apiKey=[^&]+/, 'apiKey=HIDDEN'));

  try {
    console.log('[API DEBUG] Fetch options:', JSON.stringify({
      ...fetchOptions,
      method: 'GET',
    }));

    // Test the SSL connection first
    try {
      console.log('[API DEBUG] Testing SSL connection to:', SPOONACULAR_BASE_URL);
      await fetch(SPOONACULAR_BASE_URL, { method: 'HEAD' });
      console.log('[API DEBUG] SSL connection test successful');
    } catch (error: any) {
      console.error('[API DEBUG] SSL connection test failed:', error);
      throw new Error(`SSL Connection Failed: ${error.message}`);
    }

    const response = await fetch(url, {
      ...fetchOptions,
      method: 'GET',
    });

    console.log('[API DEBUG] Response status:', response.status);
    
    const headers: Record<string, string> = {};
    response.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });
    console.log('[API DEBUG] Response headers:', JSON.stringify(headers));

    if (response.status === 429) {
      const resetTime = response.headers.get('x-ratelimit-reset') 
        || response.headers.get('x-rate-limit-reset');
      throw new Error(`Rate limit exceeded. Reset time: ${resetTime}`);
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    
    // Log remaining rate limit info
    const remaining = response.headers.get('x-ratelimit-remaining');
    if (remaining) {
      console.log('[API DEBUG] Remaining API calls:', remaining);
    }

    return data as SearchRecipesResponse;
  } catch (error: any) {
    // Log the error with full context
    console.error('[API DEBUG] Error in searchRecipes:', {
      message: error.message,
      url: url.replace(/apiKey=[^&]+/, 'apiKey=HIDDEN'),
      preferences: apiPreferences,
      stack: error.stack
    });
    
    // Re-throw with additional context
    throw new Error(`Recipe search failed: ${error.message}`);
  }
}

/**
 * Get recipes with user-based caching
 */
export async function getRecipesWithCache(
  preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  }
): Promise<Recipe[]> {
  console.log('[Cache Debug] Starting getRecipesWithCache');
  
  // Generate a unique cache key based on user preferences
  const cacheKey = await generateCacheKey(preferences);
  const cacheFile = `${CACHE_DIR}/${cacheKey}.json`;
  
  console.log('[Cache Debug] Cache directory:', CACHE_DIR);
  console.log('[Cache Debug] Cache file:', cacheFile);
  
  try {
    // Ensure cache directory exists
    await ensureCacheDirectory();
    console.log('[Cache Debug] Cache directory ensured');
    
    // Check if cache exists and is valid
    const info = await FileSystem.getInfoAsync(cacheFile);
    console.log('[Cache Debug] Cache file exists:', info.exists);
    
    if (info.exists) {
      try {
        const cacheData = JSON.parse(await FileSystem.readAsStringAsync(cacheFile));
        console.log('[Cache Debug] Successfully read cache file');
        
        // If cache is still valid, use it
        const isValid = Date.now() - cacheData.timestamp < CACHE_EXPIRY;
        console.log('[Cache Debug] Cache validity:', isValid);
        
        if (isValid) {
          console.log('[Cache Debug] Using cached recipe data');
          return cacheData.recipes;
        }
      } catch (cacheError) {
        console.warn('[Cache Debug] Error reading cache:', cacheError);
        // Continue to API fetch if cache read fails
      }
    }
    
    // Cache expired or doesn't exist, fetch from API
    console.log('Fetching fresh recipe data from Spoonacular API');
    const apiPreferences = mapPreferencesToApi(preferences);
    
    // Add retries for network requests
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const response = await searchRecipes(apiPreferences);
        
        // Convert API recipes to our app format
        const recipes = response.results.map(convertApiToRecipe);
        
        // Save to cache only if we have recipes
        if (recipes.length > 0) {
          try {
            await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify({
              timestamp: Date.now(),
              recipes: recipes
            }));
            console.log(`Successfully fetched and cached ${recipes.length} recipes`);
          } catch (cacheError) {
            console.warn('Failed to write to cache:', cacheError);
            // Continue even if cache write fails
          }
        }
        
        return recipes;
      } catch (apiError: unknown) {
        retryCount++;
        if (retryCount === maxRetries) {
          throw new Error(`Failed to fetch recipes after ${maxRetries} attempts: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        }
        console.log(`Retry ${retryCount}/${maxRetries} after error:`, apiError);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
    
    throw new Error('Failed to fetch recipes after all retries');
  } catch (error) {
    console.error('Error in getRecipesWithCache:', error);
    
    // Try to return cached data even if expired as fallback
    try {
      const info = await FileSystem.getInfoAsync(cacheFile);
      if (info.exists) {
        const cacheData = JSON.parse(await FileSystem.readAsStringAsync(cacheFile));
        console.log('Returning expired cache data as fallback');
        return cacheData.recipes;
      }
    } catch (fallbackError) {
      console.error('Failed to read fallback cache:', fallbackError);
    }
    
    throw error;
  }
}

/**
 * Clear the recipe cache
 */
export async function clearRecipeCache(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(CACHE_DIR);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log('Cache directory cleared and recreated');
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}

// Add null checks in the cache-related functions
async function getCachedRecipes(cacheKey: string): Promise<Recipe[] | null> {
  try {
    if (!CACHE_DIR) {
      console.warn('Cache directory not available, skipping cache check');
      return null;
    }

    const cacheFile = `${CACHE_DIR}${cacheKey}.json`;
    const info = await FileSystem.getInfoAsync(cacheFile);
    
    if (!info.exists) {
      return null;
    }
    
    const content = await FileSystem.readAsStringAsync(cacheFile);
    const cached = JSON.parse(content);
    
    // Check if the cache is expired
    if (cached.timestamp && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
      return cached.recipes;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

async function cacheRecipes(cacheKey: string, recipes: Recipe[]): Promise<void> {
  try {
    if (!CACHE_DIR) {
      console.warn('Cache directory not available, skipping cache write');
      return;
    }
    
    const cacheFile = `${CACHE_DIR}${cacheKey}.json`;
    const cacheData = {
      recipes,
      timestamp: Date.now()
    };
    
    await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error writing cache:', error);
  }
} 