import analytics from '@react-native-firebase/analytics';
import logger from '../utils/logger';

export function logMealPlanGenerated(params: { recipeCount: number; mealTypes: string[] }): void {
  analytics().logEvent('meal_plan_generated', params).catch(err =>
    logger.error('[analytics] meal_plan_generated failed', err),
  );
}

export function logRecipeViewed(params: { recipeId: string; recipeName: string; source?: string }): void {
  analytics().logEvent('recipe_viewed', params).catch(err =>
    logger.error('[analytics] recipe_viewed failed', err),
  );
}

export function logPantryItemAdded(params: { itemName: string; category: string }): void {
  analytics().logEvent('pantry_item_added', params).catch(err =>
    logger.error('[analytics] pantry_item_added failed', err),
  );
}

export function logGroceryListCreated(params: { listName: string; itemCount: number }): void {
  analytics().logEvent('grocery_list_created', params).catch(err =>
    logger.error('[analytics] grocery_list_created failed', err),
  );
}
