import AsyncStorage from '@react-native-async-storage/async-storage';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';

export const STORAGE_KEYS = {
  DIETARY_PREFERENCES: 'dietary_preferences',
  FOOD_PREFERENCES: 'food_preferences',
  COOKING_PREFERENCES: 'cooking_preferences',
  BUDGET_PREFERENCES: 'budget_preferences',
};

export const initializeApp = async () => {
  try {
    // Check if app has been initialized before
    const initialized = await AsyncStorage.getItem('app_initialized');
    
    if (!initialized) {
      // Set default preferences
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.DIETARY_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.FOOD_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.COOKING_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.BUDGET_PREFERENCES, JSON.stringify({})),
      ]);
      
      await AsyncStorage.setItem('app_initialized', 'true');
    }
    
    return true;
  } catch (error) {
    console.error('Error initializing app:', error);
    return false;
  }
};

export const resetApp = async () => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('Error resetting app:', error);
    return false;
  }
}; 