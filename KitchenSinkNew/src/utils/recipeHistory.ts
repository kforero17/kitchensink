import AsyncStorage from '@react-native-async-storage/async-storage';
import { Recipe } from '../contexts/MealPlanContext';
import logger from './logger';

const RECIPE_HISTORY_KEY = 'recipe_history';
const MAX_HISTORY_ITEMS = 100;

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
    const historyData = await AsyncStorage.getItem(RECIPE_HISTORY_KEY);
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
    // Get current history
    const history = await getRecipeHistory();
    
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
    
    // Save updated history
    await AsyncStorage.setItem(RECIPE_HISTORY_KEY, JSON.stringify(updatedHistory));
    
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