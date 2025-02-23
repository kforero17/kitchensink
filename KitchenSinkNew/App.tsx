import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { MealPlanProvider } from './src/contexts/MealPlanContext';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

const App = () => {
  useEffect(() => {
    const logAppInfo = async () => {
      // Debug logging
      console.log('App Configuration:', {
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
      console.log('Can open development client URL:', canOpen);
    };

    logAppInfo().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <MealPlanProvider>
        <AppNavigator />
      </MealPlanProvider>
    </SafeAreaProvider>
  );
};

export default App; 