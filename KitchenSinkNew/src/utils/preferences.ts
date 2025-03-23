import AsyncStorage from '@react-native-async-storage/async-storage';
import { DietaryPreferences } from '../types/DietaryPreferences';
import { FoodPreferences } from '../types/FoodPreferences';
import { CookingPreferences } from '../types/CookingPreferences';
import { BudgetPreferences } from '../types/BudgetPreferences';
import logger from './logger';
import auth from '@react-native-firebase/auth';
import { firestoreService } from '../services/firebaseService';

export const STORAGE_KEYS = {
  DIETARY_PREFERENCES: 'dietary_preferences',
  FOOD_PREFERENCES: 'food_preferences',
  COOKING_PREFERENCES: 'cooking_preferences',
  BUDGET_PREFERENCES: 'budget_preferences',
  USE_PANTRY_ITEMS: 'use_pantry_items',
  APP_SETTINGS: 'app_settings'
} as const;

/**
 * Determines if the app should use Firestore for preferences
 * This is true if a user is authenticated, false otherwise
 */
function shouldUseFirestore(): boolean {
  return auth().currentUser !== null;
}

export async function clearAllPreferences(): Promise<void> {
  try {
    // Always clear AsyncStorage preferences
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
    logger.debug('All local preferences cleared');
    
    // Note: We don't clear Firestore preferences as they should persist
    // across app reinstalls/clears
  } catch (error) {
    logger.error('Error clearing preferences:', error);
  }
}

