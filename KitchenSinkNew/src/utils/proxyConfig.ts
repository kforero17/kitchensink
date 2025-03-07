/**
 * Proxy Configuration Utility
 * 
 * This module provides configuration for using a local proxy server to bypass
 * corporate VPN SSL certificate issues.
 */
import { Platform } from 'react-native';
import { ENV } from '../config/environment';
import * as FileSystem from 'expo-file-system';

// Use a localhost proxy when in development mode
export const PROXY_ENABLED = ENV.IS_DEVELOPMENT && Platform.OS === 'ios';

// Default proxy settings - can be updated at runtime
const DEFAULT_PROXY_CONFIG = {
  // When testing in simulator, localhost on your machine is available at this special IP
  host: '127.0.0.1',  
  port: 8080,
  protocol: 'http',
};

// Current proxy configuration
export let PROXY_CONFIG = {...DEFAULT_PROXY_CONFIG};

// Try to read the port from the file that the proxy server creates
export async function initializeProxyConfig(): Promise<void> {
  if (!PROXY_ENABLED) {
    return;
  }
  
  try {
    // Try to read port.txt file from multiple possible locations
    const possiblePortFiles = [
      FileSystem.documentDirectory + 'proxy-port.txt',
      FileSystem.documentDirectory + 'port.txt',
      // Add more potential locations if needed
    ];
    
    let foundPort = false;
    
    // Check each possible location
    for (const portFilePath of possiblePortFiles) {
      const portFileExists = (await FileSystem.getInfoAsync(portFilePath)).exists;
      
      if (portFileExists) {
        const portStr = await FileSystem.readAsStringAsync(portFilePath);
        const port = parseInt(portStr.trim(), 10);
        
        if (!isNaN(port) && port > 0) {
          console.log('[PROXY DEBUG] Found proxy server port from file:', port);
          PROXY_CONFIG.port = port;
          foundPort = true;
          break;
        }
      }
    }
    
    // If port file not found, try each port
    if (!foundPort) {
      // Try each alternative port in sequence
      const alternatePorts = [8080, 8081, 8082, 8083, 8084, 8085];
      
      console.log('[PROXY DEBUG] Port file not found, will try multiple ports:', alternatePorts);
      
      // Store the original port to restore if none work
      const originalPort = PROXY_CONFIG.port;
      
      // Flag to track if we found a working port
      let foundWorkingPort = false;
      
      for (const port of alternatePorts) {
        PROXY_CONFIG.port = port;
        console.log(`[PROXY DEBUG] Trying proxy port: ${port}`);
        
        if (await isProxyAvailable()) {
          console.log(`[PROXY DEBUG] Successfully connected to proxy on port ${port}`);
          foundWorkingPort = true;
          break;
        }
      }
      
      if (!foundWorkingPort) {
        console.log('[PROXY DEBUG] No proxy server found on any port, reverting to default');
        PROXY_CONFIG.port = originalPort;
      }
    }
  } catch (error) {
    console.error('[PROXY DEBUG] Error initializing proxy config:', error);
  }
}

/**
 * Transforms a URL to use the proxy if enabled
 * @param originalUrl The original API URL
 * @returns Either the original URL or a proxied version
 */
export function getProxiedUrl(originalUrl: string): string {
  if (!PROXY_ENABLED) {
    console.log('[PROXY DEBUG] Proxy disabled, using original URL');
    return originalUrl;
  }
  
  try {
    // For Spoonacular API only
    if (originalUrl.includes('api.spoonacular.com')) {
      const encodedUrl = encodeURIComponent(originalUrl);
      const proxiedUrl = `${PROXY_CONFIG.protocol}://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}/proxy?url=${encodedUrl}`;
      console.log('[PROXY DEBUG] Created proxy URL for Spoonacular');
      return proxiedUrl;
    }
    
    console.log('[PROXY DEBUG] URL not eligible for proxy, using original');
    return originalUrl;
  } catch (error) {
    console.error('[PROXY DEBUG] Error creating proxy URL:', error);
    return originalUrl;
  }
}

/**
 * Check if the proxy server is running
 * This can be used to determine if the proxy approach can be used
 */
export async function isProxyAvailable(): Promise<boolean> {
  if (!PROXY_ENABLED) {
    console.log('[PROXY DEBUG] Proxy disabled by configuration');
    return false;
  }
  
  try {
    const proxyUrl = `${PROXY_CONFIG.protocol}://${PROXY_CONFIG.host}:${PROXY_CONFIG.port}/health`;
    console.log('[PROXY DEBUG] Checking proxy health at:', proxyUrl);
    
    // Use Promise.race for timeout since AbortSignal.timeout isn't available in all environments
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout checking proxy health')), 3000);
    });
    
    const fetchPromise = fetch(proxyUrl, { method: 'GET' });
    const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;
    
    const status = response.status === 200;
    console.log('[PROXY DEBUG] Proxy health check result:', status);
    return status;
  } catch (error) {
    console.log('[PROXY DEBUG] Proxy server is not available:', error);
    return false;
  }
} 