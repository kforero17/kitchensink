import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { findAlternativeRecipe } from './mealPlanSelector';
import { 
  getDietaryPreferences, 
  getFoodPreferences, 
  getCookingPreferences, 
  getBudgetPreferences 
} from './preferences';
import { apiRecipeService } from '../services/apiRecipeService';
import logger from './logger';
import { recordRecipeSwap, getRecentSwappedRecipes } from './recipeHistory';
import auth from '@react-native-firebase/auth';
import { isCondimentRecipe } from './mealPlanSelector';

/**
 * Handles swapping a recipe with a suitable alternative of the same meal type
 * @param recipeId - The ID of the recipe to swap
 * @param mealType - The meal type (breakfast, lunch, dinner, snacks)
 * @param currentMealPlan - The current meal plan
 * @returns The new recipe, or null if no suitable alternative was found
 */
export async function swapRecipe(
  recipeId: string,
  mealType: string,
  currentMealPlan: Recipe[]
): Promise<Recipe | null> {
  try {
    logger.debug(`Attempting to swap recipe ${recipeId} of type ${mealType}`);
    
    // Handle the special combined lunch_dinner type
    if (mealType === 'lunch_dinner') {
      // Find the original recipe to determine if it's lunch or dinner
      const recipe = currentMealPlan.find(r => r.id === recipeId);
      if (recipe) {
        if (recipe.tags.includes('lunch')) {
          mealType = 'lunch';
        } else if (recipe.tags.includes('dinner')) {
          mealType = 'dinner';
        }
      }
    }
    
    // Load required preferences
    const dietaryPrefs = await getDietaryPreferences();
    const foodPrefs = await getFoodPreferences();
    const cookingPrefs = await getCookingPreferences();
    const budgetPrefs = await getBudgetPreferences();
    
    if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
      throw new Error('Failed to load user preferences');
    }

    // Force clear cache to get fresh recipes
    apiRecipeService.setClearCache(true);
    
    const uid = auth().currentUser?.uid ?? null;
    
    // Fetch new recipes from API
    const recipes = await apiRecipeService.getRecipes({
      dietary: dietaryPrefs,
      food: foodPrefs,
      cooking: cookingPrefs,
      budget: budgetPrefs
    }, uid);
    
    // Exclude recently swapped recipes to avoid showing them again too soon
    const recentlySwapped = await getRecentSwappedRecipes();
    const filteredRecipes = recipes
      .filter(r => !recentlySwapped.includes(r.id))
      .filter(r => !isCondimentRecipe(r));
    
    // Find an alternative recipe
    const alternativeRecipe = await findAlternativeRecipe(
      recipeId,
      mealType,
      filteredRecipes, // Use filtered recipes list
      currentMealPlan,
      {
        dietary: dietaryPrefs,
        food: foodPrefs,
        cooking: cookingPrefs,
        budget: budgetPrefs
      }
    );
    
    if (!alternativeRecipe) {
      logger.debug(`No alternative recipe found for ${recipeId} of type ${mealType}`);
      return null;
    }
    
    logger.debug(`Swapping recipe ${recipeId} with ${alternativeRecipe.id}`);
    
    // Record the recipe that the user swapped out so we can avoid it in future generations
    await recordRecipeSwap(recipeId);
    
    return alternativeRecipe;
  } catch (error) {
    logger.error('Error in swapRecipe:', error);
    return null;
  }
}

/**
 * Validates that the provided meal type matches the recipe's tags
 * Useful for ensuring we're swapping the correct type of recipe
 */
export function validateMealType(recipe: Recipe, mealType: string): boolean {
  // Handle the combined lunch_dinner category
  if (mealType === 'lunch_dinner') {
    return recipe.tags.includes('lunch') || recipe.tags.includes('dinner');
  }
  
  // Check if this meal type is the primary meal type (first tag)
  return recipe.tags.length > 0 && recipe.tags[0] === mealType;
}

/**
 * Gets all alternative recipes for a given meal type
 * Useful for displaying a list of alternatives to the user
 */
export async function getAlternativeRecipes(
  mealType: string,
  currentMealPlan: Recipe[],
  limit: number = 5
): Promise<Recipe[]> {
  try {
    // Handle the combined lunch_dinner category
    if (mealType === 'lunch_dinner') {
      // We'll show a mix of lunch and dinner alternatives
      const lunchAlternatives = await getAlternativeRecipes('lunch', currentMealPlan, Math.ceil(limit/2));
      const dinnerAlternatives = await getAlternativeRecipes('dinner', currentMealPlan, Math.ceil(limit/2));
      
      // Combine and limit the results
      return [...lunchAlternatives, ...dinnerAlternatives].slice(0, limit);
    }
    
    // Get API service
    const recipeService = apiRecipeService;
    
    // Load user preferences
    const dietaryPrefs = await getDietaryPreferences();
    const foodPrefs = await getFoodPreferences();
    const cookingPrefs = await getCookingPreferences();
    const budgetPrefs = await getBudgetPreferences();
    
    if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
      throw new Error('Failed to load user preferences');
    }
    
    // Get current recipe IDs to exclude them
    const currentIds = currentMealPlan.map(recipe => recipe.id);
    
    // Force clear cache to get fresh recipes
    apiRecipeService.setClearCache(true);
    
    const uid = auth().currentUser?.uid ?? null;
    
    // Fetch recipes from API
    const recipes = await apiRecipeService.getRecipes({
      dietary: dietaryPrefs,
      food: foodPrefs,
      cooking: cookingPrefs,
      budget: budgetPrefs
    }, uid);
    
    // Filter eligible recipes of the requested meal type that aren't in the current meal plan
    const eligibleRecipes = recipes.filter(recipe => 
      recipe.tags.includes(mealType) &&
      !currentIds.includes(recipe.id)
    );
    
    // Return the top recipes based on the limit
    return eligibleRecipes.slice(0, limit);
  } catch (error) {
    logger.error('Error getting alternative recipes:', error);
    return [];
  }
} 