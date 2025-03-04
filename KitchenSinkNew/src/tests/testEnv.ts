/**
 * Test environment variable loading
 */

import { ENV, IS_DEVELOPMENT, APP_VERSION } from '../utils/envUtils';
import { env } from '../utils/loadEnv';

// Log direct environment variables
console.log('Direct Environment Variables:');
console.log('---------------------------');
console.log('SPOONACULAR_API_KEY:', ENV.SPOONACULAR_API_KEY);
console.log('SPOONACULAR_BASE_URL:', ENV.SPOONACULAR_BASE_URL);
console.log('SPOONACULAR_INGREDIENTS_ENDPOINT:', ENV.SPOONACULAR_INGREDIENTS_ENDPOINT);
console.log('SPOONACULAR_RECIPES_ENDPOINT:', ENV.SPOONACULAR_RECIPES_ENDPOINT);
console.log('IS_DEVELOPMENT:', IS_DEVELOPMENT);
console.log('APP_VERSION:', APP_VERSION);
console.log('---------------------------');

// Log environment variables through loadEnv utility
console.log('\nEnvironment via loadEnv:');
console.log('---------------------------');
console.log('SPOONACULAR_API_KEY:', env.SPOONACULAR_API_KEY);
console.log('SPOONACULAR_BASE_URL:', env.SPOONACULAR_BASE_URL);
console.log('SPOONACULAR_INGREDIENTS_ENDPOINT:', env.SPOONACULAR_INGREDIENTS_ENDPOINT);
console.log('SPOONACULAR_RECIPES_ENDPOINT:', env.SPOONACULAR_RECIPES_ENDPOINT);
console.log('IS_DEVELOPMENT:', env.IS_DEVELOPMENT);
console.log('VERSION:', env.VERSION);
console.log('---------------------------');

// Export a function to test from other scripts if needed
export function testEnvVars() {
  return {
    // Direct access
    direct: {
      apiKey: ENV.SPOONACULAR_API_KEY,
      baseUrl: ENV.SPOONACULAR_BASE_URL,
      ingredientsEndpoint: ENV.SPOONACULAR_INGREDIENTS_ENDPOINT,
      recipesEndpoint: ENV.SPOONACULAR_RECIPES_ENDPOINT,
      isDevelopment: IS_DEVELOPMENT,
      version: APP_VERSION
    },
    // Via loadEnv
    loadEnv: {
      apiKey: env.SPOONACULAR_API_KEY,
      baseUrl: env.SPOONACULAR_BASE_URL,
      ingredientsEndpoint: env.SPOONACULAR_INGREDIENTS_ENDPOINT,
      recipesEndpoint: env.SPOONACULAR_RECIPES_ENDPOINT,
      isDevelopment: env.IS_DEVELOPMENT,
      version: env.VERSION
    }
  };
} 