/**
 * Constants for AsyncStorage keys used throughout the app
 */
export const STORAGE_KEYS = {
  // Grocery list keys
  GROCERY_LIST_CURRENT: '@grocery_list_current',
  GROCERY_LISTS_HISTORY: '@grocery_lists_history',
  
  // User preferences
  USER_PREFERENCES: '@user_preferences',
  
  // App state
  APP_ONBOARDING_COMPLETED: '@app_onboarding_completed',
  
  // Recipe history
  RECIPE_HISTORY: '@recipe_history',
  RECIPE_FAVORITES: '@recipe_favorites',
  
  // Pantry keys
  PANTRY_ITEMS: '@pantry_items',
  
  // Debug/test keys
  TEST_KEY: '@test_key',
};

// Type for storage keys to ensure type safety
export type StorageKey = keyof typeof STORAGE_KEYS; 