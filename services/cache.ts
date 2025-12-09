/**
 * ImageCache - Persistent caching for API responses
 * Uses IndexedDB for browser storage across sessions
 */

export class ImageCache {
  private static dbName = 'ghanapaint-cache';
  private static dbVersion = 1;
  private static storeName = 'images';
  private static TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

  /**
   * Initialize IndexedDB
   */
  private static async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  /**
   * Get cached value or fetch and cache it
   */
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);

      // Try to get from cache
      const cached = await new Promise<{ value: T; timestamp: number } | null>((resolve) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const data = request.result;
          if (data && Date.now() - data.timestamp < this.TTL) {
            console.log('✅ Cache hit:', key);
            resolve(data);
          } else {
            if (data) {
              // Expired, delete it
              store.delete(key);
            }
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });

      if (cached) {
        return cached.value;
      }

      // Cache miss - fetch and store
      console.log('❌ Cache miss:', key);
      const result = await fetcher();
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(
          { value: result, timestamp: Date.now() },
          key
        );
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      return result;
    } catch (error) {
      // If IndexedDB fails, fall back to in-memory cache
      console.warn('IndexedDB failed, using memory cache:', error);
      return this.getOrSetMemory(key, fetcher);
    }
  }

  /**
   * Fallback in-memory cache
   */
  private static memoryCache = new Map<string, { value: any; timestamp: number }>();

  private static async getOrSetMemory<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.memoryCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      console.log('✅ Memory cache hit:', key);
      return cached.value;
    }

    console.log('❌ Memory cache miss:', key);
    const result = await fetcher();
    this.memoryCache.set(key, { value: result, timestamp: Date.now() });
    return result;
  }

  /**
   * Generate a hash from base64 image string
   */
  static generateImageHash(base64: string): string {
    // Use first 500 chars + length for quick hash
    const sample = base64.substring(0, 500);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Clear all cached data
   */
  static async clear(): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      this.memoryCache.clear();
      console.log('Cache cleared');
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }
}

