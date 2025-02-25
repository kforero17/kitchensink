import AsyncStorage from '@react-native-async-storage/async-storage';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import logger from './logger';

export const STORAGE_KEYS = {
  DIETARY_PREFERENCES: 'dietary_preferences',
  FOOD_PREFERENCES: 'food_preferences',
  COOKING_PREFERENCES: 'cooking_preferences',
  BUDGET_PREFERENCES: 'budget_preferences'
} as const;

export async function clearAllPreferences(): Promise<void> {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
    logger.debug('All preferences cleared');
  } catch (error) {
    logger.error('Error clearing preferences:', error);
  }
}

export async function saveDietaryPreferences(preferences: DietaryPreferences): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.DIETARY_PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (error) {
    logger.error('Error saving dietary preferences:', error);
    return false;
  }
}

export async function getDietaryPreferences(): Promise<DietaryPreferences | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DIETARY_PREFERENCES);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error getting dietary preferences:', error);
    return null;
  }
}

export async function saveFoodPreferences(preferences: FoodPreferences): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.FOOD_PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (error) {
    logger.error('Error saving food preferences:', error);
    return false;
  }
}

export async function getFoodPreferences(): Promise<FoodPreferences | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_PREFERENCES);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error getting food preferences:', error);
    return null;
  }
}

export async function saveCookingPreferences(preferences: CookingPreferences): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.COOKING_PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (error) {
    logger.error('Error saving cooking preferences:', error);
    return false;
  }
}

export async function getCookingPreferences(): Promise<CookingPreferences | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COOKING_PREFERENCES);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error getting cooking preferences:', error);
    return null;
  }
}

export async function saveBudgetPreferences(preferences: BudgetPreferences): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.BUDGET_PREFERENCES, JSON.stringify(preferences));
    return true;
  } catch (error) {
    logger.error('Error saving budget preferences:', error);
    return false;
  }
}

export async function getBudgetPreferences(): Promise<BudgetPreferences | null> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BUDGET_PREFERENCES);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Error getting budget preferences:', error);
    return null;
  }
} 