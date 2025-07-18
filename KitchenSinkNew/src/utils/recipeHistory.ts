import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../contexts/MealPlanContext';
import logger from './logger';
import auth from '@react-native-firebase/auth';
import { firestoreService } from '../services/firebaseService';
import { safeStorage } from './asyncStorageUtils';

const RECIPE_HISTORY_KEY = 'recipe_history';
const MAX_HISTORY_ITEMS = 100;

// Key to track recently swapped recipes
const SWAPPED_RECIPES_KEY = 'swapped_recipes';
// Store more than needed to give buffer; we will filter by limit when retrieving
const MAX_SWAPPED_ITEMS = 50;

// Define history item structure
export interface RecipeHistoryItem {
  recipeId: string;
  usedDate: string;
  mealType: string;
}

/**
 * Gets the recipe usage history from storage
 */
export async function getRecipeHistory(): Promise<RecipeHistoryItem[]> {
  try {
    // Use safeStorage instead of AsyncStorage directly
    const historyData = await safeStorage.getItem(RECIPE_HISTORY_KEY);
    if (!historyData) {
      return [];
    }
    
    return JSON.parse(historyData) as RecipeHistoryItem[];
  } catch (error) {
    logger.error('Error retrieving recipe history:', error);
    return [];
  }
}

/**
 * Records the usage of a recipe for a meal type
 */
