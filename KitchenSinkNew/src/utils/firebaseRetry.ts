/**
 * Firebase Retry Utility
 * 
 * Provides retry functionality with exponential backoff for Firebase operations
 */

import logger from './logger';

/**
 * Execute a Firebase operation with retry capability using exponential backoff
 * 
 * @param operation Function that returns a Promise to retry
 * @param maxRetries Maximum number of retry attempts (default: 5)
 * @param initialDelayMs Initial delay in milliseconds (default: 1000)
 * @returns Promise resolving to the operation result
 */
export async function withFirebaseRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.debug(`Retry attempt ${attempt}/${maxRetries} for Firebase operation`);
      }
      
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a "service unavailable" error that warrants a retry
      const isRetryableError = 
        error?.message?.includes('firestore/unavailable') || 
        error?.message?.includes('The service is currently unavailable');
      
      if (!isRetryableError || attempt === maxRetries) {
        // Either it's not a retryable error or we've exhausted our retries
        logger.error(`Firebase operation failed after ${attempt} retries:`, error);
        throw error;
      }
      
      // Calculate exponential backoff delay (with jitter for distributed systems)
      const backoffMs = initialDelayMs * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
      
      logger.debug(`Firebase operation failed, retrying in ${backoffMs.toFixed(0)}ms:`, error.message);
      
      // Wait before the next retry
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }
  
  // This should never be reached due to the throw in the loop above
  throw lastError;
}

/**
 * Enhanced version of Firestore get() with automatic retries
 * 
 * @param docRef Firestore document reference
 * @returns Promise resolving to DocumentSnapshot
 */
export async function getWithRetry(docRef: any): Promise<any> {
  return withFirebaseRetry(() => docRef.get());
}

/**
 * Enhanced version of Firestore set() with automatic retries
 * 
 * @param docRef Firestore document reference
 * @param data Data to set
 * @param options Set options
 * @returns Promise resolving when complete
 */
export async function setWithRetry(docRef: any, data: any, options?: any): Promise<void> {
  return withFirebaseRetry(() => docRef.set(data, options));
}

/**
 * Enhanced version of Firestore update() with automatic retries
 * 
 * @param docRef Firestore document reference
 * @param data Data to update
 * @returns Promise resolving when complete
 */
export async function updateWithRetry(docRef: any, data: any): Promise<void> {
  return withFirebaseRetry(() => docRef.update(data));
}

/**
 * Enhanced version of Firestore delete() with automatic retries
 * 
 * @param docRef Firestore document reference
 * @returns Promise resolving when complete
 */
export async function deleteWithRetry(docRef: any): Promise<void> {
  return withFirebaseRetry(() => docRef.delete());
} 