export async function saveDietaryPreferences(preferences: DietaryPreferences): Promise<boolean> {
  try {
    // Always save to AsyncStorage first (regardless of auth status)
    await AsyncStorage.setItem(STORAGE_KEYS.DIETARY_PREFERENCES, JSON.stringify(preferences));
    
    // If authenticated, also save to Firestore
    if (shouldUseFirestore()) {
      try {
        await firestoreService.saveDietaryPreferences(preferences);
      } catch (firestoreError) {
        // Log Firestore error but don't fail the operation
        logger.error('Error saving dietary preferences to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error saving dietary preferences:', error);
    return false;
  }
}

export async function getDietaryPreferences(): Promise<DietaryPreferences | null> {
  try {
    // Try to get from AsyncStorage first
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DIETARY_PREFERENCES);
    const localPrefs = data ? JSON.parse(data) : null;
    
    // If authenticated, try to get from Firestore
    if (shouldUseFirestore()) {
      try {
        const firestorePrefs = await firestoreService.getDietaryPreferences();
        // Return Firestore data if available, otherwise use local data
        return firestorePrefs || localPrefs;
      } catch (firestoreError) {
        logger.error('Error getting dietary preferences from Firestore:', firestoreError);
        // Fall back to local data on Firestore error
        return localPrefs;
      }
    }
    
    // Return local data
    return localPrefs;
  } catch (error) {
    logger.error('Error getting dietary preferences:', error);
    return null;
  }
}

export async function saveFoodPreferences(preferences: FoodPreferences): Promise<boolean> {
  try {
    // Always save to AsyncStorage first (regardless of auth status)
    await AsyncStorage.setItem(STORAGE_KEYS.FOOD_PREFERENCES, JSON.stringify(preferences));
    
    // If authenticated, also save to Firestore
    if (shouldUseFirestore()) {
      try {
        await firestoreService.saveFoodPreferences(preferences);
      } catch (firestoreError) {
        // Log Firestore error but don't fail the operation
        logger.error('Error saving food preferences to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error saving food preferences:', error);
    return false;
  }
}

export async function getFoodPreferences(): Promise<FoodPreferences | null> {
  try {
    // Try to get from AsyncStorage first
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_PREFERENCES);
    const localPrefs = data ? JSON.parse(data) : null;
    
    // If authenticated, try to get from Firestore
    if (shouldUseFirestore()) {
      try {
        const firestorePrefs = await firestoreService.getFoodPreferences();
        // Return Firestore data if available, otherwise use local data
        return firestorePrefs || localPrefs;
      } catch (firestoreError) {
        logger.error('Error getting food preferences from Firestore:', firestoreError);
        // Fall back to local data on Firestore error
        return localPrefs;
      }
    }
    
    // Return local data
    return localPrefs;
  } catch (error) {
    logger.error('Error getting food preferences:', error);
    return null;
  }
}

export async function saveCookingPreferences(preferences: CookingPreferences): Promise<boolean> {
  try {
    // Always save to AsyncStorage first (regardless of auth status)
    await AsyncStorage.setItem(STORAGE_KEYS.COOKING_PREFERENCES, JSON.stringify(preferences));
    
    // If authenticated, also save to Firestore
    if (shouldUseFirestore()) {
      try {
        await firestoreService.saveCookingPreferences(preferences);
      } catch (firestoreError) {
        // Log Firestore error but don't fail the operation
        logger.error('Error saving cooking preferences to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error saving cooking preferences:', error);
    return false;
  }
}

export async function getCookingPreferences(): Promise<CookingPreferences | null> {
  try {
    // Try to get from AsyncStorage first
    const data = await AsyncStorage.getItem(STORAGE_KEYS.COOKING_PREFERENCES);
    const localPrefs = data ? JSON.parse(data) : null;
    
    // If authenticated, try to get from Firestore
    if (shouldUseFirestore()) {
      try {
        const firestorePrefs = await firestoreService.getCookingPreferences();
        // Return Firestore data if available, otherwise use local data
        return firestorePrefs || localPrefs;
      } catch (firestoreError) {
        logger.error('Error getting cooking preferences from Firestore:', firestoreError);
        // Fall back to local data on Firestore error
        return localPrefs;
      }
    }
    
    // Return local data
    return localPrefs;
  } catch (error) {
    logger.error('Error getting cooking preferences:', error);
    return null;
  }
}

export async function saveBudgetPreferences(preferences: BudgetPreferences): Promise<boolean> {
  try {
    // Always save to AsyncStorage first (regardless of auth status)
    await AsyncStorage.setItem(STORAGE_KEYS.BUDGET_PREFERENCES, JSON.stringify(preferences));
    
    // If authenticated, also save to Firestore
    if (shouldUseFirestore()) {
      try {
        await firestoreService.saveBudgetPreferences(preferences);
      } catch (firestoreError) {
        // Log Firestore error but don't fail the operation
        logger.error('Error saving budget preferences to Firestore:', firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error('Error saving budget preferences:', error);
    return false;
  }
}

export async function getBudgetPreferences(): Promise<BudgetPreferences | null> {
  try {
    // Try to get from AsyncStorage first
    const data = await AsyncStorage.getItem(STORAGE_KEYS.BUDGET_PREFERENCES);
    const localPrefs = data ? JSON.parse(data) : null;
    
    // If authenticated, try to get from Firestore
    if (shouldUseFirestore()) {
      try {
        const firestorePrefs = await firestoreService.getBudgetPreferences();
        // Return Firestore data if available, otherwise use local data
        return firestorePrefs || localPrefs;
      } catch (firestoreError) {
        logger.error('Error getting budget preferences from Firestore:', firestoreError);
        // Fall back to local data on Firestore error
        return localPrefs;
      }
    }
    
    // Return local data
    return localPrefs;
  } catch (error) {
    logger.error('Error getting budget preferences:', error);
    return null;
  }
}

/**
 * Migrate preferences from AsyncStorage to Firestore when a user signs in
 * This is useful when a user has created preferences before signing in
 */
export async function migratePreferencesToFirestore(): Promise<boolean> {
  try {
    if (!shouldUseFirestore()) {
      // Can't migrate if not authenticated
      return false;
    }
    
    // Get all preferences from AsyncStorage
    const dietaryPrefs = await AsyncStorage.getItem(STORAGE_KEYS.DIETARY_PREFERENCES);
    const foodPrefs = await AsyncStorage.getItem(STORAGE_KEYS.FOOD_PREFERENCES);
    const cookingPrefs = await AsyncStorage.getItem(STORAGE_KEYS.COOKING_PREFERENCES);
    const budgetPrefs = await AsyncStorage.getItem(STORAGE_KEYS.BUDGET_PREFERENCES);
    
    // Save to Firestore if they exist
    if (dietaryPrefs) {
      await firestoreService.saveDietaryPreferences(JSON.parse(dietaryPrefs));
    }
    
    if (foodPrefs) {
      await firestoreService.saveFoodPreferences(JSON.parse(foodPrefs));
    }
    
    if (cookingPrefs) {
      await firestoreService.saveCookingPreferences(JSON.parse(cookingPrefs));
    }
    
    if (budgetPrefs) {
      await firestoreService.saveBudgetPreferences(JSON.parse(budgetPrefs));
    }
    
    // Clear AsyncStorage preferences after successful migration
    if (dietaryPrefs || foodPrefs || cookingPrefs || budgetPrefs) {
      await clearAllPreferences();
      logger.debug('Successfully migrated preferences from AsyncStorage to Firestore');
    }
    
    return true;
  } catch (error) {
    logger.error('Error migrating preferences to Firestore:', error);
    return false;
  }
}

/**
 * Get a generic preference value by key
 * @param key The preference key
 * @param defaultValue Default value to return if preference not found
 * @returns The preference value or defaultValue if not found
 */
export async function getPreferenceValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    // First check AsyncStorage for this specific key
    let value: T | null = null;
    
    try {
      // Try to get directly from specific key
      const rawValue = await AsyncStorage.getItem(key);
      if (rawValue) {
        try {
          // Try to parse as JSON first
          value = JSON.parse(rawValue) as T;
        } catch {
          // If parsing fails, use raw value
          value = rawValue as unknown as T;
        }
      }
    } catch (error) {
      // Ignore errors with direct key lookup
    }
    
    // If not found in direct key, check AsyncStorage app settings
    if (value === null) {
      try {
        const settings = await AsyncStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
        if (settings) {
          const parsedSettings = JSON.parse(settings);
          value = parsedSettings[key] !== undefined ? parsedSettings[key] as T : null;
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
    
    // If authenticated, also try Firestore
    if (value === null && shouldUseFirestore()) {
      try {
        const settings = await firestoreService.getAppSettings();
        value = settings && settings[key] !== undefined ? settings[key] as T : null;
      } catch (firestoreError) {
        logger.error(`Error getting preference value for ${key} from Firestore:`, firestoreError);
        // Proceed with local values if Firestore fails
      }
    }
    
    // Return default value if still not found
    return value !== null ? value : defaultValue;
  } catch (error) {
    logger.error(`Error getting preference value for ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Save a generic preference value by key
 * @param key The preference key
 * @param value The value to save
 * @returns True if saved successfully
 */
export async function savePreferenceValue<T>(key: string, value: T): Promise<boolean> {
  try {
    // Always save to AsyncStorage app settings first
    let settings = {};
    try {
      const existingSettings = await AsyncStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
      if (existingSettings) {
        settings = JSON.parse(existingSettings);
      }
    } catch (error) {
      // If parsing fails, use empty object
    }
    
    // Update settings
    settings = { ...settings, [key]: value };
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(settings));
    
    // Additionally save directly to key-specific entry for backward compatibility
    if (typeof value === 'object') {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } else {
      await AsyncStorage.setItem(key, String(value));
    }
    
    // If authenticated, also save to Firestore
    if (shouldUseFirestore()) {
      try {
        await firestoreService.saveAppSetting(key, value);
      } catch (firestoreError) {
        // Log Firestore error but don't fail the operation
        logger.error(`Error saving preference value for ${key} to Firestore:`, firestoreError);
        // We still return true since we saved to AsyncStorage successfully
      }
    }
    
    return true;
  } catch (error) {
    logger.error(`Error saving preference value for ${key}:`, error);
    return false;
  }
} 