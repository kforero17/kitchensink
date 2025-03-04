import { Recipe } from '../contexts/MealPlanContext';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import { recipeDatabase } from '../data/recipeDatabase';
import { findAlternativeRecipe } from './mealPlanSelector';
import { 
  getDietaryPreferences, 
  getFoodPreferences, 
  getCookingPreferences, 
  getBudgetPreferences 
} from './preferences';
import logger from './logger';

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
    // Load user preferences
    const dietaryPrefs = await getDietaryPreferences();
    const foodPrefs = await getFoodPreferences();
    const cookingPrefs = await getCookingPreferences();
    const budgetPrefs = await getBudgetPreferences();
    
    if (!dietaryPrefs || !foodPrefs || !cookingPrefs || !budgetPrefs) {
      throw new Error('Failed to load user preferences');
    }
    
    // Find an alternative recipe
    const alternativeRecipe = await findAlternativeRecipe(
      recipeId,
      mealType,
      recipeDatabase,
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
  return recipe.tags.includes(mealType);
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
    
    // Filter eligible recipes of the requested meal type that aren't in the current meal plan
    const eligibleRecipes = recipeDatabase.filter(recipe => 
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