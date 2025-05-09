import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '@react-native-firebase/app';

export const STORAGE_KEYS = {
  DIETARY_PREFERENCES: 'dietary_preferences',
  FOOD_PREFERENCES: 'food_preferences',
  COOKING_PREFERENCES: 'cooking_preferences',
  BUDGET_PREFERENCES: 'budget_preferences',
};

export const initializeApp = async () => {
  try {
    // Initialize Firebase
    if (firebase.apps.length === 0) {
      // When relying on native configuration (GoogleService-Info.plist / google-services.json),
      // initializeApp() is called with no arguments. The TypeScript error is a known issue
      // with some versions/setups when native config is used.
      // @ts-expect-error Firebase initializes from native config without args here.
      await firebase.initializeApp(); 
      console.log('[init] Firebase initialized successfully');
    } else {
      console.log('[init] Firebase already initialized');
    }

    // Check if app has been initialized before for AsyncStorage setup
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
      console.log('[init] AsyncStorage default preferences set.');
    }

    return true;
  } catch (error) {
    console.error('[init] Error initializing app:', error);
    return false;
  }
};

export const resetApp = async () => {
  try {
    await AsyncStorage.clear();
    // Note: This does not reset Firebase data, only local AsyncStorage.
    // If Firebase data reset is needed, specific Firebase calls would be required.
    console.log('[init] AsyncStorage cleared.');
    return true;
  } catch (error) {
    console.error('[init] Error resetting app:', error);
    return false;
  }
}; 