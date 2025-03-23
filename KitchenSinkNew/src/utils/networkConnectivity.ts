/**
 * Network Connectivity Utility
 * 
 * Provides functions to check device's internet connectivity
 */

import NetInfo from '@react-native-community/netinfo';
import logger from './logger';

/**
 * Check if the device has internet connectivity
 * @returns Promise resolving to a boolean indicating if internet is available
 */
export async function isInternetAvailable(): Promise<boolean> {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    logger.error('Error checking internet connectivity:', error);
    return false;
  }
}

/**
 * Check if a server is reachable
 * @param url URL to check
 * @param timeoutMs Timeout in milliseconds
 * @returns Promise resolving to a boolean
 */
export async function isServerReachable(url: string, timeoutMs: number = 5000): Promise<boolean> {
  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Firebase services are reachable
 * @returns Promise resolving to a boolean
 */
export async function isFirebaseReachable(): Promise<boolean> {
  // Try to reach Firebase Auth API
  return isServerReachable('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo');
} 