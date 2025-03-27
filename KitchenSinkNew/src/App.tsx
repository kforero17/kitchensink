import AsyncStorage from '@react-native-async-storage/async-storage';

// Create an AsyncStorage patch that activates if AsyncStorage becomes undefined
// This fixes "Cannot read property 'getItem' of undefined" errors with Hermes engine
const patchAsyncStorage = () => {
  // Create a simple storage fallback
  const memoryStorage = new Map<string, string>();
  const asyncStorageStub = {
    getItem: async (key: string) => memoryStorage.get(key) || null,
    setItem: async (key: string, value: string) => { memoryStorage.set(key, value); },
    removeItem: async (key: string) => { memoryStorage.delete(key); },
    clear: async () => { memoryStorage.clear(); },
    getAllKeys: async () => Array.from(memoryStorage.keys()),
    multiGet: async (keys: string[]) => keys.map(key => [key, memoryStorage.get(key) || null]),
    multiSet: async (keyValuePairs: string[][]) => {
      keyValuePairs.forEach(([key, value]) => memoryStorage.set(key, value));
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach(key => memoryStorage.delete(key));
    },
  };
  
  // Keep a copy of the original AsyncStorage for restoration
  const originalAsyncStorage = AsyncStorage;

  // Check if AsyncStorage is undefined during runtime
  setInterval(() => {
    if (typeof AsyncStorage === 'undefined' || AsyncStorage === null) {
      console.warn('[AsyncStorage] AsyncStorage became undefined, providing fallback');
      // Use type assertion to fix TypeScript errors
      (global as any).AsyncStorage = asyncStorageStub;
    } else if ((global as any).AsyncStorage !== originalAsyncStorage && originalAsyncStorage) {
      // Restore if possible
      (global as any).AsyncStorage = originalAsyncStorage;
    }
  }, 500);
  
  // Skip the dangerous Object.defineProperty patch as it could cause other issues
  // This interval-based check should be sufficient
};

// Apply patch immediately 
patchAsyncStorage(); 