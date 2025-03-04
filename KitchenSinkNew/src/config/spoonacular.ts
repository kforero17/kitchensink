import { ENV, logEnvironment } from './environment';
import { Platform } from 'react-native';

// Log environment for debugging
if (ENV.DEBUG_NETWORK) {
  logEnvironment();
}

// Verify API key is available
if (!ENV.SPOONACULAR_API_KEY) {
  console.warn('Spoonacular API key is not defined in environment variables');
}

export const SPOONACULAR_CONFIG = {
  API_KEY: ENV.SPOONACULAR_API_KEY,
  BASE_URL: ENV.SPOONACULAR_BASE_URL,
  ENDPOINTS: {
    INGREDIENTS: ENV.SPOONACULAR_INGREDIENTS_ENDPOINT,
    RECIPES: ENV.SPOONACULAR_RECIPES_ENDPOINT,
  },
  NETWORK: {
    ALLOW_INSECURE: ENV.ALLOW_INSECURE_CONNECTIONS,
    TIMEOUT_MS: ENV.API_TIMEOUT_MS,
  }
} as const;

/**
 * Safe URL parameter encoding that works in all React Native versions
 */
function encodeQueryParam(value: string): string {
  return encodeURIComponent(value)
    .replace(/%20/g, '+')  // Convert spaces to +
    .replace(/%2C/g, ','); // Keep commas readable for API
}

/**
 * Helper function to create API URLs that works in all React Native versions
 */
export const createSpoonacularUrl = (endpoint: string, queryParams: Record<string, string> = {}): string => {
  try {
    // Try to use the modern URL API first (for all platforms)
    if (typeof URL !== 'undefined') {
      try {
        const url = new URL(`${SPOONACULAR_CONFIG.BASE_URL}${endpoint}`);
        
        // Always include the API key
        url.searchParams.append('apiKey', SPOONACULAR_CONFIG.API_KEY);
        
        // Add any additional query parameters
        Object.entries(queryParams).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
        
        const finalUrl = url.toString();
        
        // Log the URL in development mode
        if (ENV.DEBUG_NETWORK) {
          console.log(`👉 URL created with URL API: ${finalUrl}`);
          console.log(`👉 Platform: ${Platform.OS}`);
          console.log(`👉 API Key present: ${finalUrl.includes('apiKey')}`);
        }
        
        return finalUrl;
      } catch (error) {
        // Fall back to manual string building if URL API fails
        console.warn('URL API failed, falling back to string concatenation', error);
      }
    }
    
    // Fallback to manual string concatenation (more compatible)
    let baseUrl = `${SPOONACULAR_CONFIG.BASE_URL}${endpoint}`;
    const queryString = Object.entries({
      apiKey: SPOONACULAR_CONFIG.API_KEY,
      ...queryParams
    })
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeQueryParam(value)}`)
      .join('&');
    
    // Add ? or & to the base URL as needed
    if (baseUrl.includes('?')) {
      baseUrl = `${baseUrl}&${queryString}`;
    } else {
      baseUrl = `${baseUrl}?${queryString}`;
    }
    
    // Log the URL in development mode
    if (ENV.DEBUG_NETWORK) {
      console.log(`👉 URL created with string concatenation: ${baseUrl}`);
      console.log(`👉 Platform: ${Platform.OS}`);
      console.log(`👉 API Key present: ${baseUrl.includes('apiKey')}`);
    }
    
    return baseUrl;
  } catch (error) {
    console.error('Error creating URL:', error);
    // Last resort fallback
    return `${SPOONACULAR_CONFIG.BASE_URL}${endpoint}?apiKey=${SPOONACULAR_CONFIG.API_KEY}`;
  }
}; 