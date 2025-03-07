import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT,
} from '@env';

// Debug flag to help with troubleshooting
export const IS_DEV = __DEV__;
export const NETWORK_DEBUG = true;

// Get environment variables from Expo's Constants manifest
const getEnvVariables = () => {
  try {
    if (Constants.expoConfig?.extra) {
      return Constants.expoConfig.extra;
    }
    return {};
  } catch (error) {
    console.warn('Failed to load environment variables from Expo config:', error);
    return {};
  }
};

// Get a simulated .env setup for testing in development
const getDevEnv = () => {
  return {
    // This is a placeholder key - you should replace this with your own key
    SPOONACULAR_API_KEY: '1d78483223b4488e9c4dc462cffb4579',
    SPOONACULAR_BASE_URL: 'https://api.spoonacular.com',
    SPOONACULAR_INGREDIENTS_ENDPOINT: '/food/ingredients',
    SPOONACULAR_RECIPES_ENDPOINT: '/recipes',
  };
};

// Combine environment variables with fallbacks
export const ENV = {
  // API Configuration
  SPOONACULAR_API_KEY: getEnvVariables().SPOONACULAR_API_KEY || getDevEnv().SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL: getEnvVariables().SPOONACULAR_BASE_URL || getDevEnv().SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT: getEnvVariables().SPOONACULAR_INGREDIENTS_ENDPOINT || getDevEnv().SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT: getEnvVariables().SPOONACULAR_RECIPES_ENDPOINT || getDevEnv().SPOONACULAR_RECIPES_ENDPOINT,
  
  // Network Configuration
  ALLOW_INSECURE_CONNECTIONS: true, // Enable by default for corporate VPN environments
  API_TIMEOUT_MS: 30000, // Increased to 30 seconds for potentially slow VPN connections
  TRUST_ALL_CERTIFICATES: true, // Added to handle corporate VPN certificate issues
  
  // Debug Information
  DEBUG_NETWORK: NETWORK_DEBUG,
  PLATFORM: Platform.OS,
  
  // App Configuration
  IS_DEVELOPMENT: __DEV__,
  VERSION: Constants.expoConfig?.version || '1.0.0',
  
  // Feature Flags
  ENABLE_CACHE: true,
  ENABLE_ANALYTICS: !__DEV__,
  
  // Cache Configuration
  CACHE_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

// Helper function to log environment state - useful for debugging
export const logEnvironment = () => {
  if (IS_DEV) {
    console.log('Environment Configuration:');
    console.log(`Platform: ${ENV.PLATFORM}`);
    console.log(`API Base URL: ${ENV.SPOONACULAR_BASE_URL}`);
    console.log(`Allow Insecure Connections: ${ENV.ALLOW_INSECURE_CONNECTIONS}`);
    console.log(`Trust All Certificates: ${ENV.TRUST_ALL_CERTIFICATES}`);
    console.log(`API Key defined: ${ENV.SPOONACULAR_API_KEY ? 'Yes' : 'No'}`);
  }
}; 