import AsyncStorage from '@react-native-async-storage/async-storage';
import logger from './logger';

// Memory storage fallback when AsyncStorage is unavailable
class MemoryStorage {
  private storage: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    return keys.map(key => [key, this.storage.get(key) || null]);
  }

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    keyValuePairs.forEach(([key, value]) => {
      this.storage.set(key, value);
    });
  }

  async multiRemove(keys: string[]): Promise<void> {
    keys.forEach(key => {
      this.storage.delete(key);
    });
  }

  async getAllKeys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }
}

// Safely attempt to access AsyncStorage methods
const safeAsyncOperation = async <T>(
  key: string | string[],
  operationName: string,
  operation: () => Promise<T>,
  fallback: () => Promise<T>
): Promise<T> => {
  // Add safety check for undefined keys
  if (key === undefined || key === null || 
      (Array.isArray(key) && (key.length === 0 || key.some(k => k === undefined || k === null)))) {
    logger.warn(`[safeAsyncOp:${operationName}] Key is undefined/null/empty, using memory fallback.`);
    return await fallback();
  }
  
  logger.debug(`[safeAsyncOp:${operationName}] Key: ${key}. Checking AsyncStorage...`);
  try {
    // First check if AsyncStorage is defined
    if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
      logger.warn('AsyncStorage is undefined, using memory fallback');
      return await fallback();
    }
    
    // Then check if the specific method exists
    if (typeof operation !== 'function') {
      logger.warn('AsyncStorage operation is not a function, using memory fallback');
      return await fallback();
    }
    
    // Finally try the operation
    return await operation();
  } catch (error) {
    logger.error('AsyncStorage operation failed, using memory fallback:', error);
    return await fallback();
  }
};

class ResilientAsyncStorage {
  private memoryStorage: MemoryStorage = new MemoryStorage();
  private errorCount: number = 0;
  private maxErrorsBeforeFallback: number = 3;
  private preloadedKeys: Set<string> = new Set();
  private usingFallback: boolean = false;
  private errorListeners: Array<(error: Error) => void> = [];
  private memoryCache: { [key: string]: string | null } = {};

  constructor() {
    // Check for AsyncStorage availability immediately
    this.checkAvailability().then(available => {
      if (!available) {
        logger.warn('AsyncStorage is not available, using memory fallback');
        this.usingFallback = true;
      } else {
        logger.debug('AsyncStorage is available');
      }
    });
  }

