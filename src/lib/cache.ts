/**
 * Simple in-memory cache with TTL.
 *
 * This is a lightweight caching layer for server-side API responses.
 * Works within a single serverless function invocation lifetime.
 * For production, this should be replaced with Redis/Vercel KV
 * for persistent caching across invocations.
 *
 * Usage:
 *   const cache = new MemoryCache<Game[]>(60); // 60 second TTL
 *   const cached = cache.get('popular-games');
 *   if (!cached) {
 *     const data = await fetchGames();
 *     cache.set('popular-games', data);
 *   }
 */

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxEntries: number;

  /**
   * @param ttlSeconds - How long entries live before expiring
   * @param maxEntries - Maximum cache entries (prevents memory leaks)
   */
  constructor(
    private ttlSeconds: number = 300,
    maxEntries: number = 100,
  ) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttlSeconds * 1000,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Shared cache instances for common data.
 *
 * These live in module scope so they persist across requests
 * within a serverless function's warm start period.
 */

/** Cache for leaderboard data (5 min TTL — changes slowly) */
export const leaderboardCache = new MemoryCache<unknown>(300);

/** Cache for browse page game lists (2 min TTL) */
export const browseCache = new MemoryCache<unknown>(120);

/** Cache for similar games results (5 min TTL) */
export const similarGamesCache = new MemoryCache<unknown>(300);
