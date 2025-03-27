import AsyncStorage from '@react-native-async-storage/async-storage';

// Debug helpers
const DEBUG_PREFIX = '[AsyncStorage]';
const debugLog = (...args: any[]) => console.log(DEBUG_PREFIX, ...args);

/**
 * Memory-only implementation of AsyncStorage API for fallback cases
 */
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

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async getAllKeys(): Promise<readonly string[]> {
    return Array.from(this.storage.keys());
  }
}

// Create a singleton memory storage instance
const memoryStorage = new MemoryStorage();

/**
 * Safe AsyncStorage wrapper to handle cases where AsyncStorage might be undefined
 */
class SafeAsyncStorage {
  private isAvailable: boolean = false;
  private initializationPromise: Promise<boolean> | null = null;
  private initialized = false;
  
  // Emergency fallback storage used when AsyncStorage becomes undefined
  private emergencyBackup = memoryStorage;

  constructor() {
    this.initializationPromise = this.initialize();
  }

  /**
   * Initialize and test the AsyncStorage
   */
  private async initialize(): Promise<boolean> {
    try {
      // Early check if AsyncStorage is undefined
      if (!AsyncStorage) {
        debugLog('Warning: AsyncStorage is undefined during initialization');
        this.isAvailable = false;
        this.initialized = true;
        return false;
      }

      // Test if AsyncStorage works
      const testKey = '_asyncstorage_test_' + Date.now();
      await AsyncStorage.setItem(testKey, 'test');
      const result = await AsyncStorage.getItem(testKey);
      
      // Clean up test key
      await AsyncStorage.removeItem(testKey);
      
      this.isAvailable = result === 'test';
      this.initialized = true;
      
      debugLog('AsyncStorage is ' + (this.isAvailable ? 'available' : 'unavailable'));
      return this.isAvailable;
    } catch (error) {
      debugLog('AsyncStorage initialization error:', error);
      this.isAvailable = false;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Wait for initialization to complete
   */
  private async waitForInitialization(): Promise<void> {
    if (this.initialized) {
      return;
    }
    
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  /**
   * Verify AsyncStorage is still available before each operation
   * This helps catch cases where AsyncStorage becomes undefined after initialization
   */
  private verifyAsyncStorage(): boolean {
    if (!AsyncStorage) {
      if (this.isAvailable) {
        // AsyncStorage was available before but now it's undefined
        debugLog('Warning: AsyncStorage became undefined after initialization');
        this.isAvailable = false;
      }
      return false;
    }
    return true;
  }

  /**
   * Get a value safely from AsyncStorage
   */
  async getItem(key: string): Promise<string | null> {
    await this.waitForInitialization();
    
    // Check if AsyncStorage is still available
    if (!this.verifyAsyncStorage() || !this.isAvailable) {
      // Fall back to memory storage
      debugLog('Using emergency backup for getItem:', key);
      return this.emergencyBackup.getItem(key);
    }
    
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      debugLog('getItem error for key:', key, error);
      // Fall back to memory storage
      return this.emergencyBackup.getItem(key);
    }
  }

  /**
   * Set a value safely in AsyncStorage
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.waitForInitialization();
    
    // Always store in memory fallback
    await this.emergencyBackup.setItem(key, value);
    
    // Check if AsyncStorage is still available
    if (!this.verifyAsyncStorage() || !this.isAvailable) {
      debugLog('Using emergency backup for setItem:', key);
      return;
    }
    
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      debugLog('setItem error for key:', key, error);
    }
  }

  /**
   * Remove a value safely from AsyncStorage
   */
  async removeItem(key: string): Promise<void> {
    await this.waitForInitialization();
    
    // Remove from memory fallback
    await this.emergencyBackup.removeItem(key);
    
    // Check if AsyncStorage is still available
    if (!this.verifyAsyncStorage() || !this.isAvailable) {
      debugLog('Using emergency backup for removeItem:', key);
      return;
    }
    
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      debugLog('removeItem error for key:', key, error);
    }
  }

  /**
   * Clear all values safely from AsyncStorage
   */
  async clear(): Promise<void> {
    await this.waitForInitialization();
    
    // Clear memory fallback
    await this.emergencyBackup.clear();
    
    // Check if AsyncStorage is still available
    if (!this.verifyAsyncStorage() || !this.isAvailable) {
      debugLog('Using emergency backup for clear');
      return;
    }
    
    try {
      await AsyncStorage.clear();
    } catch (error) {
      debugLog('clear error:', error);
    }
  }

  /**
   * Get all keys safely from AsyncStorage
   */
  async getAllKeys(): Promise<readonly string[]> {
    await this.waitForInitialization();
    
    // Check if AsyncStorage is still available
    if (!this.verifyAsyncStorage() || !this.isAvailable) {
      debugLog('Using emergency backup for getAllKeys');
      return this.emergencyBackup.getAllKeys();
    }
    
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      debugLog('getAllKeys error:', error);
      // Fall back to memory storage
      return this.emergencyBackup.getAllKeys();
    }
  }

  /**
   * Check if AsyncStorage is available
   */
  async checkAvailability(): Promise<boolean> {
    await this.waitForInitialization();
    
    // Verify AsyncStorage is still available
    this.verifyAsyncStorage();
    
    return this.isAvailable;
  }
}

// Create and export a singleton instance
export const safeStorage = new SafeAsyncStorage(); 