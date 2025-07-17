import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { getRecipesWithCache, clearRecipeCache } from '../utils/recipeApiService';
import { recipeDatabase } from '../data/recipeDatabase';
import { mockRecipes } from '../data/mockRecipes';
import { additionalMockRecipes, dessertMockRecipes } from '../data/mockRecipes';
import { allSeasonalRecipes } from '../data/seasonalRecipes';
import { checkConnectivity } from '../utils/networkUtils';
import logger from '../utils/logger';
import { getPantryItems } from './pantryService';
import { PantryItem } from '../types/PantryItem';

// Maximum retry attempts for API requests
const MAX_RETRY_ATTEMPTS = 2;
// Delay between retries in milliseconds
const RETRY_DELAY = 2000;

/**
 * Sleep function for async delay
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Service to manage recipe fetching from API or fallback to mock data
export class ApiRecipeService {
  // Flag to determine if we should use the API or mock data
  private useApi: boolean = true;
  
  // Flag to control cache clearing
  private clearCache: boolean = false;
  
  // Track API rate limiting
  private isRateLimited: boolean = false;
  private rateLimitResetTime: Date | null = null;
  
  constructor(options?: { useApi?: boolean, clearCache?: boolean }) {
    if (options) {
      this.useApi = options.useApi ?? true;
      this.clearCache = options.clearCache ?? false;
    }
  }
  
  /**
   * Get recipes based on user preferences - either from API or mock data
   */
  async getRecipes(
    preferences: {
      dietary: DietaryPreferences;
      food: FoodPreferences;
      cooking: CookingPreferences;
      budget: BudgetPreferences;
      usePantryItems?: boolean;
    },
    uid: string | null
  ): Promise<Recipe[]> {
    // Check if we're currently rate limited
    if (this.isRateLimited && this.rateLimitResetTime) {
      const now = new Date();
      if (now < this.rateLimitResetTime) {
        logger.debug('API is rate limited, using mock data instead');
        return this.getMockRecipes(uid, preferences.usePantryItems);
      } else {
        // Reset rate limiting if the time has passed
        this.resetRateLimiting();
      }
    }
    
    // Get available pantry items if requested and user is logged in
    let availablePantryIngredients: string[] = [];
    let pantryItems: PantryItem[] = [];
    if (preferences.usePantryItems && uid) {
      try {
        pantryItems = await getPantryItems(uid);
        availablePantryIngredients = pantryItems.map((item: PantryItem) => item.name.toLowerCase());
        logger.debug(`Found ${availablePantryIngredients.length} pantry items for recipe generation`);
      } catch (error) {
        logger.error('Error getting pantry items for recipe generation:', error);
      }
    }
    
    // If we should use the API and not in mock mode
    if (this.useApi) {
      try {
        // Check for connectivity first
        const hasConnectivity = await checkConnectivity();
        if (!hasConnectivity) {
          logger.debug('No internet connectivity detected, falling back to mock data');
          return this.getMockRecipes(uid, preferences.usePantryItems);
        }
        
        // Clear cache if requested
        if (this.clearCache) {
          logger.debug('Clearing recipe cache before fetching');
          await clearRecipeCache();
        }
        
        // Prepare API request with pantry items if available
        const apiPreferences = { ...preferences };
        if (preferences.usePantryItems && availablePantryIngredients.length > 0) {
          // Add pantry ingredients to the API request
          // The API implementation would need to be updated to handle this
          (apiPreferences as any).availablePantryIngredients = availablePantryIngredients;
        }
        
        // Fetch recipes from API with cache support
        logger.debug('Fetching recipes from API with preferences:', apiPreferences);
        const recipes = await getRecipesWithCache(apiPreferences) as Recipe[];

        // --- NEW: If caller specified mealTypes in cooking prefs, filter results ---
        if (preferences.cooking && Array.isArray(preferences.cooking.mealTypes) && preferences.cooking.mealTypes.length > 0) {
          const desiredTypes = new Set(preferences.cooking.mealTypes);
          const typeFiltered = recipes.filter(r => r.tags.some(t => desiredTypes.has(t as any)));
          // Only use filtered set if we still have a reasonable pool (≥25% of original or at least 30)
          if (typeFiltered.length > 0 && (typeFiltered.length >= Math.min(30, recipes.length * 0.25))) {
            logger.debug(`Filtered recipes by desired meal types [${[...desiredTypes].join(', ')}]: ${typeFiltered.length}/${recipes.length}`);
            // Replace original list with filtered
            (apiPreferences as any)._filteredByTypes = [...desiredTypes]; // debug marker
            recipes.splice(0, recipes.length, ...typeFiltered);
          } else {
            logger.debug('Meal-type filtering skipped (not enough results)');
          }
        }

        // If pantry items should be prioritized, sort recipes by ingredient match
        let processedRecipes = [...recipes];
        if (preferences.usePantryItems && availablePantryIngredients.length > 0) {
          processedRecipes = this.prioritizeRecipesByPantryItems(
            recipes, 
            availablePantryIngredients
          );
        }
        
        logger.debug(`Successfully fetched ${processedRecipes.length} recipes from API`);
        return processedRecipes;
      } catch (error) {
        // Handle specific API errors
        if (error instanceof Error) {
          // Check for rate limiting
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            logger.error('API rate limit exceeded:', error);
            this.isRateLimited = true;
            
            // Reset after 1 hour
            const resetTime = new Date();
            resetTime.setHours(resetTime.getHours() + 1);
            this.rateLimitResetTime = resetTime;
            
            logger.debug('Falling back to mock data due to rate limiting');
          } else {
            // Log other API errors
            logger.error('API request failed:', error);
          }
        } else {
          logger.error('Unknown API error:', error);
        }
        
        // Fall back to mock data on any error
        logger.debug('Using mock data due to API error');
        return this.getMockRecipes(uid, preferences.usePantryItems);
      }
    }
    
    // If API is disabled, use mock data
    logger.debug('API usage is disabled, using mock data');
    return this.getMockRecipes(uid, preferences.usePantryItems);
  }
  
  /**
   * Get mock recipe data as fallback
   */
  getMockRecipes(uid: string | null, usePantryItems?: boolean): Promise<Recipe[]> {
    return new Promise(async (resolve) => {
      // Get base recipe data
      const mockRecipeData = [...recipeDatabase];
      logger.debug(`Using ${mockRecipeData.length} mock recipes`);
      
      // If not using pantry items or no user, return as is
      if (!usePantryItems || !uid) {
        resolve(mockRecipeData);
        return;
      }
      
      // Initialize pantryItems and availablePantryIngredients here
      let pantryItems: PantryItem[] = []; 
      let availablePantryIngredients: string[] = [];

      try {
        pantryItems = await getPantryItems(uid); 
        availablePantryIngredients = pantryItems.map((item: PantryItem) => item.name.toLowerCase());
        
        if (availablePantryIngredients.length === 0) {
          resolve(mockRecipeData);
          return;
        }
        
        // Prioritize recipes by pantry item match
        const prioritizedRecipes = this.prioritizeRecipesByPantryItems(
          mockRecipeData, 
          availablePantryIngredients
        );
        
        resolve(prioritizedRecipes);
      } catch (error) {
        logger.error('Error prioritizing mock recipes by pantry items:', error);
        resolve(mockRecipeData);
      }
    });
  }
  
  /**
   * Prioritize recipes based on how many pantry ingredients they use
   * @param recipes List of recipes to prioritize
   * @param pantryIngredients List of available pantry ingredients
   * @returns Sorted list of recipes with pantry match count
   */
  private prioritizeRecipesByPantryItems(
    recipes: Recipe[], 
    pantryIngredients: string[]
  ): Recipe[] {
    // Skip if no pantry ingredients
    if (pantryIngredients.length === 0) return recipes;
    
    // Calculate pantry match score for each recipe
    const recipesWithScore = recipes.map(recipe => {
      // Extract ingredient names, handling different formats
      const ingredients = (recipe.ingredients as any[]).map((ing: any) => {
        if (typeof ing === 'string') {
          return ing.toLowerCase();
        }
        if (ing && ing.item) {
          return String(ing.item).toLowerCase();
        }
        if (ing && ing.name) {
          return String(ing.name).toLowerCase();
        }
        return '';
      }).filter((ing: string) => ing !== '');
      
      // Count how many pantry items are used in this recipe
      const pantryMatchCount = ingredients.filter(ingredient => 
        pantryIngredients.some(pantryItem => 
          ingredient.includes(pantryItem) || pantryItem.includes(ingredient)
        )
      ).length;
      
      // Calculate a match percentage (how much of the recipe is from pantry)
      const matchPercentage = ingredients.length > 0 
        ? (pantryMatchCount / ingredients.length) * 100 
        : 0;
      
      return {
        recipe,
        pantryMatchCount,
        matchPercentage,
      };
    });
    
    // Sort by match percentage (highest first)
    recipesWithScore.sort((a, b) => b.matchPercentage - a.matchPercentage);
    
    // Add match info to recipe metadata and return sorted recipes
    return recipesWithScore.map(item => {
      const enhancedRecipe = { ...item.recipe } as Recipe & { metadata?: any };
      
      // Initialize metadata if it doesn't exist
      if (!enhancedRecipe.metadata) {
        enhancedRecipe.metadata = {};
      }
      
      // Add pantry match info to metadata
      enhancedRecipe.metadata.pantryMatchCount = item.pantryMatchCount;
      enhancedRecipe.metadata.pantryMatchPercentage = Math.round(item.matchPercentage);
      
      return enhancedRecipe;
    });
  }
  
  /**
   * Set whether to use the API or mock data
   */
  setUseApi(useApi: boolean): void {
    this.useApi = useApi;
  }
  
  /**
   * Set whether to clear the cache on next request
   */
  setClearCache(clearCache: boolean): void {
    this.clearCache = clearCache;
  }
  
  /**
   * Manually reset rate limiting
   */
  resetRateLimiting(): void {
    this.isRateLimited = false;
    this.rateLimitResetTime = null;
    logger.debug('Rate limiting manually reset');
  }
}

// Export a singleton instance for use throughout the app
export const apiRecipeService = new ApiRecipeService(); 