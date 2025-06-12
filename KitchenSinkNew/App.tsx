import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { MealPlanProvider } from './src/contexts/MealPlanContext';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { clearAllPreferences } from './src/utils/preferences';
import logger from './src/utils/logger';
import { initializeProxyConfig } from './src/utils/proxyConfig';
import { AuthProvider } from './src/contexts/AuthContext';
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import ErrorBoundary from './src/components/ErrorBoundary';
import { resilientStorage } from './src/utils/ResilientAsyncStorage';
import { STORAGE_KEYS } from './src/constants/storage';
import { groceryListService } from './src/services/groceryListService';

const App = () => {
  useEffect(() => {
    const initApp = async () => {
      try {
        // Wait a bit for native Firebase initialization to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Test Firebase initialization with proper error handling
        try {
          const apps = firebase.apps;
          console.log('Firebase Apps:', apps.length);
          
          if (apps.length > 0) {
            const defaultApp = firebase.app();
            console.log('Default App:', defaultApp.name);
            
            // Test Firebase Auth initialization
            const authInstance = auth();
            console.log('Auth Instance:', authInstance ? 'Initialized' : 'Failed');
            console.log('Current User:', authInstance.currentUser);
          } else {
            console.log('No Firebase apps initialized yet');
          }
        } catch (firebaseError) {
          console.error('Firebase not ready yet:', firebaseError);
          // Continue with app initialization even if Firebase isn't ready
        }
        
        // Clear all preferences on app start
        await clearAllPreferences();
        
        // Initialize proxy configuration
        await initializeProxyConfig();
        
        // Debug logging
        logger.debug('App Configuration:', {
          projectRoot: Constants.expoConfig?.extra?.projectRoot,
          appOwnership: Constants.appOwnership,
          executionEnvironment: Constants.executionEnvironment,
          expoVersion: Constants.expoVersion,
          manifest: Constants.manifest,
          platform: Platform.OS,
          scheme: Constants.expoConfig?.scheme,
        });

        // Test URL handling
        const testUrl = 'exp+kitchensinknew://expo-development-client';
        const canOpen = await Linking.canOpenURL(testUrl);
        logger.debug('Can open development client URL:', canOpen);
        
        // Preload critical storage keys at startup
        await preloadCriticalStorageKeys();
        
        // Initialize services that depend on storage
        await initializeServices();
      } catch (error) {
        console.error('Error initializing app:', error);
        logger.error('Error initializing app:', error);
      }
    };

    initApp();
  }, []);

  // Preload critical storage keys
  const preloadCriticalStorageKeys = async () => {
    try {
      logger.debug('[App] Preloading critical storage keys...');
      
      // Check if resilientStorage is available
      if (!resilientStorage) {
        logger.warn('[App] ResilientStorage not available, skipping preload');
        return;
      }
      
      // List of critical keys to preload
      const criticalKeys = [
        STORAGE_KEYS.GROCERY_LIST_CURRENT,
        STORAGE_KEYS.GROCERY_LISTS_HISTORY,
        STORAGE_KEYS.USER_PREFERENCES
      ];
      
      // Preload each key
      for (const key of criticalKeys) {
        await resilientStorage.preloadKey(key);
        logger.debug(`[App] Preloaded key: ${key}`);
      }
      
      logger.debug('[App] Successfully preloaded all critical storage keys');
    } catch (error) {
      logger.error('[App] Error preloading storage keys:', error);
    }
  };
  
  // Initialize services after storage preloading
  const initializeServices = async () => {
    try {
      logger.debug('[App] Initializing services...');
      
      // Initialize groceryListService
      await groceryListService.initialize().catch((err: Error) => {
        logger.error('Failed to initialize groceryListService', err);
      });
      
      logger.debug('[App] Services initialization complete');
    } catch (err: unknown) {
      logger.error('Error initializing services', err);
    }
  };
  
  // Handle errors caught by ErrorBoundary
  const handleErrorBoundaryError = (error: Error) => {
    logger.error('[App] ErrorBoundary caught an error:', error);
    
    // Additional error reporting could be added here
    // Such as sending to a monitoring service
  };

  return (
    <ErrorBoundary 
      onError={handleErrorBoundaryError}
      storageKeys={[
        STORAGE_KEYS.GROCERY_LIST_CURRENT,
        STORAGE_KEYS.GROCERY_LISTS_HISTORY
      ]}
    >
      <SafeAreaProvider>
        <MealPlanProvider>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </MealPlanProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App; 