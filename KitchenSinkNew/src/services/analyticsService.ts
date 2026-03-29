import logger from '../utils/logger';

function safeLogEvent(eventName: string, params?: Record<string, unknown>): void {
  try {
    const analytics = require('@react-native-firebase/analytics').default;
    analytics().logEvent(eventName, params).catch((err: Error) =>
      logger.error(`[analytics] ${eventName} failed`, err),
    );
  } catch {
    // Native analytics module not available (e.g., Expo Go)
  }
}

export function logMealPlanGenerated(params: { recipeCount: number; mealTypes: string[] }): void {
  safeLogEvent('meal_plan_generated', params);
}

export function logRecipeViewed(params: { recipeId: string; recipeName: string; source?: string }): void {
  safeLogEvent('recipe_viewed', params);
}

export function logPantryItemAdded(params: { itemName: string; category: string }): void {
  safeLogEvent('pantry_item_added', params);
}

export function logGroceryListCreated(params: { listName: string; itemCount: number }): void {
  safeLogEvent('grocery_list_created', params);
}

export function logPantryModeUsed(params: { pantryOnlyMode: boolean; pantryItemCount: number; expiringCount: number }): void {
  safeLogEvent('pantry_mode_used', params);
}

export function logSmartGroceryListGenerated(params: { totalItems: number; removedByPantry: number; aisleCount: number }): void {
  safeLogEvent('smart_grocery_list_generated', params);
}

export function logMealPlanAccepted(params: { selectedCount: number; totalCount: number }): void {
  safeLogEvent('meal_plan_accepted', params);
}

export function logMealPlanRegenerated(): void {
  safeLogEvent('meal_plan_regenerated');
}
