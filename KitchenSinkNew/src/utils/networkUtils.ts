/**
 * Network Utilities
 * 
 * Helper functions for making network requests with better error handling,
 * timeout support, and proper SSL handling in React Native.
 */

/**
 * Enhanced fetch function with timeout and better error handling
 * 
 * @param url The URL to fetch
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds
 * @returns The fetch response
 */
export async function safeFetch(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 60000
): Promise<Response> {
  // Set up timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    // Configure request with signal and defaults
    const requestOptions: RequestInit = {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };
    
    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Clear timeout
    clearTimeout(timeoutId);
    
    // Handle HTTP error responses
    if (!response.ok) {
      let errorMessage = `HTTP Error: ${response.status}`;
      try {
        // Try to get detailed error message from response
        const errorData = await response.text();
        errorMessage = `${errorMessage} - ${errorData}`;
      } catch (e) {
        // Ignore error parsing failure
      }
      throw new Error(errorMessage);
    }
    
    return response;
  } catch (error) {
    // Clear timeout to prevent memory leaks
    clearTimeout(timeoutId);
    
    // Handle specific errors with better messages
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Network request timed out. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('Network request failed')) {
        throw new Error(
          'Network connection failed. Please check your internet connection or the API endpoint configuration.'
        );
      }
    }
    
    // Re-throw the original error
    throw error;
  }
}

/**
 * Fetches JSON data with enhanced error handling
 * 
 * @param url The URL to fetch
 * @param options Fetch options
 * @param timeoutMs Timeout in milliseconds
 * @returns Parsed JSON data
 */
export async function fetchJson<T>(
  url: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 60000
): Promise<T> {
  const response = await safeFetch(url, options, timeoutMs);
  return await response.json() as T;
}

/**
 * Checks if the device has internet connectivity
 * Note: This is a simplified version - for a real app, consider using
 * NetInfo or a similar library for more accurate connectivity information
 * 
 * @returns Promise resolving to boolean indicating connectivity
 */
export async function checkConnectivity(): Promise<boolean> {
  try {
    // Setup timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Try to fetch a small resource to check connectivity
    const response = await fetch('https://www.google.com', { 
      method: 'HEAD',
      cache: 'no-cache',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Connectivity check failed:', error);
    return false;
  }
}

/**
 * Debug test function to validate connectivity to JSON Placeholder
 * Returns a promise that resolves to the test result message
 */
export async function testJsonPlaceholderConnectivity(): Promise<string> {
  try {
    console.log('Testing network connectivity to jsonplaceholder.typicode.com...');
    const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', { 
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Successfully connected to jsonplaceholder API!');
    console.log('Response:', JSON.stringify(data, null, 2));
    return 'JSON Placeholder connectivity test: SUCCESS';
  } catch (error) {
    console.error('Error connecting to jsonplaceholder:', error);
    return `JSON Placeholder connectivity test: FAILED - ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
} 