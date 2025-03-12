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

const App = () => {
  useEffect(() => {
    const initApp = async () => {
      try {
        // Test Firebase initialization
        const apps = firebase.apps;
        console.log('Firebase Apps:', apps.length);
        console.log('Default App:', firebase.app().name);
        
        // Test Firebase Auth initialization
        const authInstance = auth();
        console.log('Auth Instance:', authInstance ? 'Initialized' : 'Failed');
        console.log('Current User:', authInstance.currentUser);
        
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
      } catch (error) {
        console.error('Error initializing app:', error);
        logger.error('Error initializing app:', error);
      }
    };

    initApp();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MealPlanProvider>
          <AppNavigator />
        </MealPlanProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App; 