export async function recordRecipeUsage(
  recipeId: string,
  mealType: string
): Promise<boolean> {
  try {
    // Get current history using safeStorage
    const historyData = await safeStorage.getItem(RECIPE_HISTORY_KEY);
    const history = historyData ? JSON.parse(historyData) as RecipeHistoryItem[] : [];
    
    // Create new history item
    const newItem: RecipeHistoryItem = {
      recipeId,
      usedDate: new Date().toISOString(),
      mealType
    };
    
    // Add to history (newest first)
    const updatedHistory = [newItem, ...history];
    
    // Trim history if it gets too long
    if (updatedHistory.length > MAX_HISTORY_ITEMS) {
      updatedHistory.length = MAX_HISTORY_ITEMS;
    }
    
    // Always save to safeStorage first
    await safeStorage.setItem(RECIPE_HISTORY_KEY, JSON.stringify(updatedHistory));
    
    // If authenticated, also try to save to Firestore
    if (auth().currentUser) {
      try {
        // Save to Firestore if we implement this feature in the future
        // This would require adding a recipeHistory collection to the Firestore schema
      } catch (firestoreError) {
        logger.error('Error recording recipe usage to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error recording recipe usage:', error);
    return false;
  }
}

/**
 * Calculates a penalty score for recipe variety based on usage history
 * Higher penalty means the recipe has been used more recently or frequently
 */
export function calculateVarietyPenalty(recipeId: string, history: RecipeHistoryItem[]): number {
  // If no history, no penalty
  if (history.length === 0) return 0;
  
  // Count occurrences of this recipe
  const occurrences = history.filter(h => h.recipeId === recipeId).length;
  
  // Find most recent usage (if any)
  const recentUsage = history.find(h => h.recipeId === recipeId);
  
  if (!recentUsage) return 0;
  
  // Calculate days since last use
  const lastUsedDate = new Date(recentUsage.usedDate);
  const daysSinceLastUse = Math.ceil(
    (Date.now() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  // Higher penalty for recent or frequent use
  const recencyPenalty = Math.max(0, 30 - daysSinceLastUse);
  const frequencyPenalty = occurrences * 10;
  
  return Math.min(100, recencyPenalty + frequencyPenalty);
}

/**
 * Gets the count of how many times a recipe has been used for a specific meal type
 */
export function getRecipeUsageCountByMealType(
  recipeId: string, 
  mealType: string, 
  history: RecipeHistoryItem[]
): number {
  return history.filter(h => h.recipeId === recipeId && h.mealType === mealType).length;
}

/**
 * Records an entire meal plan in the history
 */
export async function recordMealPlan(
  recipes: Recipe[]
): Promise<boolean> {
  try {
    // Group recipes by their tags (to determine meal type)
    const mealTypePromises = recipes.map(recipe => {
      const mealType = recipe.tags.find(tag => 
        ['breakfast', 'lunch', 'dinner', 'snacks'].includes(tag)
      ) || 'other';
      
      return recordRecipeUsage(recipe.id, mealType);
    });
    
    await Promise.all(mealTypePromises);
    return true;
  } catch (error) {
    logger.error('Error recording meal plan:', error);
    return false;
  }
}

/**
 * Save the current meal plan to storage
 * Uses Firestore if the user is authenticated, AsyncStorage if not
 * @param recipes Array of recipes in the current meal plan
 * @param replaceExisting If true, will reset all weekly meal plan flags before saving (default: true)
 * @returns Promise resolving to boolean indicating success
 */
export async function saveMealPlanToFirestore(
  recipes: Recipe[],
  replaceExisting: boolean = true
): Promise<boolean> {
  try {
    // First record the meal plan usage locally
    await recordMealPlan(recipes);
    
    // Save recipes to local storage as well
    const MEAL_PLAN_KEY = 'current_meal_plan';
    await safeStorage.setItem(MEAL_PLAN_KEY, JSON.stringify(recipes));
    
    // If authenticated, also save to Firestore
    if (auth().currentUser) {
      try {
        console.log(`Starting to save ${recipes.length} selected recipes to profile as weekly meal plan`);
        
        // Generate operation ID to track this specific save operation
        const operationId = Math.random().toString(36).substring(2, 10);
        console.log(`Save operation ID: ${operationId}`);
        
        // First create a list of recipe names for debugging
        const recipeNames = recipes.map(r => r.name);
        console.log(`Saving recipes with names: ${recipeNames.join(', ')} [OP: ${operationId}]`);
        
        // Reset all weekly meal plan flags if replacing existing selections
        if (replaceExisting) {
          console.log('Resetting all weekly meal plan flags before saving new selections...');
          await firestoreService.resetAllWeeklyMealPlanFlags();
          console.log('Flags reset complete. Now saving selected recipes...');
        } else {
          console.log('Appending to existing weekly meal plan without resetting flags.');
        }
        
        // Then save each recipe to the user's collection
        const savedRecipes = await Promise.all(
          recipes.map(async (recipe) => {
            // Transform Recipe to RecipeDocument format
            const recipeDoc = {
              name: recipe.name,
              servings: recipe.servings,
              readyInMinutes: parseInt(recipe.prepTime || '0') + parseInt(recipe.cookTime || '0'),
              ingredients: recipe.ingredients.map(ing => ({
                name: ing.item,
                amount: 1, // Default amount
                unit: ing.measurement,
                originalString: `${ing.measurement} ${ing.item}`
              })),
              instructions: recipe.instructions.map((inst, index) => ({
                number: index + 1,
                instruction: inst
              })),
              imageUrl: recipe.imageUrl,
              tags: recipe.tags || [],
              isFavorite: true, // Mark as favorite by default since the user selected these
              isWeeklyMealPlan: true, // Mark as part of the weekly meal plan
              summary: recipe.description || '',
              sourceUrl: '',
              cuisines: [],
              diets: [],
              dishTypes: []
            };
            
            // Save to Firestore
            console.log(`Saving recipe: ${recipe.name} [OP: ${operationId}]`);
            return await firestoreService.saveRecipe(recipeDoc);
          })
        );
        
        // Verify all recipes were saved
        const successCount = savedRecipes.filter(id => id !== null).length;
        console.log(`Successfully saved ${successCount}/${recipes.length} recipes [OP: ${operationId}]`);
        
        // Return true if all recipes were saved successfully
        return savedRecipes.every(id => id !== null);
      } catch (firestoreError) {
        logger.error('Error saving recipes to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
        return true;
      }
    }
    
    // If not authenticated, we've still saved locally
    return true;
  } catch (error) {
    logger.error('Error saving meal plan:', error);
    return false;
  }
}

/**
 * Records a recipe that the user swapped out. This ensures the same recipe
 * will not re-appear for the next several swaps / generations.
 * We keep the list in most-recent-first order capped at MAX_SWAPPED_ITEMS.
 */
export async function recordRecipeSwap(recipeId: string): Promise<boolean> {
  try {
    const data = await safeStorage.getItem(SWAPPED_RECIPES_KEY);
    const swapped: string[] = data ? JSON.parse(data) as string[] : [];

    // Put the new recipeId at the beginning, removing duplicates
    const updated = [recipeId, ...swapped.filter(id => id !== recipeId)];

    if (updated.length > MAX_SWAPPED_ITEMS) {
      updated.length = MAX_SWAPPED_ITEMS;
    }

    await safeStorage.setItem(SWAPPED_RECIPES_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    logger.error('Error recording recipe swap:', error);
    return false;
  }
}

/**
 * Returns a list of recently swapped recipes. Default limit is 15, matching
 * the UX requirement that swapped recipes should not re-appear for at least
 * 15 swaps / generations.
 */
export async function getRecentSwappedRecipes(limit: number = 15): Promise<string[]> {
  try {
    const data = await safeStorage.getItem(SWAPPED_RECIPES_KEY);
    if (!data) return [];

    const swapped: string[] = JSON.parse(data) as string[];
    return swapped.slice(0, limit);
  } catch (error) {
    logger.error('Error retrieving recent swapped recipes:', error);
    return [];
  }
} 

// -----------------------------
// Blocked Recipes Management
// -----------------------------

const PERMANENT_BLOCK_KEY = 'permanent_block_recipes';
const TEMP_BLOCK_KEY = 'temporary_block_recipes'; // stores array of {id, remaining}

interface TempBlockedRecipe {
  id: string;
  remaining: number; // number of meal-plan generations left to skip
}

/**
 * Permanently blocks a recipe from being recommended.
 */
export async function blockRecipePermanent(recipeId: string): Promise<boolean> {
  try {
    const data = await safeStorage.getItem(PERMANENT_BLOCK_KEY);
    const list: string[] = data ? JSON.parse(data) as string[] : [];

    if (!list.includes(recipeId)) {
      list.push(recipeId);
      await safeStorage.setItem(PERMANENT_BLOCK_KEY, JSON.stringify(list));
    }
    return true;
  } catch (err) {
    logger.error('Error blocking recipe permanently:', err);
    return false;
  }
}

/**
 * Temporarily blocks a recipe for a given number of generations (default 10).
 */
export async function blockRecipeTemporary(recipeId: string, generations: number = 10): Promise<boolean> {
  try {
    if (generations <= 0) return true;

    const data = await safeStorage.getItem(TEMP_BLOCK_KEY);
    let list: TempBlockedRecipe[] = data ? JSON.parse(data) as TempBlockedRecipe[] : [];

    const existing = list.find(r => r.id === recipeId);
    if (existing) {
      existing.remaining = Math.max(existing.remaining, generations);
    } else {
      list.push({ id: recipeId, remaining: generations });
    }

    await safeStorage.setItem(TEMP_BLOCK_KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    logger.error('Error blocking recipe temporarily:', err);
    return false;
  }
}

/**
 * Retrieves all currently blocked recipe IDs (permanent + temporary).
 * For temporary blocks, the remaining counter is decremented by 1 (i.e., one generation has passed) and
 * entries that reach 0 are removed automatically.
 */
export async function getBlockedRecipeIds(): Promise<string[]> {
  try {
    // Permanent list
    const permanentData = await safeStorage.getItem(PERMANENT_BLOCK_KEY);
    const permanent: string[] = permanentData ? JSON.parse(permanentData) as string[] : [];

    // Temporary list
    const tempData = await safeStorage.getItem(TEMP_BLOCK_KEY);
    let temp: TempBlockedRecipe[] = tempData ? JSON.parse(tempData) as TempBlockedRecipe[] : [];

    // Decrement remaining counters and filter out expired
    temp = temp.map(r => ({ ...r, remaining: r.remaining - 1 })).filter(r => r.remaining > 0);

    // Persist updated temp list
    await safeStorage.setItem(TEMP_BLOCK_KEY, JSON.stringify(temp));

    const tempIds = temp.map(r => r.id);

    return [...new Set([...permanent, ...tempIds])];
  } catch (err) {
    logger.error('Error retrieving blocked recipes:', err);
    return [];
  }
} 