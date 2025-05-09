import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an AsyncStorage patch that activates if AsyncStorage becomes undefined
// This fixes "Cannot read property 'getItem' of undefined" errors with Hermes engine
/*
const patchAsyncStorage = () => {
  // Create a simple storage fallback
  const memoryStorage = new Map<string, string>();
  const asyncStorageStub = {
    getItem: async (key: string) => memoryStorage.get(key) || null,
    setItem: async (key: string, value: string) => { memoryStorage.set(key, value); },
    removeItem: async (key: string) => { memoryStorage.delete(key); },
    clear: async () => { memoryStorage.clear(); },
    getAllKeys: async () => Array.from(memoryStorage.keys()),
    multiGet: async (keys: string[]) => keys.map(key => [key, memoryStorage.get(key) || null]),
    multiSet: async (keyValuePairs: string[][]) => {
      keyValuePairs.forEach(([key, value]) => memoryStorage.set(key, value));
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach(key => memoryStorage.delete(key));
    },
  };
  
  // Keep a copy of the original AsyncStorage for restoration
  const originalAsyncStorage = AsyncStorage;

  // Check if AsyncStorage is undefined during runtime
  setInterval(() => {
    if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
      console.warn('[AsyncStorage] AsyncStorage became undefined, providing fallback');
      // Use type assertion to fix TypeScript errors
      (global as any).AsyncStorage = asyncStorageStub;
    } else if ((global as any).AsyncStorage !== originalAsyncStorage && originalAsyncStorage) {
      // Restore if possible
      (global as any).AsyncStorage = originalAsyncStorage;
    }
  }, 500);
  
  // Skip the dangerous Object.defineProperty patch as it could cause other issues
  // This interval-based check should be sufficient
};
*/

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import AppNavigator from './navigation/AppNavigator';
import { AuthProvider } from './contexts/AuthContext';
import { MealPlanProvider } from './contexts/MealPlanContext';
import { initializeApp, resetApp } from './utils/init'; // Ensure this import exists

// Enable screens for better performance
enableScreens();

// Call initialization logic early
initializeApp()
  .then(success => {
    if (success) {
      console.log('App initialized successfully');
    } else {
      console.warn('App initialization failed');
    }
  })
  .catch(error => console.error('App initialization threw an error:', error));

// Remove or comment out the patch call
// patchAsyncStorage();

const App: React.FC = () => {
  useEffect(() => {
    // Optional: Perform any app-wide setup on mount
    
    // Example: Reset app data on first run in DEV mode
    // if (__DEV__) {
    //   const resetOnFirstRun = async () => {
    //     const hasRunBefore = await AsyncStorage.getItem('app_has_run_before');
    //     if (!hasRunBefore) {
    //       console.log('First run in DEV, resetting app data...');
    //       await resetApp();
    //       await AsyncStorage.setItem('app_has_run_before', 'true');
    //     }
    //   };
    //   resetOnFirstRun();
    // }
  }, []);

  return (
    <SafeAreaProvider>
      <MealPlanProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </MealPlanProvider>
    </SafeAreaProvider>
  );
};

export default App; 