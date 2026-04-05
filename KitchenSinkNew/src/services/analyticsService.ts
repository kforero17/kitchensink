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

export function logPantryModeUsed(params: { pantryOnlyMode: boolean; pantryItemCount: number; expiringCount: number }): void {
  analytics().logEvent('pantry_mode_used', params).catch(err =>
    logger.error('[analytics] pantry_mode_used failed', err),
  );
}

export function logSmartGroceryListGenerated(params: { totalItems: number; removedByPantry: number; aisleCount: number }): void {
  analytics().logEvent('smart_grocery_list_generated', params).catch(err =>
    logger.error('[analytics] smart_grocery_list_generated failed', err),
  );
}

export function logMealPlanAccepted(params: { selectedCount: number; totalCount: number }): void {
  analytics().logEvent('meal_plan_accepted', params).catch(err =>
    logger.error('[analytics] meal_plan_accepted failed', err),
  );
}

export function logMealPlanRegenerated(): void {
  analytics().logEvent('meal_plan_regenerated').catch(err =>
    logger.error('[analytics] meal_plan_regenerated failed', err),
  );
}

export function logInsightsViewed(): void {
  analytics().logEvent('insights_viewed').catch(err =>
    logger.error('[analytics] insights_viewed failed', err),
  );
}

export function logInsightsShared(): void {
  analytics().logEvent('insights_shared').catch(err =>
    logger.error('[analytics] insights_shared failed', err),
  );
}
