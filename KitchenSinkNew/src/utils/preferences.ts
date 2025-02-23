import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './init';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';

export const savePreferences = async <T>(key: string, preferences: T): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(preferences));
    return true;
  } catch (error) {
    console.error(`Error saving preferences for ${key}:`, error);
    return false;
  }
};

export const getPreferences = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting preferences for ${key}:`, error);
    return null;
  }
};

export const getDietaryPreferences = () => 
  getPreferences<DietaryPreferences>(STORAGE_KEYS.DIETARY_PREFERENCES);

export const getFoodPreferences = () => 
  getPreferences<FoodPreferences>(STORAGE_KEYS.FOOD_PREFERENCES);

export const getCookingPreferences = () => 
  getPreferences<CookingPreferences>(STORAGE_KEYS.COOKING_PREFERENCES);

export const getBudgetPreferences = () => 
  getPreferences<BudgetPreferences>(STORAGE_KEYS.BUDGET_PREFERENCES);

export const saveDietaryPreferences = (preferences: DietaryPreferences) => 
  savePreferences(STORAGE_KEYS.DIETARY_PREFERENCES, preferences);

export const saveFoodPreferences = (preferences: FoodPreferences) => 
  savePreferences(STORAGE_KEYS.FOOD_PREFERENCES, preferences);

export const saveCookingPreferences = (preferences: CookingPreferences) => 
  savePreferences(STORAGE_KEYS.COOKING_PREFERENCES, preferences);

export const saveBudgetPreferences = (preferences: BudgetPreferences) => 
  savePreferences(STORAGE_KEYS.BUDGET_PREFERENCES, preferences); 