  async checkAvailability(): Promise<boolean> {
    try {
      // Check if AsyncStorage exists
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        logger.warn('[AsyncStorage] AsyncStorage is undefined');
        return false;
      }

      // Check if critical methods exist
      const methods = ['getItem', 'setItem', 'removeItem'];
      for (const method of methods) {
        if (typeof AsyncStorage[method] !== 'function') {
          logger.warn(`[AsyncStorage] AsyncStorage.${method} is not a function`);
          return false;
        }
      }

      // Try a test operation
      return true;
    } catch (error) {
      logger.error('[AsyncStorage] Availability check failed:', error);
      return false;
    }
  }

  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        logger.error('Error in storage error listener:', listenerError);
      }
    });
  }

  addErrorListener(listener: (error: Error) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== listener);
    };
  }

  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  resetErrorCount(): void {
    this.errorCount = 0;
    this.usingFallback = false;
  }

  /**
   * Preloads a key value from AsyncStorage into memory for quicker access
   * and to ensure availability even if AsyncStorage becomes unavailable.
   */
  async preloadKey(key: string): Promise<void> {
    if (!key) {
      logger.warn('[ResilientAsyncStorage] Cannot preload undefined/null key');
      return;
    }

    try {
      // Mark this key as preloaded to handle it differently
      this.preloadedKeys.add(key);
      
      // If already using fallback, no need to preload
      if (this.usingFallback) {
        return;
      }

      // Attempt to access the key
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        throw new Error('AsyncStorage is undefined during preload');
      }
      
      if (typeof AsyncStorage.getItem !== 'function') {
        throw new Error('AsyncStorage.getItem is not a function during preload');
      }
      
      // Try to get the value and store it in memory for faster future access
      const value = await AsyncStorage.getItem(key);
      // Could implement a memory cache here if needed for better performance
      
      logger.debug(`Key preloaded successfully: ${key}`);
    } catch (error) {
      logger.warn(`Failed to preload key ${key}:`, error);
      this.usingFallback = true;
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
      // Don't throw - we want preloading to fail gracefully
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      // Special handling for keys that need to be preloaded
      if (this.preloadedKeys.has(key) && this.usingFallback) {
        return await this.memoryStorage.getItem(key);
      }
      
      // Crucial double check for AsyncStorage and method existence
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        this.usingFallback = true;
        logger.warn(`AsyncStorage is undefined during getItem(${key}), using memory fallback`);
        return await this.memoryStorage.getItem(key);
      }
      
      if (typeof AsyncStorage.getItem !== 'function') {
        this.usingFallback = true;
        logger.warn(`AsyncStorage.getItem is not a function during getItem(${key}), using memory fallback`);
        return await this.memoryStorage.getItem(key);
      }
      
      return await safeAsyncOperation(
        key,
        'getItem',
        () => AsyncStorage.getItem(key),
        () => this.memoryStorage.getItem(key)
      );
    } catch (error) {
      this.errorCount++;
      if (this.errorCount >= this.maxErrorsBeforeFallback) {
        this.usingFallback = true;
      }
      logger.error(`Error getting key ${key}:`, error);
      
      // Notify listeners about the error
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
      
      // Always fall back to memory storage on error
      return await this.memoryStorage.getItem(key);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Always update memory storage for backup
      await this.memoryStorage.setItem(key, value);
      
      // If using fallback mode, don't attempt AsyncStorage
      if (this.usingFallback) {
        return;
      }
      
      // Check for AsyncStorage and method
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        this.usingFallback = true;
        logger.warn(`AsyncStorage is undefined during setItem(${key}), using memory fallback`);
        return;
      }
      
      if (typeof AsyncStorage.setItem !== 'function') {
        this.usingFallback = true;
        logger.warn(`AsyncStorage.setItem is not a function, using memory fallback`);
        return;
      }
      
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      this.errorCount++;
      if (this.errorCount >= this.maxErrorsBeforeFallback) {
        this.usingFallback = true;
      }
      logger.error(`Error setting key ${key}:`, error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
      // We've already updated memory storage, so just return
    }
  }

  // Implement other methods similarly with safe operations and fallbacks
  async removeItem(key: string): Promise<void> {
    try {
      // Remove from memory storage first
      await this.memoryStorage.removeItem(key);
      
      if (this.usingFallback) {
        return;
      }
      
      await safeAsyncOperation(
        key,
        'removeItem',
        () => AsyncStorage.removeItem(key),
        async () => { /* already removed from memory */ }
      );
    } catch (error) {
      logger.error(`Error removing key ${key}:`, error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      if (this.usingFallback) {
        return await this.memoryStorage.multiGet(keys);
      }
      
      return await safeAsyncOperation(
        keys,
        'multiGet',
        () => AsyncStorage.multiGet(keys),
        () => this.memoryStorage.multiGet(keys)
      );
    } catch (error) {
      logger.error('Error in multiGet:', error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
      return await this.memoryStorage.multiGet(keys);
    }
  }

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    try {
      // Update memory storage first
      await this.memoryStorage.multiSet(keyValuePairs);
      
      if (this.usingFallback) {
        return;
      }
      
      await safeAsyncOperation(
        keyValuePairs.map(kv => kv[0]),
        'multiSet',
        () => AsyncStorage.multiSet(keyValuePairs),
        async () => { /* already set in memory */ }
      );
    } catch (error) {
      logger.error('Error in multiSet:', error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async multiRemove(keys: string[]): Promise<void> {
    try {
      // Remove from memory first
      await this.memoryStorage.multiRemove(keys);
      
      if (this.usingFallback) {
        return;
      }
      
      await safeAsyncOperation(
        keys,
        'multiRemove',
        () => AsyncStorage.multiRemove(keys),
        async () => { /* already removed from memory */ }
      );
    } catch (error) {
      logger.error('Error in multiRemove:', error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      if (this.usingFallback) {
        return await this.memoryStorage.getAllKeys();
      }
      
      return await safeAsyncOperation(
        '',
        'getAllKeys',
        () => AsyncStorage.getAllKeys(),
        () => this.memoryStorage.getAllKeys()
      );
    } catch (error) {
      logger.error('Error in getAllKeys:', error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
      return await this.memoryStorage.getAllKeys();
    }
  }

  async clear(): Promise<void> {
    try {
      // Clear memory storage first
      await this.memoryStorage.clear();
      
      if (this.usingFallback) {
        return;
      }
      
      await safeAsyncOperation(
        '',
        'clear',
        () => AsyncStorage.clear(),
        async () => { /* already cleared in memory */ }
      );
    } catch (error) {
      logger.error('Error in clear:', error);
      this.notifyErrorListeners(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// Export a singleton instance
export const resilientStorage = new ResilientAsyncStorage();

// For checking AsyncStorage from other components
export const safeStorage = {
  checkAvailability: async () => {
    try {
      if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
        logger.error('[AsyncStorage] AsyncStorage is undefined');
        return false;
      }
      logger.debug('[AsyncStorage] AsyncStorage is available');
      return true;
    } catch (e) {
      logger.error('[AsyncStorage] Error checking availability:', e);
      return false;
    }
  }
}; 