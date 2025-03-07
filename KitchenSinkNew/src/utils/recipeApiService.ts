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
import { secureFetch, createSecureSpoonacularUrl } from './certificateHelper';
import { isProxyAvailable, getProxiedUrl } from './proxyConfig';
import logger from './logger';

// Read config from env file
const SPOONACULAR_API_KEY = env.SPOONACULAR_API_KEY;
const SPOONACULAR_BASE_URL = env.SPOONACULAR_BASE_URL;
const SPOONACULAR_RECIPES_ENDPOINT = env.SPOONACULAR_RECIPES_ENDPOINT;

// Cache configuration
// Define cache directory with strict type checking
const CACHE_DIR = FileSystem.documentDirectory ? `${FileSystem.documentDirectory}cache/recipes/` : '';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// App start timestamp to force cache refresh on reload
const APP_START_TIME = Date.now();

// For SSL certification bypass
const fetchOptions = {
  headers: {
    'X-Debug-Request-Id': `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  // Add iOS-specific configuration to bypass SSL validation with corporate VPN
  ...(Platform.OS === 'ios' && {
    // @ts-ignore - iOS specific properties
    NSURLRequest: {
      allowsCellularAccess: true,
      TLSValidationEnabled: false, // Disable TLS validation for corporate VPN
    }
  })
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

  // Map meal type preferences to API type parameter
  if (preferences.cooking.mealTypes && preferences.cooking.mealTypes.length > 0) {
    // Convert our meal types to Spoonacular's type parameter
    const mealTypeMapping: Record<string, string> = {
      'breakfast': 'breakfast',
      'lunch': 'main course,lunch',
      'dinner': 'main course,dinner',
      'snacks': 'snack,appetizer,side dish,fingerfood'
    };
    
    const types: string[] = [];
    preferences.cooking.mealTypes.forEach(mealType => {
      if (mealTypeMapping[mealType]) {
        types.push(mealTypeMapping[mealType]);
      }
    });
    
    if (types.length > 0) {
      apiPreferences.type = types.join(',');
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
 * Helper function to decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
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
  
  // Determine PRIMARY meal type (only one) based on dishTypes
  let primaryMealType: string | null = null;
  
  // Track the presence of dish types for better categorization
  let hasDishTypes = false;
  
  if (apiRecipe.dishTypes && apiRecipe.dishTypes.length > 0) {
    hasDishTypes = true;
    
    // Prioritized meal type mapping
    const mealTypeChecks = [
      { check: (types: string[]) => types.some(type => ['breakfast', 'brunch', 'morning meal'].includes(type.toLowerCase())), 
        result: 'breakfast' },
      { check: (types: string[]) => types.some(type => ['lunch'].includes(type.toLowerCase())), 
        result: 'lunch' },
      { check: (types: string[]) => types.some(type => ['dinner', 'supper'].includes(type.toLowerCase())), 
        result: 'dinner' },
      { check: (types: string[]) => types.some(type => ['main course', 'main dish'].includes(type.toLowerCase())), 
        result: 'dinner' }, // Default main course to dinner unless already assigned lunch
      { check: (types: string[]) => types.some(type => ['snack', 'appetizer', 'side dish', 'finger food'].includes(type.toLowerCase())), 
        result: 'snacks' }
    ];
    
    // Find the first matching meal type based on priority
    for (const { check, result } of mealTypeChecks) {
      if (check(apiRecipe.dishTypes)) {
        primaryMealType = result;
        break;
      }
    }
  }
  
  // If no meal type was identified from dish types, classify based on cooking time and name
  if (!primaryMealType) {
    if (!hasDishTypes) {
      logger.debug(`Recipe ${apiRecipe.id} has no dish types, assigning based on other factors`);
    }
    
    // Check recipe title for clues
    const title = apiRecipe.title.toLowerCase();
    if (title.includes('breakfast') || title.includes('brunch') || title.includes('pancake') || 
        title.includes('waffle') || title.includes('oatmeal') || title.includes('cereal')) {
      primaryMealType = 'breakfast';
    } 
    else if (title.includes('soup') || title.includes('salad') || title.includes('sandwich') || 
             title.includes('wrap') || title.includes('lunch')) {
      primaryMealType = 'lunch';
    }
    else if (title.includes('snack') || title.includes('appetizer') || title.includes('dip') || 
             title.includes('finger food')) {
      primaryMealType = 'snacks';
    }
    else {
      // Default based on cooking time if no other clues
      if (apiRecipe.readyInMinutes <= 15) {
        primaryMealType = 'snacks';
      } else if (apiRecipe.readyInMinutes <= 30) {
        primaryMealType = 'lunch';
      } else {
        primaryMealType = 'dinner';
      }
    }
  }
  
  // Add the primary meal type as the FIRST tag (important for filtering)
  // CRITICAL: The first tag is used for strict meal type matching in the app
  // When filtering for breakfast recipes, only recipes with breakfast as the first tag will be included
  tags.unshift(primaryMealType);
  
  // Always add all possible meal types the recipe fits as additional tags (after the primary)
  // These secondary tags are no longer used for filtering but kept for informational purposes
  if (apiRecipe.dishTypes) {
    if (apiRecipe.dishTypes.some(type => ['breakfast', 'brunch', 'morning meal'].includes(type.toLowerCase())) && 
        primaryMealType !== 'breakfast') {
      tags.push('breakfast');
    }
    if (apiRecipe.dishTypes.some(type => ['lunch', 'main course', 'main dish'].includes(type.toLowerCase())) && 
        primaryMealType !== 'lunch') {
      tags.push('lunch');
    }
    if (apiRecipe.dishTypes.some(type => ['dinner', 'supper', 'main course', 'main dish'].includes(type.toLowerCase())) && 
        primaryMealType !== 'dinner') {
      tags.push('dinner');
    }
    if (apiRecipe.dishTypes.some(type => ['snack', 'appetizer', 'side dish', 'finger food'].includes(type.toLowerCase())) && 
        primaryMealType !== 'snacks') {
      tags.push('snacks');
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
      ? decodeHtmlEntities(apiRecipe.summary.replace(/<\/?[^>]+(>|$)/g, ''))
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
  const sanitizedUrl = url.replace(/apiKey=[^&]+/, 'apiKey=HIDDEN');
  console.log('[API DEBUG] Making Spoonacular API request to:', sanitizedUrl);

  // Determine available connection methods
  const methods = await getAvailableConnectionMethods();
  console.log('[API DEBUG] Available connection methods:', methods);

  // Track errors for better debugging
  const errors: any[] = [];
  
  // Try multiple approaches in sequence with backoff
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[API DEBUG] Attempt ${attempt}/${maxRetries}`);
    
    try {
      // Try with proxy if available
      if (methods.proxyAvailable) {
        console.log('[API DEBUG] Attempting with proxy server');
        try {
          const proxiedUrl = getProxiedUrl(url);
          
          // Log the proxied URL for debugging (hiding API key)
          const sanitizedProxiedUrl = proxiedUrl.replace(/apiKey=[^&]+/, 'apiKey=HIDDEN');
          console.log('[API DEBUG] Using proxied URL:', sanitizedProxiedUrl);
          
          const response = await fetch(proxiedUrl);
          console.log('[API DEBUG] Proxy response status:', response.status);
          
          if (response.ok) {
            // Get text first to debug any JSON parsing issues
            const responseText = await response.text();
            console.log('[API DEBUG] Response text length:', responseText.length);
            console.log('[API DEBUG] First 100 chars:', responseText.substring(0, 100));
            
            try {
              const data = JSON.parse(responseText);
              
              // Validate response structure
              if (!data.hasOwnProperty('results')) {
                console.warn('[API DEBUG] Invalid response structure:', data);
                throw new Error('Invalid response structure: missing results property');
              }
              
              console.log('[API DEBUG] Proxy method successful');
              return data as SearchRecipesResponse;
            } catch (jsonError) {
              console.warn('[API DEBUG] Failed to parse JSON from proxy response:', jsonError);
              throw jsonError;
            }
          } else {
            console.warn(`[API DEBUG] Proxy request failed: ${response.status}`);
          }
        } catch (proxyError) {
          console.warn('[API DEBUG] Proxy request error:', proxyError);
          errors.push({ method: 'proxy', error: proxyError });
        }
      }
      
      // Try with secure fetch (certificate bypass)
      console.log('[API DEBUG] Attempting with secure fetch');
      try {
        const secureResponse = await secureFetch<SearchRecipesResponse>(url, {
          method: 'GET',
        });
        
        if (secureResponse.data) {
          // Validate response structure
          if (!secureResponse.data.hasOwnProperty('results')) {
            console.warn('[API DEBUG] Invalid secure response structure:', secureResponse.data);
            throw new Error('Invalid response structure: missing results property');
          }
          
          console.log('[API DEBUG] Secure fetch successful');
          return secureResponse.data;
        } else {
          console.warn('[API DEBUG] Secure fetch failed:', secureResponse.error);
          errors.push({ method: 'secureFetch', error: secureResponse.error });
        }
      } catch (secureError) {
        console.warn('[API DEBUG] Secure fetch error:', secureError);
        errors.push({ method: 'secureFetch', error: secureError });
      }
      
      // Last resort: standard fetch with all options
      console.log('[API DEBUG] Attempting with standard fetch + options');
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('[API DEBUG] Standard fetch successful');
          return data as SearchRecipesResponse;
        } else {
          console.warn(`[API DEBUG] Standard fetch failed: ${response.status}`);
          errors.push({ 
            method: 'standard', 
            status: response.status, 
            statusText: response.statusText 
          });
        }
      } catch (standardError) {
        console.warn('[API DEBUG] Standard fetch error:', standardError);
        errors.push({ method: 'standard', error: standardError });
      }
      
      // If we reach here, all methods failed on this attempt
      console.warn(`[API DEBUG] All connection methods failed on attempt ${attempt}`);
      
      // Exponential backoff before retry
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.log(`[API DEBUG] Retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } catch (attemptError) {
      console.error('[API DEBUG] Unexpected error during attempt:', attemptError);
      errors.push({ method: 'overall', error: attemptError });
      
      // Still apply backoff for unexpected errors
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // If we reach here, all attempts failed
  console.error('[API DEBUG] All attempts failed. Consolidated errors:', errors);
  
  // Throw a comprehensive error with all information
  throw new Error(`API request failed after ${maxRetries} attempts: ${
    errors.map(e => e.error?.message || e.status || 'Unknown error').join(', ')
  }`);
}

/**
 * Determine which connection methods are available
 */
async function getAvailableConnectionMethods(): Promise<{
  proxyAvailable: boolean;
}> {
  let proxyAvailable = false;
  
  try {
    proxyAvailable = await isProxyAvailable();
  } catch (error) {
    console.warn('[API DEBUG] Error checking proxy availability:', error);
  }
  
  return {
    proxyAvailable
  };
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
        
        // Check if cache was created in the current app session and is still valid
        const isValid = cacheData.timestamp > APP_START_TIME && 
                       Date.now() - cacheData.timestamp < CACHE_EXPIRY;
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
    
    // Cache expired, doesn't exist, or is from previous session, fetch from API
    console.log('Fetching fresh recipe data from Spoonacular API');
    const apiPreferences = mapPreferencesToApi(preferences);
    
    // Add retries for network requests
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const response = await searchRecipes(apiPreferences);
        
        // Defensive check for response and results
        if (!response) {
          throw new Error('Received null or undefined response from API');
        }
        
        if (!response.results || !Array.isArray(response.results)) {
          console.error('[API DEBUG] Invalid response structure:', response);
          throw new Error('Invalid API response: results property is missing or not an array');
        }
        
        console.log(`[API DEBUG] API returned ${response.results.length} recipes`);
        
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
        } else {
          console.warn('[API DEBUG] API returned zero recipes, not caching');
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