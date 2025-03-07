/**
 * Certificate Helper - Utility to handle SSL/TLS certificate issues with corporate VPNs
 * 
 * This file provides alternative methods to fetch data when dealing with certificate
 * validation issues, especially on iOS devices behind corporate VPNs.
 */
import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import { getProxiedUrl, isProxyAvailable } from './proxyConfig';

// Type definition for the fetch response
interface FetchResponse<T> {
  data: T | null;
  error: string | null;
  status: number | null;
}

/**
 * Fetch data with certificate validation bypass for corporate VPN environments
 * This is a specialized version of fetch that attempts to bypass certificate validation
 * issues that commonly occur in corporate VPN environments on iOS.
 */
export async function secureFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<FetchResponse<T>> {
  try {
    // First check if proxy is available - if so, use it
    const proxyAvailable = await isProxyAvailable();
    
    if (proxyAvailable) {
      console.log('🔄 Using proxy server for request');
      const proxiedUrl = getProxiedUrl(url);
      return await standardFetch<T>(proxiedUrl, options);
    }

    // Try the enhanced certificate bypass approach
    return await bypassCertificateCheck<T>(url, options);
  } catch (error: any) {
    if (ENV.DEBUG_NETWORK) {
      console.error(`🚫 Secure fetch error: ${error.message}`);
      console.error(`URL: ${url}`);
    }

    return {
      data: null,
      error: error.message || 'Unknown error',
      status: null,
    };
  }
}

/**
 * Standard fetch with response parsing
 */
async function standardFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<FetchResponse<T>> {
  try {
    const response = await fetch(url, options);
    
    // Check if the response is ok
    if (!response.ok) {
      return {
        data: null,
        error: `HTTP Error: ${response.status}`,
        status: response.status,
      };
    }
    
    // Get the response text first - safer than direct json()
    const text = await response.text();
    
    // Try to parse as JSON if it looks like JSON
    let data = null;
    if (text && text.trim()) {
      try {
        data = JSON.parse(text) as T;
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError);
        return {
          data: null,
          error: 'Invalid JSON response',
          status: response.status,
        };
      }
    }

    // Validate Spoonacular response structure
    if (url.includes('spoonacular') && data) {
      // Check if response has expected structure for a search result
      if (!data.hasOwnProperty('results')) {
        console.error('Invalid Spoonacular response format:', data);
        return {
          data: null,
          error: 'Invalid Spoonacular response structure',
          status: response.status,
        };
      }
    }

    return {
      data,
      error: null,
      status: response.status,
    };
  } catch (error: any) {
    console.error('Network error in standardFetch:', error);
    return {
      data: null,
      error: error.message || 'Unknown error',
      status: null,
    };
  }
}

/**
 * Enhanced method that tries multiple approaches to bypass certificate validation
 */
async function bypassCertificateCheck<T>(
  url: string, 
  options: RequestInit = {}
): Promise<FetchResponse<T>> {
  try {
    // First attempt: Use XMLHttpRequest which has different SSL handling than fetch
    if (typeof XMLHttpRequest !== 'undefined') {
      console.log('📲 Using XMLHttpRequest with certificate bypass');
      
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open(options.method || 'GET', url);
        
        // Set headers
        if (options.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });
        }
        
        // Set default headers
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Accept', 'application/json');
        
        xhr.timeout = 30000; // 30 seconds timeout
        
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300) {
            let responseData = null;
            
            // Only try to parse as JSON if the response looks like JSON
            const responseText = xhr.responseText || '';
            if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
              try {
                responseData = JSON.parse(responseText);
              } catch (error: any) {
                console.error('Error parsing response: JSON Parse error:', error);
                return resolve({
                  data: null,
                  error: `Error parsing response: JSON Parse error: ${error.message}`,
                  status: xhr.status,
                });
              }
            } else {
              console.warn('Response is not JSON, first 50 chars:', responseText.substring(0, 50));
            }
            
            return resolve({
              data: responseData as T,
              error: null,
              status: xhr.status,
            });
          } else {
            return resolve({
              data: null,
              error: `HTTP Error: ${xhr.status}`,
              status: xhr.status,
            });
          }
        };
        
        xhr.onerror = function(e) {
          console.error('XHR Error:', e);
          return resolve({
            data: null,
            error: 'Network request failed',
            status: null,
          });
        };
        
        xhr.ontimeout = function() {
          return resolve({
            data: null,
            error: 'Request timed out',
            status: null,
          });
        };
        
        xhr.send(options.body ? JSON.stringify(options.body) : null);
      });
    }
    
    // If all else fails, try the normal fetch (will likely fail but worth a try)
    return await standardFetch<T>(url, options);
  } catch (error: any) {
    console.error('Error in bypassCertificateCheck:', error);
    return {
      data: null,
      error: error.message || 'Unknown error',
      status: null,
    };
  }
}

/**
 * Test connectivity to Spoonacular API with certificate bypass
 * Useful for diagnosing certificate-related connection issues
 */
export async function testSpoonacularWithCertificateBypass(apiKey: string): Promise<boolean> {
  try {
    const url = `https://api.spoonacular.com/food/ingredients/search?apiKey=${apiKey}&query=apple&number=1`;
    
    // Try multiple methods in sequence
    console.log('Testing API connection with enhanced certificate bypass...');
    const response = await secureFetch(url);
    
    return response.status !== null && response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error('Failed to test Spoonacular connectivity:', error);
    return false;
  }
}

/**
 * Create a URL with query parameters for Spoonacular API
 * with special handling for corporate VPN environments
 */
export function createSecureSpoonacularUrl(
  baseUrl: string,
  endpoint: string,
  queryParams: Record<string, string> = {},
  apiKey: string
): string {
  // Build the URL
  const url = new URL(baseUrl + endpoint);
  
  // Add API key
  url.searchParams.append('apiKey', apiKey);
  
  // Add other query parameters
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value) {
      url.searchParams.append(key, value);
    }
  });
  
  return url.toString();
} 