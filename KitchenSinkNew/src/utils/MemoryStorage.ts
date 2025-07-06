/**
 * In-memory storage implementation that mimics AsyncStorage interface
 */
export class MemoryStorage {
  private storage: Map<string, string>;

  constructor() {
    this.storage = new Map();
  }

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

  async multiGet(keys: readonly string[]): Promise<readonly [string, string | null][]> {
    return keys.map(key => [key, this.storage.get(key) || null]);
  }

  async multiSet(keyValuePairs: readonly [string, string][]): Promise<void> {
    keyValuePairs.forEach(([key, value]) => {
      this.storage.set(key, value);
    });
  }

  async multiRemove(keys: readonly string[]): Promise<void> {
    keys.forEach(key => {
      this.storage.delete(key);
    });
  }
} 