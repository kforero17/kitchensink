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
  async getRecipes(preferences: {
    dietary: DietaryPreferences;
    food: FoodPreferences;
    cooking: CookingPreferences;
    budget: BudgetPreferences;
  }): Promise<Recipe[]> {
    // Check if we're currently rate limited
    if (this.isRateLimited && this.rateLimitResetTime) {
      const now = new Date();
      if (now < this.rateLimitResetTime) {
        logger.debug('API is rate limited, using mock data instead');
        return this.getMockRecipes();
      } else {
        // Reset rate limiting if the time has passed
        this.resetRateLimiting();
      }
    }
    
    // If we should use the API and not in mock mode
    if (this.useApi) {
      try {
        // Check for connectivity first
        const hasConnectivity = await checkConnectivity();
        if (!hasConnectivity) {
          logger.debug('No internet connectivity detected, falling back to mock data');
          return this.getMockRecipes();
        }
        
        // Clear cache if requested
        if (this.clearCache) {
          logger.debug('Clearing recipe cache before fetching');
          await clearRecipeCache();
        }
        
        // Fetch recipes from API with cache support
        logger.debug('Fetching recipes from API with preferences:', preferences);
        const recipes = await getRecipesWithCache(preferences);
        logger.debug(`Successfully fetched ${recipes.length} recipes from API`);
        return recipes;
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
        return this.getMockRecipes();
      }
    }
    
    // If API is disabled, use mock data
    logger.debug('API usage is disabled, using mock data');
    return this.getMockRecipes();
  }
  
  /**
   * Get mock recipe data as fallback
   */
  getMockRecipes(): Recipe[] {
    logger.debug(`Using ${recipeDatabase.length} mock recipes`);
    return [...recipeDatabase];
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