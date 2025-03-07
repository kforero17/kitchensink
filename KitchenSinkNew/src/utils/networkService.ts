import { Platform } from 'react-native';
import { ENV, IS_DEV } from '../config/environment';

// Type definitions
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';

interface RequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  allowInsecure?: boolean;
  trustAllCertificates?: boolean;
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number | null;
  headers?: Record<string, string>;
}

/**
 * Convert Headers object to a simple Record
 */
function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value: string, key: string) => {
    record[key] = value;
  });
  return record;
}

// Check if AbortController is available
const isAbortControllerSupported = typeof AbortController !== 'undefined';

/**
 * Network service for handling API requests with proper error handling
 * and SSL/TLS configuration for iOS
 */
export const networkService = {
  /**
   * Make a fetch request with proper error handling and timeout
   */
  async fetch<T>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    // Apply default options
    const { 
      method = 'GET',
      headers = {},
      body = null,
      timeout = ENV.API_TIMEOUT_MS,
      allowInsecure = ENV.ALLOW_INSECURE_CONNECTIONS,
      trustAllCertificates = Platform.OS === 'ios'
    } = options;

    // Default headers
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-SSL-Debug': trustAllCertificates ? 'trusted' : 'verified',
    };

    // Combined headers
    const combinedHeaders = { ...defaultHeaders, ...headers };

    // Basic fetch options - avoid using potentially unsupported options
    let fetchOptions: RequestInit = {
      method,
      headers: combinedHeaders,
    };

    // For iOS only - configure special options for certificate handling
    if (Platform.OS === 'ios' && trustAllCertificates) {
      // @ts-ignore - iOS specific NSURLRequest properties
      fetchOptions.NSURLRequest = {
        allowsCellularAccess: true,
        allowsConstrainedNetworkAccess: true,
        allowsExpensiveNetworkAccess: true,
        TLSValidationEnabled: false, 
      };
    }

    // Add body for non-GET requests
    if (body && method !== 'GET') {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // Debug logging
    if (ENV.DEBUG_NETWORK) {
      console.log(`🌐 [${method}] ${url}`);
      console.log('📨 Headers:', combinedHeaders);
      if (body) {
        console.log('📦 Body:', typeof body === 'string' ? body : JSON.stringify(body));
      }
      if (trustAllCertificates) {
        console.log('🔓 Certificate validation is DISABLED');
      } else {
        console.log('🔒 Certificate validation is enabled');
      }
    }

    // Use a timeout mechanism that works without AbortController if needed
    let timeoutId: any = null;
    
    // Create a promise that will handle the fetch
    const fetchPromise = new Promise<Response>(async (resolve, reject) => {
      try {
        // Use AbortController if available
        if (isAbortControllerSupported) {
          const controller = new AbortController();
          timeoutId = setTimeout(() => {
            try {
              controller.abort();
            } catch (err) {
              console.warn('Error aborting fetch:', err);
            }
          }, timeout);
          
          // Only add signal if AbortController is supported
          fetchOptions.signal = controller.signal;
        } else {
          // Fallback timeout mechanism (less clean but works in older RN)
          timeoutId = setTimeout(() => {
            reject(new Error(`Request timeout after ${timeout}ms`));
          }, timeout);
        }

        // Make the fetch request
        const response = await fetch(url, fetchOptions);
        
        // Clear any pending timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        resolve(response);
      } catch (error) {
        // Clear any pending timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        reject(error);
      }
    });

    try {
      // Await the fetch promise
      const response = await fetchPromise;

      // Debug response
      if (ENV.DEBUG_NETWORK) {
        console.log(`✅ Response status: ${response.status}`);
        console.log('📥 Response headers:', response.headers);
      }

      // Parse response
      let data: T | null = null;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
          
          if (ENV.DEBUG_NETWORK) {
            console.log('📄 Response data:', data);
          }
        } catch (jsonError) {
          console.error('Error parsing JSON response:', jsonError);
          return {
            data: null,
            error: 'Error parsing JSON response',
            status: response.status,
          };
        }
      }

      return {
        data,
        error: !response.ok ? `HTTP Error: ${response.status}` : null,
        status: response.status,
        headers: headersToRecord(response.headers),
      };
    } catch (error: any) {
      // Handle network errors
      let errorMessage = error.message || 'Unknown error';

      // Special handling for common errors
      if (error.name === 'AbortError') {
        errorMessage = `Request timeout after ${timeout}ms`;
      } else if (
        // iOS specific SSL errors
        (Platform.OS === 'ios' && errorMessage.includes('SSL')) || 
        errorMessage.includes('certificate') ||
        errorMessage.includes('CERT_')
      ) {
        errorMessage = 'SSL/TLS Certificate Error. Try using secure URLs or enabling insecure mode for development.';
        
        if (ENV.DEBUG_NETWORK) {
          console.error('🔒 SSL Error Details:', errorMessage);
          console.error('Try adding "NSAllowsArbitraryLoads" in your Info.plist');
        }
      }

      if (ENV.DEBUG_NETWORK) {
        console.error(`❌ Network Error: ${errorMessage}`);
        console.error('URL:', url);
        console.error('Options:', fetchOptions);
      }

      return {
        data: null,
        error: errorMessage,
        status: null,
      };
    }
  },

  /**
   * Convenience method for GET requests
   */
  get<T>(url: string, options: Omit<RequestOptions, 'method'> = {}): Promise<ApiResponse<T>> {
    return this.fetch<T>(url, { ...options, method: 'GET' });
  },

  /**
   * Convenience method for POST requests
   */
  post<T>(url: string, body: any, options: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<ApiResponse<T>> {
    return this.fetch<T>(url, { ...options, method: 'POST', body });
  },

  /**
   * Check basic connectivity to a URL
   */
  async checkConnectivity(url: string = 'https://jsonplaceholder.typicode.com/posts/1'): Promise<boolean> {
    try {
      // Use a simpler fetch call without potentially problematic options
      const response = await fetch(url, { 
        method: 'HEAD',
        headers: { 'Accept': 'application/json' },
      });
      return response.ok;
    } catch (error) {
      if (ENV.DEBUG_NETWORK) {
        console.error('Connectivity check failed:', error);
      }
      return false;
    }
  },
};

export default networkService; 