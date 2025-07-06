/**
 * Environment utilities for safe access to environment variables
 */

import Constants from 'expo-constants';
import {
  SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT
} from '@env';

interface EnvConfig {
  SPOONACULAR_API_KEY: string;
  SPOONACULAR_BASE_URL: string;
  SPOONACULAR_INGREDIENTS_ENDPOINT: string;
  SPOONACULAR_RECIPES_ENDPOINT: string;
}

// Import environment variables directly or from constants
// This approach avoids wildcard imports which aren't supported
let envVars: Partial<EnvConfig> = {};

// Load from Constants (app.config.js)
if (Constants.expoConfig?.extra) {
  const { extra } = Constants.expoConfig;
  
  envVars = {
    ...envVars,
    SPOONACULAR_API_KEY: envVars.SPOONACULAR_API_KEY || extra.spoonacularApiKey,
    // Add other variables as needed
  };
}

// Default values if nothing else is available
const ENV_DEFAULTS: EnvConfig = {
  SPOONACULAR_API_KEY: '1d78483223b4488e9c4dc462cffb4579',
  SPOONACULAR_BASE_URL: 'https://api.spoonacular.com',
  SPOONACULAR_INGREDIENTS_ENDPOINT: '/food/ingredients',
  SPOONACULAR_RECIPES_ENDPOINT: '/recipes'
};

// Combine with defaults
export const ENV: EnvConfig = {
  SPOONACULAR_API_KEY: envVars.SPOONACULAR_API_KEY || ENV_DEFAULTS.SPOONACULAR_API_KEY,
  SPOONACULAR_BASE_URL: envVars.SPOONACULAR_BASE_URL || ENV_DEFAULTS.SPOONACULAR_BASE_URL,
  SPOONACULAR_INGREDIENTS_ENDPOINT: envVars.SPOONACULAR_INGREDIENTS_ENDPOINT || ENV_DEFAULTS.SPOONACULAR_INGREDIENTS_ENDPOINT,
  SPOONACULAR_RECIPES_ENDPOINT: envVars.SPOONACULAR_RECIPES_ENDPOINT || ENV_DEFAULTS.SPOONACULAR_RECIPES_ENDPOINT
};

// Add development flag
export const IS_DEVELOPMENT = __DEV__;

// Add app version
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

// Helper functions
export function getApiUrl(endpoint: string): string {
  return `${ENV.SPOONACULAR_BASE_URL}${endpoint}`;
}

export function getApiKey(): string {
  return ENV.SPOONACULAR_API_KEY;
}

const envUtils = {
  ...ENV,
  IS_DEVELOPMENT,
  APP_VERSION,
  getApiUrl,
  getApiKey
};

export default envUtils; 