import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '@react-native-firebase/app';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyCVeRUiZE2Ezel6pG51r_pV4gb5amSATpQ',
  authDomain: 'kitchensink-c4872.firebaseapp.com',
  projectId: 'kitchensink-c4872',
  storageBucket: 'kitchensink-c4872.appspot.com',
  messagingSenderId: '246901092207',
  appId: '1:246901092207:ios:f84a63dc92d8e5e52c0a56'
};

export const STORAGE_KEYS = {
  DIETARY_PREFERENCES: 'dietary_preferences',
  FOOD_PREFERENCES: 'food_preferences',
  COOKING_PREFERENCES: 'cooking_preferences',
  BUDGET_PREFERENCES: 'budget_preferences',
};

export const initializeApp = async () => {
  try {
    console.log('[init] Starting app initialization...');
    console.log('[init] Platform:', Platform.OS);
    let app;
    try {
      app = firebase.app(); // Use the default app initialized by native code
      console.log('[init] Firebase default app name:', app.name);
    } catch (firebaseError) {
      console.error('[init] Could not get default Firebase app:', firebaseError);
      throw firebaseError;
    }

    // Check AsyncStorage availability
    try {
      console.log('[init] Testing AsyncStorage availability...');
      await AsyncStorage.getItem('test_key');
      console.log('[init] AsyncStorage is available and working');
    } catch (storageError) {
      console.error('[init] AsyncStorage test failed:', storageError);
      throw storageError;
    }

    // Check if app has been initialized before for AsyncStorage setup
    console.log('[init] Checking if app has been initialized before...');
    const initialized = await AsyncStorage.getItem('app_initialized');
    console.log('[init] App initialized status:', initialized ? 'yes' : 'no');

    if (!initialized) {
      console.log('[init] Setting up initial AsyncStorage preferences...');
      // Set default preferences
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.DIETARY_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.FOOD_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.COOKING_PREFERENCES, JSON.stringify({})),
        AsyncStorage.setItem(STORAGE_KEYS.BUDGET_PREFERENCES, JSON.stringify({})),
      ]);
      await AsyncStorage.setItem('app_initialized', 'true');
      console.log('[init] AsyncStorage default preferences set successfully');
    }

    console.log('[init] App initialization completed');
    return true;
  } catch (error) {
    console.error('[init] Error initializing app:', error);
    if (error instanceof Error) {
      console.error('[init] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
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